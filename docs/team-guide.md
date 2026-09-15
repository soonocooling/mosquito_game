# 모기 게임 팀 협업 가이드

> 이 문서 하나만 보고 설치부터 배포까지 따라올 수 있게 정리했다. 기능 상세는 `docs/product-spec.md`(기획서)를 본다.
> 막히면 에러 메시지 전체를 팀 채팅에 그대로 붙여넣는다. 캡처보다 텍스트 복사가 좋다.

---

## 0. 한눈에 보기

| 순서 | 할 일 | 누가 | 소요 |
|---|---|---|---|
| 1 | 개인 환경 설치 | 전원 | 30분 |
| 2 | 레포 생성·초기 프로젝트 | 팀장(A) | 20분 |
| 3 | 레포 참여 | B, C | 10분 |
| 4 | 협업 연습 (브랜치 → PR → 머지) | 전원 | 30분 |
| 5 | Day 0: 공통 뼈대 합의·구축 | 전원 같이 | 반나절 |
| 6 | 파트별 병렬 개발 | 각자 | Day 1~ |
| 7 | 통합일 (Day 4, Day 9) | 전원 같이 | 각 반나절 |
| 8 | 배포·공유 | A | Day 10~11 |

---

## 1. 역할 분담

| 담당 | 이름 | 범위 | 기획서 기능 | 폴더 |
|---|---|---|---|---|
| **A. 인식·플랫폼 (팀장)** | ______ | 카메라·권한, 세로 레이아웃·회전·화면 꺼짐 방지, MediaPipe 얼굴·손 인식, 좌표 변환·떨림 보정, 성능 자동 조절, 메인 루프, 배포 | F-01, F-02, F-03, F-13 | `src/perception/` `src/platform/` `src/main.ts` |
| **B. 얼굴 렌더링** | ______ | WebGL 비디오 출력, 부기 셰이더, 부기 위치 고정·병합, 결과 화면 캡처 | F-07, F-12 | `src/render/` |
| **C. 게임플레이** | ______ | 모기 이동·상태, 피할 수 없음 보장, 잡기 판정(손·탭), 피 효과·분열, HUD, 사운드 | F-04~F-06, F-08~F-11 | `src/game/` `src/ui/` |

**원칙**
- 자기 폴더 밖 파일은 수정하지 않는다. 필요하면 담당자에게 요청한다.
- `src/shared/` 는 공동 소유다. 수정하려면 **3명 모두 동의**를 받는다.
- A는 초기 작업이 끝나면 **실기기 테스트·통합 담당**을 겸한다.

---

## 2. 개인 환경 설치 (전원)

### 2-1. 설치 목록
1. **GitHub 가입** — github.com. 아이디를 팀 채팅에 공유한다.
2. **Git**
   - Mac: 터미널에서 `git --version` → 설치 창이 뜨면 설치
   - Windows: git-scm.com 에서 설치, 옵션은 전부 기본값
3. **Node.js** — nodejs.org. **팀 전원 같은 메이저 버전**으로 맞춘다 (현재 팀 기준: `v26`)
4. **Cursor** — cursor.com 설치 후 로그인

### 2-2. 설치 확인
Cursor에서 `` Ctrl+` `` 로 터미널을 열고 입력한다.
```bash
git --version
node -v
npm -v
```
세 줄 모두 버전이 나오면 성공. 에러가 나면 Cursor를 완전히 종료 후 다시 연다.
`(base)` 같은 표시가 앞에 붙어 있어도 상관없다 (Anaconda 표시).

### 2-3. Git 사용자 등록 (한 번만)
```bash
git config --global user.name "본인이름"
git config --global user.email "GitHub가입이메일"
```

---

## 3. 레포 만들기 (팀장 A만)

1. GitHub 우측 상단 `+` → **New repository**
   - 이름: `mosquito`
   - **Private**
   - **Add a README file** 체크
   - **.gitignore → Node** 선택
2. 레포 → **Settings → Collaborators → Add people** → B, C 초대
3. 레포 초록색 **Code** 버튼 → HTTPS 주소 복사
4. Cursor에서 `Cmd/Ctrl+Shift+P` → `Git: Clone` → 주소 붙여넣기 → 폴더 선택 → Open
5. 터미널에서 Vite 프로젝트 생성
   ```bash
   npm create vite@latest . -- --template vanilla-ts
   ```
   - `Current directory is not empty` → **↓ 방향키**로 `Ignore files and continue` 선택 후 Enter
     (Enter만 누르면 기본값인 Cancel이 선택돼 취소된다)
   - `Remove existing files` 는 **절대 선택하지 않는다**
   - `Use rolldown-vite?` → No
   - `Install with npm and start now?` → Yes (No를 고르면 아래 두 명령을 직접 실행)
   ```bash
   npm install
   npm run dev
   ```
   `http://localhost:5173` 에서 Vite 화면이 보이면 성공. 터미널에서 `Ctrl+C`로 종료.
6. `docs/product-spec.md` 로 기획서, `docs/team-guide.md` 로 이 문서를 넣는다.
7. 왼쪽 **Source Control**(가지 아이콘) → 메시지 `chore: 프로젝트 초기 설정` → **Commit** → **Sync Changes**
8. GitHub 페이지를 새로고침해 파일이 올라갔는지 확인

---

## 4. 레포 참여 (B, C)

1. 이메일로 온 초대 **수락** (안 하면 레포가 안 보인다)
2. 3장 3~4번처럼 clone
3. 터미널에서
   ```bash
   npm install
   npm run dev
   ```
   clone할 때마다 `npm install` 이 필요하다 (`node_modules` 는 GitHub에 안 올라간다).

---

## 5. 협업 연습 (전원, 오늘 필수)

1. Cursor 왼쪽 아래 `main` 클릭 → **Create new branch** → `practice/본인이름`
2. `README.md` 맨 아래에 `- 이름: 담당 파트` 한 줄 추가
3. Source Control → 커밋 → **Publish Branch**
4. GitHub의 노란 배너 **Compare & pull request** → **Create pull request**
5. 다른 팀원이 PR → **Files changed** 확인 → **Merge pull request**
6. 각자 `main` 으로 전환 → **Sync** → 남이 쓴 줄이 보이면 성공

세 명이 같은 줄을 고치면 **충돌**이 난다. 연습 때 한 번 겪어보는 것이 좋다 (9장 참고).

---

## 6. Day 0 — 공통 뼈대 (전원 같이, 반나절)

**Day 0 결과물이 이후 병렬 개발의 전제다. 이게 끝나기 전에는 각자 기능 개발을 시작하지 않는다.**

### 6-1. 폴더 구조
```
mosquito/
├─ docs/
│  ├─ product-spec.md
│  └─ team-guide.md
├─ public/
│  ├─ models/            # face_landmarker.task, hand_landmarker.task
│  └─ replays/           # 녹화 데이터 (clip1.json ...)
├─ src/
│  ├─ main.ts            # 메인 루프 (A)
│  ├─ shared/            # 공동 소유 — 합의 후 수정
│  │  ├─ types.ts
│  │  └─ units.ts
│  ├─ perception/        # A
│  ├─ platform/          # A
│  ├─ render/            # B
│  │  └─ config.ts
│  ├─ game/              # C
│  │  └─ config.ts
│  └─ ui/                # C
├─ .cursor/rules/
└─ .github/pull_request_template.md
```

### 6-2. 공유 타입 `src/shared/types.ts`
세 파트를 잇는 **계약서**다. 여기 적힌 형태로만 데이터를 주고받는다.
```ts
/** 화면 px 좌표. 거울 반전 완료 상태. */
export type Vec2 = { x: number; y: number };

export interface FaceFrame {
  visible: boolean;
  landmarks: Vec2[];      // 478개, 평활화 완료
  faceW: number;          // 양 광대 사이 거리 (px) — 모든 길이의 기준 단위
  velocity: Vec2;         // px/s
  rotation: number;       // 화면 평면 내 회전 (rad)
  t: number;              // ms
}

export interface HandFrame {
  palm: Vec2;
  palmR: number;          // px
  velocity: Vec2;         // px/s
  grip: number;           // 손끝~손목 평균거리 / |p0-p9|
  confidence: number;     // 0~1
}

export interface FrameInput {
  face: FaceFrame;
  hands: HandFrame[];     // 0~2개
  taps: Vec2[];           // 이번 프레임 화면 탭 위치
  dt: number;             // ms, 최대 50으로 제한
  viewport: { w: number; h: number };
  hasNewDetection: boolean; // 이번 프레임에 인식이 실제로 돌았는지
}

export interface Bite {
  anchorIdx: number;      // 얼굴 랜드마크 인덱스
  localOffset: Vec2;      // faceW 단위, 얼굴 회전 기준 로컬 좌표
  radius: number;         // faceW 단위
  strength: number;       // 현재 세기 0~0.6
  targetStrength: number;
}

export interface GameStats {
  bites: number;
  kills: number;
  mosquitoCount: number;
  startedAt: number;
}
```

**데이터 흐름**
```
A (perception) ──FrameInput──▶ C (game) ──Bite[]──▶ B (render)
       └──────────FaceFrame────────────────────────▶ B
```

### 6-3. 메인 루프 골격 `src/main.ts` (A가 작성, 전원 리뷰)
렌더링과 인식을 분리한다. 인식은 새 카메라 프레임이 있을 때만, 손은 N프레임마다 돈다.
```ts
function loop(now: number) {
  const input = perception.update(now);   // A: 인식 or 직전 결과 외삽
  const bites = game.update(input);       // C: 모기·잡기·분열 → Bite[] 반환
  renderer.draw(input.face, bites);       // B: 비디오 + 부기
  game.drawOverlay(ctx2d);                // C: 모기·파티클·HUD
  debug.draw(input);                      // A: ?debug=1 일 때만
  requestAnimationFrame(loop);
}
```
Day 0에는 세 모듈을 전부 **빈 함수(스텁)** 로 두고, 화면이 뜨는 것까지만 확인한다.

### 6-4. 녹화 리플레이 (A, Day 0 최우선)
- A가 폰으로 30초 동안 얼굴 움직임·손 휘두르기를 하며 `FaceFrame/HandFrame` 을 JSON으로 저장 → `public/replays/clip1.json`
- 같은 장면의 영상도 `clip1.mp4` 로 저장
- `?replay=clip1` 로 접속하면 카메라 대신 이 데이터로 동작하게 만든다
- **B와 C는 이 리플레이로 개발한다.** 카메라나 A의 진행 상황을 기다릴 필요가 없다.

### 6-5. 디버그 모드 `?debug=1`
화면 구석에 표시한다.
- 렌더 fps / 인식 횟수/s / 얼굴 추론 ms / 손 추론 ms
- 랜드마크 점, 손바닥 원, 모기 상태 글자

### 6-6. Cursor 규칙 파일
`.cursor/rules/` 에 만든다. Cursor AI가 매번 자동으로 읽는다.

**`.cursor/rules/common.mdc`**
```
---
description: 프로젝트 공통 규칙
alwaysApply: true
---
- TypeScript strict 모드. any 금지.
- 기능 요구사항은 docs/product-spec.md 를 따른다. 작업 전 해당 기능 ID(F-xx)를 읽는다.
- src/shared/ 파일은 절대 수정하지 않는다. 변경이 필요하면 제안만 한다.
- 좌표는 거울 반전이 끝난 화면 px. 길이·속도는 faceW 단위로 계산한다.
- 튜닝 수치는 각 폴더의 config.ts 에만 둔다. 코드에 숫자를 직접 쓰지 않는다.
- localStorage 등 브라우저 저장소와 서버 전송을 사용하지 않는다. 카메라 영상은 기기 밖으로 보내지 않는다.
- 새 라이브러리 설치는 제안만 하고 직접 설치하지 않는다.
```

**`.cursor/rules/part-render.mdc`** (B용, A·C도 같은 형식으로 각자 작성)
```
---
description: 얼굴 렌더링 파트 규칙
globs: src/render/**
alwaysApply: false
---
- 이 작업에서는 src/render/ 안의 파일만 생성·수정한다.
- WebGL2 사용. 캔버스는 카메라 해상도 이하로 렌더하고 CSS로 확대한다.
- 부기 uniform 최대 32개. 초과 시 가장 가까운 두 개를 병합한다.
```

### 6-7. PR 템플릿 `.github/pull_request_template.md`
```markdown
## 기능 ID
F-

## 한 일

## 완료 조건 체크 (기획서에서 복사)
- [ ]

## 실기기 확인
- [ ] iPhone 세로
- [ ] Android 세로
- [ ] 프리뷰 URL:

## 다른 파트에 영향
없음 / 있음(내용):
```

### 6-8. Vercel 연결 (A)
1. vercel.com → GitHub로 로그인 → **Add New Project** → `mosquito` 레포 Import → Deploy
2. 이후 **PR을 올릴 때마다 프리뷰 URL이 자동 생성**된다 (HTTPS라서 폰 카메라가 열린다)
3. 레포가 Private이면 팀원에게도 Vercel 팀 권한이 필요할 수 있다 → 프리뷰가 안 열리면 A에게 말한다

Day 0 끝 기준: **셋 다 main을 받아서 `?replay=clip1&debug=1` 이 폰의 Vercel 주소에서 열린다.**

---

## 7. 매일 작업 흐름

### 7-1. 작업 시작
```bash
git switch main
git pull
git switch -c feat/F-07-bulge      # 브랜치 이름: 종류/기능ID-짧은설명
npm install                         # package.json 이 바뀌었을 수 있으므로
npm run dev
```
Cursor 화면으로도 가능하다: 왼쪽 아래 브랜치 이름 클릭 → main 선택 → Sync → Create new branch

**브랜치 이름 규칙**
| 접두어 | 용도 |
|---|---|
| `feat/` | 기능 구현 |
| `fix/` | 버그 수정 |
| `chore/` | 설정·문서 |

### 7-2. Cursor로 구현하기
1. `Cmd/Ctrl+L` → 채팅창 → **Agent** 모드
2. 프롬프트는 **기능 1개씩**, 기획서를 지정해서 준다
   ```
   @product-spec.md 의 F-10(분열)을 src/game/ 에 구현해줘.
   - 입력: @types.ts 의 FrameInput
   - 완료 조건을 전부 만족해야 함
   - 분열 로직은 순수 함수로 분리하고 Vitest 테스트도 작성
   - src/game/ 밖은 수정하지 마
   ```
3. **Accept 전에 변경 파일 목록을 확인한다.** 자기 폴더 밖 파일이 있으면 Reject.
4. 이해 안 되는 코드는 선택 후 `Cmd/Ctrl+L` → "이 코드 설명해줘"
5. 브라우저에서 직접 동작 확인 (리플레이 → 실제 카메라 순)

**단축키**
| 키 | 기능 |
|---|---|
| `Cmd/Ctrl+L` | AI 채팅 (Agent) |
| `Cmd/Ctrl+K` | 선택한 코드만 AI로 수정 |
| `Tab` | 자동완성 수락 |
| `` Ctrl+` `` | 터미널 |

### 7-3. 저장·업로드
- **자주 커밋한다** (의미 있는 단위마다, 하루 여러 번)
- 커밋 메시지 형식: `feat(F-07): 부기 병합 규칙 구현` / `fix(F-08): 탭 좌표 반전 오류 수정`
- Source Control → 메시지 → Commit → Sync(또는 Publish Branch)

### 7-4. PR과 머지
1. GitHub에서 **Pull request** 생성 → 템플릿 채우기
2. **리뷰어 1명 지정** — 다른 파트 사람
3. 리뷰어가 할 일
   - Vercel 프리뷰 URL을 **자기 폰에서 세로로** 열어 완료 조건 확인
   - Files changed에서 담당 폴더 밖 수정이 없는지 확인
   - 문제 없으면 **Approve → Merge**, 있으면 코멘트
4. 머지 후 브랜치 삭제 (GitHub의 Delete branch 버튼)
5. 전원 `main` 으로 가서 Sync

**머지 규칙**
- main에 직접 커밋·푸시 금지 (무료 Private 레포는 강제 설정이 제한될 수 있어 **팀 약속**으로 지킨다)
- 리뷰 없이 자기 PR 머지 금지
- PR은 작게. 하나의 PR = 하나의 기능 ID
- PR이 하루 넘게 방치되지 않게 리뷰는 당일 처리

### 7-5. 작업 중 main이 바뀌었을 때
```bash
git switch main
git pull
git switch feat/F-07-bulge
git merge main
```
충돌이 나면 9장.

---

## 8. 일정

| 날짜 | A 인식·플랫폼 | B 렌더링 | C 게임플레이 |
|---|---|---|---|
| **Day 0** | 전원: 6장 전체 | | |
| Day 1–3 | F-01 세로 화면·권한, F-02, F-03 실시간 연결, 성능 측정 | WebGL 비디오 출력, 부기 1개 셰이더 | F-04 추적 비행, F-06 상태 머신 (리플레이 기반) |
| **Day 4 통합 1** | 전원: 실기기에서 인식 → 추적 → 물림 → 부기까지 연결 | | |
| Day 5–8 | 성능 자동 조절, 회전·화면 꺼짐 방지, 탭 입력 전달 | 부기 위치 고정·병합, 32개 처리, 등장 애니메이션 | F-05, F-08, F-09, F-10, HUD |
| **Day 9 통합 2** | 전원: iPhone·Android·카톡 인앱 전수 테스트, 버그 분배 | | |
| Day 10–11 | OG 태그, 정식 배포, 버그 수정 | F-12 결과 화면·캡처 | 사운드, 수치 튜닝 |

### 성능 관문 (Day 1–3, A 주도 · 통과 못 하면 다음 단계 진행 보류)
`?debug=1` 로 iPhone 1대, Android 중급기 1대에서 측정한다.

| 항목 | 기준 |
|---|---|
| 렌더 fps | 30 이상 |
| 인식 횟수/s | 15 이상 |
| 5분 연속 후 렌더 fps | 20 이상 (발열 확인) |

미달 시 조정 순서
1. 손 인식 간격 늘리기 (2 → 3프레임), 모바일은 `numHands: 1`
2. WebGL 캔버스 해상도 낮추기 (카메라 해상도 이하, CSS로 확대)
3. 부기 최대 개수 32 → 16
4. 손 인식 끄고 탭 입력으로 전환

GPU 가속이 실패해 CPU로 넘어가는지 iPhone에서 반드시 확인한다.

### 통합일 진행 방식
1. 셋 다 최신 main으로 Sync
2. 한 폰으로 처음부터 끝까지 플레이
3. 발견한 문제를 GitHub **Issues** 에 등록 (제목에 기능 ID, 재현 방법, 기기)
4. 담당자 지정 후 각자 해결 → PR

---

## 9. 자주 겪는 문제

| 증상 | 원인 | 해결 |
|---|---|---|
| `Operation cancelled` (Vite 생성 시) | 선택지에서 Enter만 눌러 Cancel 선택 | 방향키로 `Ignore files and continue` 선택 |
| `command not found: node` | 설치 후 터미널 미갱신 | Cursor 완전 종료 후 재실행 |
| `Cannot find module ...` | 라이브러리 미설치 | `npm install` |
| push 거절 (`rejected`, `fetch first`) | 원격에 내가 모르는 변경이 있음 | Sync 또는 `git pull` 후 다시 push |
| 충돌 (`CONFLICT`) | 같은 줄을 두 명이 수정 | Cursor에서 충돌 파일 열기 → `Accept Current / Incoming / Both` 중 선택 → 저장 → 커밋. 모르겠으면 **해당 파일 담당자와 같이** 해결 |
| 레포가 안 보임 | 초대 미수락 | 이메일에서 수락 |
| 폰에서 카메라가 안 열림 | HTTP 주소로 접속 | Vercel 프리뷰(HTTPS) 주소 사용 |
| 카톡에서 카메라가 안 열림 | 인앱 브라우저 제한 | 우측 메뉴 → 다른 브라우저로 열기 |
| 실수로 main에 커밋함 | — | push 전이면 팀 채팅에 알리고 같이 되돌린다. 혼자 `reset` 하지 않는다 |
| AI가 다른 폴더 파일을 수정함 | 규칙 무시 | Reject 후 프롬프트에 "src/xxx/ 밖은 수정 금지" 다시 명시 |

**하지 말 것**
- `git push --force`
- `rm -rf` 같은 삭제 명령을 AI가 제안했을 때 그대로 실행
- `.env`, 개인 키, 개인 영상을 커밋
- `node_modules` 커밋 (`.gitignore` 에 있으니 건드리지 않으면 된다)

---

## 10. 소통 규칙

- **매일 1회 짧은 공유** (채팅 3줄): 어제 한 것 / 오늘 할 것 / 막힌 것
- `shared/types.ts` 변경 제안은 채팅에 먼저 올리고 3명 동의 후 PR
- 다른 파트 코드가 필요하면 직접 고치지 말고 **Issue 또는 채팅으로 요청**
- 1시간 넘게 막히면 혼자 붙잡지 말고 공유

---

## 11. 체크리스트

### 오늘
- [ ] 전원: Git·Node(v26)·Cursor 설치, `git config` 등록
- [ ] A: 레포 생성, 팀원 초대, Vite 프로젝트 생성, 기획서·이 문서 업로드
- [ ] B, C: 초대 수락, clone, `npm install`, `npm run dev`
- [ ] 전원: 협업 연습(5장) 1회 완료

### Day 0
- [ ] 폴더 구조 생성
- [ ] `shared/types.ts` 3명 합의
- [ ] `main.ts` 스텁 루프 동작
- [ ] 리플레이 `clip1` 녹화 + `?replay=` 동작
- [ ] `?debug=1` 동작
- [ ] Cursor 규칙 파일 4개 (공통 + 파트 3개)
- [ ] PR 템플릿
- [ ] Vercel 연결, 폰에서 프리뷰 URL 접속 확인
