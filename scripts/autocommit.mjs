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
import { execFileSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
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
  try { git(root, ['add', '--', rel]); } catch { process.exit(0); }
  // 스테이징 후 실제 변화가 없으면 빈 커밋을 만들지 않는다
  try { git(root, ['diff', '--cached', '--quiet', '--', rel]); process.exit(0); } catch { /* 변화 있음 → 계속 */ }
  // --only: 지정한 경로만 커밋. 다른 세션이 올려둔 스테이징은 인덱스에 그대로 남는다.
  git(root, ['commit', '--only', '--no-verify', '-q', '-m', `auto: ${rel}`, '--', rel]);

  // ── 자동 푸시 ──────────────────────────────────────────────────────────
  //   편집마다 밀면 네트워크가 과하다 — 마지막 푸시로부터 PUSH_EVERY_MS 지났을 때만.
  //   **강제 푸시는 절대 하지 않는다.** 다른 세션이 먼저 올렸으면 non-fast-forward 로 실패하는데,
  //   그건 정상이고 다음 차례에 자동으로 따라잡는다(아래 pull --rebase 시도).
  const PUSH_EVERY_MS = 90_000;
  const stamp = path.join(root, '.git', 'autopush.stamp');
  const now = Date.now();
  let last = 0;
  try { last = Number(readFileSync(stamp, 'utf8')) || 0; } catch { /* 첫 실행 */ }
  if (now - last >= PUSH_EVERY_MS) {
    try { writeFileSync(stamp, String(now)); } catch { /* 무시 */ }
    try {
      git(root, ['push', '--quiet']);
    } catch {
      // 뒤처져 있으면 리베이스로 따라잡고 한 번만 재시도. 충돌하면 되돌리고 조용히 포기한다 —
      // 훅이 작업 트리를 충돌 상태로 남기면 그게 더 큰 사고다.
      try {
        git(root, ['pull', '--rebase', '--quiet']);
        git(root, ['push', '--quiet']);
      } catch {
        try { git(root, ['rebase', '--abort']); } catch { /* 리베이스 중이 아니었음 */ }
      }
    }
  }
} catch {
  // 훅은 절대 작업을 막지 않는다 — 실패하면 조용히 넘어간다
}
process.exit(0);
