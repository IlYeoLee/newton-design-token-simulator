// 자동 커밋 훅 — Edit/Write 직후 **그 파일 하나만** 커밋한다.
//
//   왜 파일 하나만인가: 이 리포에는 편집 세션이 둘 돈다(HANDOFF §2③). `git add -A` 로 커밋하면
//   다른 세션의 미완성 작업까지 쓸어가고, 실제로 오늘 그 사고가 났다(내 작업이 남의 커밋에 딸려감).
//   `git commit --only <path>` 는 인덱스에 이미 올라간 다른 파일을 **건드리지 않고** 남겨 둔다.
//
//   왜 필요한가: 룩 실험 중 셰이더가 통째로 깨지는 사고가 반복됐고, 그때마다 되돌릴 지점이 없어
//   손으로 복구했다. 편집마다 스냅샷이 있으면 `git checkout <sha> -- <file>` 한 줄로 끝난다.
//
//   설정: .claude/settings.local.json 의 PostToolUse 훅. 끄려면 /hooks 에서 지우면 된다.
//
// ── 동시 편집 안전장치 (07-31) ────────────────────────────────────────────────
//   증상: 한 세션이 방금 넣은 편집이 조용히 사라진다(실측: floorgl.js 의 _lstat 재설계가 통째로
//   옛 버전으로 되돌아감). 원인 셋이 겹쳤다 —
//     ① 두 세션의 훅이 **동시에** git 을 만져 index.lock 충돌·리베이스 꼬임이 난다.
//     ② `pull --rebase` 는 이 훅에서 **작업 트리를 다시 쓰는 유일한 지점**이다. 다른 세션이
//        편집 중일 때 돌면 남의 커밋을 끌어와 진행 중인 파일을 덮는다.
//     ③ 사라져도 아무 흔적이 없어 되찾을 지점을 몰랐다.
//   그래서:
//     ① 리포 락으로 git 동작을 세션 간 직렬화한다.
//     ② pull 은 **작업 트리가 완전히 깨끗할 때만**. push 는 트리를 안 건드리므로 항상 허용.
//        autostash 는 쓰지 않는다 — pop 이 충돌하면 소스에 충돌 마커가 박혀 더 큰 사고다.
//     ③ 모든 자동 동작을 .git/autocommit.log 에 남긴다. 편집이 사라지면 거기서 sha 를 찾아
//        `git checkout <sha> -- <file>` 로 되돌린다. 커밋마다 +추가/-삭제 를 같이 적어서,
//        남의 스테일 버퍼가 내 줄을 지운 커밋은 큰 '-' 로 바로 눈에 띈다.
import { execFileSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, appendFileSync, openSync, closeSync, unlinkSync, statSync } from 'fs';
import path from 'path';

const REPO_NAME = 'newton-design-token-simulator';
// 커밋하지 않을 것 — 임시 산출물·의존성·훅 자신의 로그
const SKIP = [/[\\/]node_modules[\\/]/, /[\\/]tmp_[^\\/]*$/, /[\\/]dist[\\/]/, /\.log$/];

const read = () => new Promise((res) => {
  let s = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => { s += d; });
  process.stdin.on('end', () => res(s));
  setTimeout(() => res(s), 3000);   // 훅이 멈추면 안 된다 — stdin 이 안 닫혀도 진행
});

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const sleep = (ms) => { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch { /* 무시 */ } };

// ── 리포 락 — 두 세션의 훅이 동시에 git 을 만지지 않게 직렬화 ──
//   훅은 async(20s 타임아웃)라 몇 초 기다려도 편집을 막지 않는다. 그래도 못 잡으면 조용히 포기한다
//   (그 편집은 다음 편집 때 같이 커밋된다 — 파일은 디스크에 이미 있으니 잃는 건 없다).
const LOCK_STALE_MS = 60_000;
function acquire(lockPath) {
  for (let i = 0; i < 12; i++) {
    try { closeSync(openSync(lockPath, 'wx')); return true; } catch { /* 누가 쥐고 있음 */ }
    try {   // 죽은 훅이 남긴 락은 걷어낸다
      if (Date.now() - statSync(lockPath).mtimeMs > LOCK_STALE_MS) { unlinkSync(lockPath); continue; }
    } catch { /* 그 사이 풀렸음 */ }
    sleep(400);
  }
  return false;
}

let lock = null, logPath = null;
const log = (line) => {
  if (!logPath) return;
  try { appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`); } catch { /* 로그 실패는 무시 */ }
};

try {
  const raw = await read();
  const j = JSON.parse(raw || '{}');
  const file = j?.tool_input?.file_path || j?.tool_response?.filePath;
  if (!file || !existsSync(file)) process.exit(0);
  if (SKIP.some((re) => re.test(file))) process.exit(0);

  const dir = path.dirname(file);
  let root;
  try { root = git(dir, ['rev-parse', '--show-toplevel']); } catch { process.exit(0); }
  if (path.basename(root) !== REPO_NAME) process.exit(0);   // 이 리포 밖은 손대지 않는다

  const rel = path.relative(root, file).replace(/\\/g, '/');
  logPath = path.join(root, '.git', 'autocommit.log');
  const lockPath = path.join(root, '.git', 'autocommit.lock');
  if (!acquire(lockPath)) { log(`SKIP lock-busy ${rel}`); process.exit(0); }
  lock = lockPath;

  try { git(root, ['add', '--', rel]); } catch { process.exit(0); }
  // 스테이징 후 실제 변화가 없으면 빈 커밋을 만들지 않는다
  try { git(root, ['diff', '--cached', '--quiet', '--', rel]); process.exit(0); } catch { /* 변화 있음 → 계속 */ }
  // 이번 편집이 얼마나 지웠는지 — 남의 스테일 버퍼가 덮어쓴 커밋은 여기서 큰 '-' 로 드러난다
  let stat = '';
  try {
    const ns = git(root, ['diff', '--cached', '--numstat', '--', rel]).split('\t');
    if (ns.length >= 2) stat = `+${ns[0]}/-${ns[1]}`;
  } catch { /* 무시 */ }
  // --only: 지정한 경로만 커밋. 다른 세션이 올려둔 스테이징은 인덱스에 그대로 남는다.
  git(root, ['commit', '--only', '--no-verify', '-q', '-m', `auto: ${rel}`, '--', rel]);
  let sha = '';
  try { sha = git(root, ['rev-parse', '--short', 'HEAD']); } catch { /* 무시 */ }
  log(`COMMIT ${sha} ${rel} ${stat}`);

  // ── 자동 푸시 ──────────────────────────────────────────────────────────
  //   편집마다 밀면 네트워크가 과하다 — 마지막 푸시로부터 PUSH_EVERY_MS 지났을 때만.
  //   **강제 푸시는 절대 하지 않는다.** 다른 세션이 먼저 올렸으면 non-fast-forward 로 실패하는데,
  //   그건 정상이고 다음 차례에 자동으로 따라잡는다.
  const PUSH_EVERY_MS = 90_000;
  const stamp = path.join(root, '.git', 'autopush.stamp');
  const now = Date.now();
  let last = 0;
  try { last = Number(readFileSync(stamp, 'utf8')) || 0; } catch { /* 첫 실행 */ }
  if (now - last >= PUSH_EVERY_MS) {
    try { writeFileSync(stamp, String(now)); } catch { /* 무시 */ }
    try {
      git(root, ['push', '--quiet']);   // push 는 작업 트리를 안 건드린다 — 더티여도 안전
    } catch {
      // 뒤처져 있으면 리베이스로 따라잡는다. ★ 단, 작업 트리가 완전히 깨끗할 때만 —
      //   pull --rebase 는 이 훅에서 유일하게 '남의 내용으로 내 파일을 다시 쓰는' 동작이라,
      //   다른 세션이 편집 중인 상태에서 돌리면 진행 중인 작업을 덮는다(07-31 실사고).
      let dirty = 'x';
      try { dirty = git(root, ['status', '--porcelain']); } catch { /* 판단 불가 = 더티 취급 */ }
      if (dirty === '') {
        try {
          git(root, ['pull', '--rebase', '--quiet']);
          git(root, ['push', '--quiet']);
          log('SYNC pull --rebase + push');
        } catch {
          // 충돌하면 되돌리고 조용히 포기한다 — 훅이 작업 트리를 충돌 상태로 남기면 그게 더 큰 사고다.
          try { git(root, ['rebase', '--abort']); } catch { /* 리베이스 중이 아니었음 */ }
          log('SYNC aborted (conflict)');
        }
      } else {
        log('SYNC skipped (dirty tree) — 다른 편집이 진행 중이라 pull 하지 않음');
      }
    }
  }
} catch {
  // 훅은 절대 작업을 막지 않는다 — 실패하면 조용히 넘어간다
} finally {
  if (lock) { try { unlinkSync(lock); } catch { /* 이미 사라짐 */ } }
}
process.exit(0);
