"""SportVU 실경기 트래킹 → 검증된 스텝백 슛 검출 + 표본 수출.

data/curry_stepback_sportvu.json 을 만든 검출기 (재현용).
원본 경기 파일(98MB)은 저장소에 없다 — 아래에서 받아 압축 해제:
  https://raw.githubusercontent.com/rajshah4/BasketballData/master/2016.NBA.Raw.SportVU.Game.Logs/10.31.2015.GSW.at.NOP.7z
  (2015-10-31 GSW at NOP, gameid 0021500035 — 커리 53득점 경기)

사용: python3 scripts/extract_sportvu_stepback.py <경기.json> [--player 201939]

검출 기준 (스텝백 슛 = 전부 만족):
  ① 소유: 공이 선수 4ft 이내 + 공 높이 <8ft
  ② 3점 거리: 림에서 16~32ft
  ③ 접근: 직전 0.4s 림 방향 ≥2.5ft/s
  ④ 후방 분리: 1.2s 내 림 반대로 ≥1.5ft
  ⑤ 검증 슛(킥아웃 패스 배제): 공 9ft 상향돌파 순간 선수 4.5ft 이내
     + 궤적 정점 ≥12ft + 이후 림으로 접근
한계: SportVU는 무게중심 x/y (발 위치 아님) · 25fps = 타이밍 분해능 ±40ms.
"""
import json, math, sys

HOOPS = [(5.35, 25.0), (88.65, 25.0)]
dist = lambda a, b: math.hypot(a[0] - b[0], a[1] - b[1])


def timeline(ev, pid):
    T = []
    for m in ev['moments']:
        cur = ball = team = None
        opp = []
        for p in m[5]:
            if p[1] == pid:
                cur = (p[2], p[3]); team = p[0]
        for p in m[5]:
            if p[1] == -1:
                ball = (p[2], p[3], p[4])
            elif team and p[0] != team and p[1] != -1:
                opp.append((p[2], p[3]))
        if cur and ball:
            T.append(dict(t=m[1] / 1000.0, p=cur, ball=ball, opp=opp))
    return T


def real_shot(T, k, hoop):
    """스텝백 착지 k 이후, '그 선수의 슛'인 릴리스 프레임 (아니면 None)."""
    for q in range(k + 1, min(k + 50, len(T))):
        if T[q]['t'] - T[k]['t'] > 2.0:
            break
        b0, b1 = T[q - 1]['ball'], T[q]['ball']
        if b0[2] < 9 <= b1[2] and b1[2] > b0[2]:
            if dist(T[q]['p'], b1) > 4.5:
                return None                      # 상승 시작 시 선수 근처 아님 → 남의 슛/패스
            apex = max(T[r]['ball'][2] for r in range(q, min(q + 30, len(T))))
            if apex < 12:
                return None
            later = range(q + 5, min(q + 25, len(T)))
            if later and min(dist(T[r]['ball'], hoop) for r in later) < dist(b1, hoop) - 3:
                return q                         # 림으로 향함 = 진짜 슛
            return None
    return None


def detect(T):
    out = []
    for i in range(10, len(T) - 50):
        c0, b0, t0 = T[i]['p'], T[i]['ball'], T[i]['t']
        if dist(c0, b0) > 4 or b0[2] > 8:
            continue
        hoop = min(HOOPS, key=lambda h: dist(c0, h))
        r0 = dist(c0, hoop)
        if not (16 < r0 < 32):
            continue
        j = max(0, i - 10)
        if (dist(T[j]['p'], hoop) - r0) / (t0 - T[j]['t'] + 1e-9) < 2.5:
            continue
        for k in range(i + 2, min(i + 30, len(T))):
            if T[k]['t'] - t0 > 1.2:
                break
            if dist(T[k]['p'], hoop) - r0 > 1.5:
                q = real_shot(T, k, hoop)
                if q:
                    out.append(dict(i=i, k=k, q=q, hoop=hoop, sep=dist(T[k]['p'], hoop) - r0, r0=r0))
                break
    return out


if __name__ == '__main__':
    game = json.load(open(sys.argv[1]))
    pid = int(sys.argv[sys.argv.index('--player') + 1]) if '--player' in sys.argv else 201939
    total = []
    for ev in game['events']:
        T = timeline(ev, pid)
        for c in detect(T):
            total.append((ev['eventId'], c))
    print(f'player {pid}: 검증 스텝백 슛 {len(total)}건')
    for evid, c in total[:20]:
        print(f"  event {evid}  분리 {c['sep']*.3048:.2f}m  림 {c['r0']*.3048:.1f}m  릴리스 +{(T[c['q']]['t']-T[c['k']]['t']) if False else ''}")
