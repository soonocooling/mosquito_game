# 모기 피하기 (못 함) — 제품·구현 명세

> **v1.0 · 2026-09-15.** 기획서의 "확인 필요" 항목을 전부 확정하고 구현 상세를 합친 완성본.
> 기능의 단일 기준은 이 문서, 협업 절차·역할·일정은 `docs/team-guide.md`. 충돌하면 기능은 이 문서, 절차는 team-guide가 우선.
> Cursor에 시킬 때는 `@product-spec.md 의 F-xx` 한 기능씩. 각 기능은 **동작 → 담당·위치 → 입력/출력 → 세부 요구사항 → 완료 조건** 순서다.
> 표기: [명시] 사용자가 직접 요구 · [추론] 요구에서 유도 · [결정] 이 문서에서 확정.

---

## 1. 한 줄 소개
링크를 받은 친구가 웹캠 앞에서 모기를 피하려 발버둥 치다 얼굴이 퉁퉁 부어버리는, 절대 이길 수 없는 모션 인식 웹 게임.

## 2. 사용자와 사용 맥락
- 주 사용자: 링크를 전달받은 친구 (사전 설명 없이 첫 진입)
- 사용 빈도·시점: 1회성, 1~3분 플레이. 메신저에서 링크 클릭 직후
- 사용 환경: **스마트폰 세로 화면 + 전면 카메라가 1순위** [명시], 노트북/데스크톱 웹캠 2순위. 브라우저 단독 동작, 1인 플레이
- 모바일 자세: 한 손으로 폰을 들거나 거치한 상태. 폰을 든 경우 잡기에 쓸 수 있는 손은 1개 [추론]
- 사용자 수 규모: 동시 접속 제한 없음 — 모든 연산이 사용자 기기에서 수행되므로 서버 부하가 없다 [추론]
- 지원 최저선 [결정]: iOS 15 Safari, Android Chrome 90, 데스크톱 Chrome·Edge·Safari 최근 2년. 그 아래는 F-14가 안내 문구로 막는다

## 3. 화면 구조

```
S-1 랜딩 ──(시작 → 카메라 권한)──▶ S-3 로딩 ──▶ S-4 게임 ──(그만하기)──▶ S-5 결과
  │                                            ▲                       │
  ├──(권한 거부 / 카메라 없음 / 오류)──▶ S-2 안내 ──(재시도)──┘                       └──(다시 하기)──▶ S-4
  └──(F-14: 미지원 기기 / 인앱 브라우저)──▶ S-2 안내
```

| 화면 | 내용 | 담당·위치 |
|---|---|---|
| S-1 랜딩 | 제목, 한 줄 설명("모기를 피해봐"), "영상은 서버로 전송되지 않음" 한 줄, 시작 버튼. 진입 즉시 F-14 지원 감지 → 미지원이면 시작 버튼 대신 안내 | A `src/platform/screens.ts` |
| S-2 안내 | 원인별 문구 4종: 권한 거부 / 카메라 없음 / 인앱 브라우저 / 기타 오류. 재시도 버튼(인앱은 "외부 브라우저로 열기" + URL 복사) | A |
| S-3 로딩 | 4단계 진행률: WASM → 얼굴 모델 → 손 모델 → warm-up | A |
| S-4 게임 | 하단 GL 캔버스(거울 영상 + 부기) + 상단 오버레이 캔버스(모기·파티클) + HUD DOM. 세로 9:16 기준 | B `src/render/`, C `src/game/`, C `src/ui/hud.ts` |
| S-R 회전 안내 | 모바일에서 가로로 돌리면 오버레이 + 일시정지, 세로 복귀 시 재개 | A |
| S-5 결과 | 최종 통계 + 부어오른 얼굴 마지막 프레임 이미지, 저장·다시 하기 | C `src/ui/result.ts` (이미지는 B `renderer.capture()`) |

## 4. 확정 결정사항

| # | 항목 | 결정 | 근거 |
|---|---|---|---|
| 1 | 인식 기술 | 브라우저에서 MediaPipe Tasks Vision (Face Landmarker 478점 + Hand Landmarker 21점). OpenCV 미사용 | 부기 고정과 손 판정 모두 랜드마크가 필요. 부록 A |
| 2 | 잡기 판정 | 스윙 · 박수 · 움켜쥐기 + 화면 탭 4종 모두 인정 | 폰을 든 상태와 거치 상태를 모두 커버 |
| 3 | 모기 증가 | 분열로만 증가 | 잡는 사용자가 스스로 대란을 만드는 구조가 핵심 재미 |
| 4 | 종료 조건 | 무한 진행, "그만하기" 버튼으로 결과 화면 | 1~3분 플레이에 맞춤 |
| 5 | 렌더링 상한 | 데스크톱 200 / 모바일 120 마리. F-15가 80까지 낮출 수 있음 | 저사양 기기 기준 |
| 6 | 모바일 입력 | 빈 손 스윙·움켜쥐기 + 화면 탭 병행 | 폰을 든 손 엄지로 탭 |
| 7 | 부기 회복 | 없음. 게임 중 줄어들지 않고 "다시 하기"에서만 초기화 | 누적이 결과 화면의 핵심 |
| 8 | 부기 소유권 | C(game)는 `BiteEvent`만 발생시키고, B(render)가 `Bite` 저장소(변환·병합·상한·애니메이션)를 소유 | 병합·32개 상한이 셰이더 제약과 묶여 있음 |
| 9 | 캔버스 해상도 | GL 캔버스 내부 해상도는 카메라 스트림 해상도 이하, CSS로 확대. 오버레이는 CSS px × min(DPR, 2) | 부기 셰이더 비용 절감 |
| 10 | 제품명 | 가칭 "모기 피하기 (못 함)" 유지. 바꿀 때는 `index.html`의 `<title>`·`og:title`과 S-1 제목 세 곳만 수정 | — |
| 11 | 도구 버전 | Node 팀 공통 v26, `@mediapipe/tasks-vision` 0.10 계열 최신으로 설치 후 `^` 제거해 고정 | team-guide 2장 |
| 12 | 광택 하이라이트 | 부기 가장자리 광택은 v1.1로 미룸 | 난이도 대비 효과 작음 |

---

## 5. 공통 규약 (전 파트 공통 — 위반하면 통합일에 터진다)

### 5.1 단위와 좌표계
- **길이 단위 `faceW`**: `|lm[234] − lm[454]|` (좌우 얼굴 가장자리 거리, px). 모기 속도·반경, 부기 반경, 손 속도 임계값 등 **모든 길이·속도 상수는 faceW 배수**로 정의하고 사용 시 faceW를 곱한다. 카메라 거리와 무관하게 같은 체감을 위해서다.
- **시간 단위 ms**, 속도는 공유 타입에서 px/s로 전달하고 소비자가 faceW로 나눈다.
- **좌표 파이프라인**: 비디오 정규화 좌표(0~1, 카메라 원본 방향) → 거울 반전 → cover 크롭 → **화면 CSS px** (`(0,0)` = 좌상단). 이 변환은 `src/perception/mapper.ts` 하나에서만 하고, 정규화 좌표는 `perception/` 밖으로 나가지 않는다. CSS `transform: scaleX(-1)`은 어디에도 쓰지 않는다(이중 반전 사고 방지).

```ts
// src/perception/mapper.ts (A)
import type { Vec2 } from '../shared/types';
export interface Mapper {
  s: number; ox: number; oy: number; vw: number; vh: number;
  toScreen(nx: number, ny: number, out: Vec2): Vec2;
}
export function makeMapper(vw: number, vh: number, W: number, H: number): Mapper {
  const s = Math.max(W / vw, H / vh);            // cover: 짧은 쪽을 화면에 맞추고 긴 쪽을 잘라냄
  const ox = (W - vw * s) / 2, oy = (H - vh * s) / 2;
  return {
    s, ox, oy, vw, vh,
    toScreen(nx, ny, out) { out.x = (1 - nx) * vw * s + ox; out.y = ny * vh * s + oy; return out; }, // 1-nx = 거울
  };
}
```
- `vw/vh`는 `video.videoWidth/videoHeight`를 `loadedmetadata` 이후에 읽고, `resize`·`orientationchange`마다 다시 읽는다(iOS는 값이 바뀐다).
- **캔버스 두 장** 모두 `position:fixed; inset:0; width:100vw; height:100dvh`. GL 캔버스 내부 해상도 = `min(카메라 해상도, CSS px × DPR) × glScale`(결정 9, F-15). 오버레이 내부 해상도 = CSS px × min(DPR, 2), `ctx.scale(dpr, dpr)` 후 CSS px로 그린다. **게임 로직은 CSS px로만** 한다.
- **셰이더 uv 규약**: 화면 uv = `(x / W, y / H)`, `(0,0)` 좌상단. 부기 반경은 `px / H`(높이 기준)로 넘기고 셰이더에서 x에 `uAspect = W / H`를 곱해 원형을 유지한다. 화면 uv → 비디오 uv 변환과 거울 반전은 셰이더 안에서 한다(부록 B).

### 5.2 공유 타입 `src/shared/types.ts` (공동 소유 — 변경은 3인 동의 후 PR)
```ts
/** 화면 CSS px 좌표. 거울 반전·cover 크롭 완료 상태. (0,0) = 화면 좌상단 */
export type Vec2 = { x: number; y: number };

export interface FaceFrame {
  visible: boolean;       // 500 ms 이상 미검출이면 false
  landmarks: Vec2[];      // 478개, One Euro 평활 완료. 첫 검출 전에는 길이 0. 배열·객체는 재사용(매 프레임 새로 만들지 않음)
  faceW: number;          // |lm[234] − lm[454]| px. 첫 검출 전에는 viewport.w × 0.35
  rotation: number;       // 화면 평면 회전 rad. lm[33] → lm[263] 방향의 atan2
  velocity: Vec2;         // 코끝(lm[1]) 최근 100 ms 이동평균 px/s. visible=false면 (0,0)
  t: number;              // 마지막 검출 시각 ms (performance.now 기준)
}

export interface HandFrame {
  side: 'Left' | 'Right'; // 프레임 간 동일성 식별용. 라벨이 물리적으로 맞는지는 쓰지 않는다
  palm: Vec2;             // 랜드마크 0,5,9,13,17 평균
  palmR: number;          // |p0 − p9| × 0.8 (px)
  velocity: Vec2;         // 최근 100 ms 이동평균 px/s. 200 ms 이상 끊겼다 재검출되면 (0,0)
  grip: number;           // 손끝(4,8,12,16,20)~손목(0) 평균 거리 / |p0 − p9|
  confidence: number;     // 0~1. 0.5 미만은 perception이 걸러서 내보내지 않는다
  t: number;              // 이 손 데이터가 실제 갱신된 시각 ms. 같은 t가 반복되면 새 검출이 아님
}

export interface FrameInput {
  face: FaceFrame;
  hands: HandFrame[];     // 0~2개
  taps: Vec2[];           // 이번 프레임에 발생한 pointerdown 화면 좌표 (platform이 수집)
  now: number;            // ms
  dt: number;             // ms, 최대 50으로 제한
  viewport: { w: number; h: number };   // CSS px
  hasNewDetection: boolean;             // 이번 프레임에 얼굴 인식이 실제로 돌았는지
}

/** C → B. 모기가 문 순간 1건 */
export interface BiteEvent {
  anchorIdx: number;      // 물린 랜드마크 인덱스
  pos: Vec2;              // 물린 순간 모기 화면 좌표. B가 얼굴 로컬 오프셋으로 변환해 저장한다
  t: number;
}

export interface GameOutput {
  biteEvents: BiteEvent[]; // 이번 프레임에 발생한 물림 (보통 0~1개). 재사용 배열
  shake: boolean;          // true면 ui가 화면 흔들림 80 ms 재생
}

/** B 내부 저장소의 요소. 디버그 표시용으로만 공유. B 외에는 읽기만 한다 */
export interface Bite {
  anchorIdx: number;
  localOffset: Vec2;      // faceW 단위, 얼굴 회전(rotation) 기준 로컬 좌표
  radius: number;         // faceW 단위 (0.12 → 최대 0.5)
  strength: number;       // 현재 세기 (애니메이션 중 값)
  targetStrength: number; // 0.25 → 최대 0.6
  createdAt: number;      // ms. 600 ms 등장 애니메이션 기준
}

export interface GameStats { bites: number; kills: number; mosquitoCount: number; startedAt: number; }

/** F-15가 정하는 품질 단계. main.ts가 각 파트의 setQuality로 밀어넣는다 */
export interface Quality {
  level: number;          // 0 = 최고. 커질수록 하향
  handEvery: 1 | 2 | 3;   // 손 추론 프레임 간격 (A)
  numHands: 1 | 2;        // (A)
  detectScale: number;    // 인식 입력 축소 배율 1 | 0.66 | 0.5 (A)
  glScale: number;        // GL 캔버스 해상도 배율 1 | 0.75 | 0.5 (B)
  maxBites: 32 | 16;      // 부기 uniform 상한 (B)
  mosquitoCap: number;    // 모기 엔티티 상한 (C)
  handsEnabled: boolean;  // false면 손 추론 중단, 탭만 인정 (A, C)
}

/** 모듈 인터페이스 — main.ts(A)는 이 형태로만 호출한다. Day 0에는 전부 스텁 */
export interface Perception {
  load(onProgress: (stage: 'wasm' | 'face' | 'hand' | 'warmup', ratio: number) => void): Promise<void>;
  attach(video: HTMLVideoElement, viewport: { w: number; h: number }): void;  // 스트림 준비 후, 그리고 resize마다
  update(now: number): FrameInput;
  setQuality(q: Quality): void;
}
export interface Game {
  onUserGesture(): void;                 // 시작 버튼 핸들러 안에서 호출 → AudioContext 생성/resume
  update(input: FrameInput): GameOutput;
  drawOverlay(ctx: CanvasRenderingContext2D, viewport: { w: number; h: number }): void;
  reset(): void;                         // 다시 하기
  readonly stats: GameStats;
  setQuality(q: Quality): void;
  setMuted(m: boolean): void;
  pause(p: boolean): void;               // 소리 정지, 손 이력 초기화
}
export interface Renderer {
  resize(viewport: { w: number; h: number }, video: { w: number; h: number }, dpr: number): void;
  draw(face: FaceFrame, events: BiteEvent[]): void;      // 부기 저장소 갱신 + 비디오·부기 렌더
  capture(overlay: HTMLCanvasElement): HTMLCanvasElement; // draw 직후 같은 프레임에서만 유효
  reset(): void;
  setQuality(q: Quality): void;
  readonly bites: ReadonlyArray<Bite>;   // 디버그 표시용
}
```
team-guide 6-2 대비 바뀐 점: `BiteEvent`·`GameOutput`·`Quality`·모듈 인터페이스 추가, `HandFrame.side`·`HandFrame.t`·`FrameInput.now`·`Bite.createdAt` 추가, `FaceFrame.landmarks` 첫 검출 전 규칙 명시. Day 0에 이 버전으로 합의한다.

### 5.3 데이터 흐름과 메인 루프 `src/main.ts` (A 작성, 전원 리뷰)
```
A perception ──FrameInput──▶ C game ──GameOutput(BiteEvent[])──▶ B renderer(부기 저장소)
       └──────────FaceFrame──────────────────────────────────────▶ B
A perf ──Quality──▶ A perception · B renderer · C game
```
```ts
function loop(now: number) {
  if (paused) return;
  const input = perception.update(now);            // A: 새 카메라 프레임이면 인식, 아니면 직전 결과 외삽
  const out = game.update(input);                  // C: 모기·잡기·분열 → 물림 이벤트
  renderer.draw(input.face, out.biteEvents);       // B: 부기 저장소 갱신 + 비디오·부기 렌더
  overlayCtx.clearRect(0, 0, viewport.w, viewport.h);
  game.drawOverlay(overlayCtx, viewport);          // C: 모기·파티클
  if (out.shake) ui.shake();                       // C(ui): #stage에 80 ms transform
  hud.update(game.stats, now);                     // C(ui)
  if (captureRequested) { resultImage = renderer.capture(overlayCanvas); captureRequested = false; showResult(); return; }
  perf.tick(now);                                  // A: F-15
  debug.draw(input, renderer.bites);               // A: ?debug=1 일 때만
  requestAnimationFrame(loop);
}
```
- 인식은 새 비디오 프레임이 있을 때만(`video.currentTime` 변화), 손은 `handEvery` 프레임마다. 렌더는 매 rAF.
- `dt = min(now − prev, 50)`. 탭 복귀 순간 모기가 화면 밖으로 튀는 것을 막는다.

### 5.4 얼굴 랜드마크 인덱스 (MediaPipe Face Landmarker 478점)
| 용도 | 인덱스 | 비고 |
|---|---|---|
| faceW | 234, 454 | 좌우 얼굴 가장자리 |
| 회전 | 33 → 263 | 양 눈 바깥쪽 |
| 얼굴 속도 | 1 | 코끝 |
| 물기 앵커 후보 | 10 이마, 1 코끝, 152 턱, 50/280 좌우 볼, 105/334 좌우 눈썹, 0 윗입술 | **Day 1에 `?debug=1`로 실측 후 `src/game/config.ts`의 `ANCHOR_IDS`로 확정.** 기획서 초안의 159/386은 윗눈꺼풀이라 눈을 무는 것처럼 보이면 105/334로 대체 |

### 5.5 상수 위치
튜닝 수치는 각 파트 `config.ts`에만 둔다. 코드에 숫자를 직접 쓰지 않는다.
- `src/perception/config.ts` (A): One Euro 파라미터, 얼굴 소실 500 ms, 손 속도 창 100 ms, 기본 Quality(데스크톱/모바일)
- `src/render/config.ts` (B): 부기 반경·세기·병합 상수, 32/16 상한, 애니메이션 600 ms, 색 계수
- `src/game/config.ts` (C): 모기 속도·가속·크기, 상태 시간, 잡기 임계값, 파티클 수, 앵커 인덱스, 사운드 게인

### 5.6 TypeScript 제약 (현재 `tsconfig.json`)
- `erasableSyntaxOnly: true` → **enum, namespace, 생성자 파라미터 프로퍼티(`constructor(private x)`) 금지.** 상태는 문자열 유니온 타입, 필드는 명시 선언.
- `verbatimModuleSyntax: true` → 타입 import는 `import type { ... }`.
- `noUnusedLocals/Parameters` → 쓰지 않는 변수는 컴파일 실패.
- Day 0에 `"strict": true`를 추가한다(team-guide 규칙 "strict 모드"가 현재 설정에는 빠져 있음). `__APP_VERSION__` 전역은 `src/global.d.ts`에 `declare const __APP_VERSION__: string;`으로 선언.

---

## 6. 기능 명세

### F-01 웹캠 입력과 세로 화면 구성  [명시]
**담당·위치**: A — `src/platform/camera.ts`, `src/platform/layout.ts`, `src/platform/screens.ts`, `index.html`
**동작**: 시작 버튼을 누르면 전면 카메라 영상이 전체 화면에 거울 모드로 표시된다.
**입력/출력**: 출력 = 재생 중인 `HTMLVideoElement`, `viewport {w,h}`, 카메라 크기 `{w,h}` → `perception.attach`, `renderer.resize`에 전달.
**세부 요구사항**:
- 시작 버튼 클릭 핸들러 **한 제스처 안에서** 순서대로: ① `game.onUserGesture()` ② `getUserMedia` ③ `video.srcObject = stream; await video.play()` ④ `navigator.wakeLock?.request('screen')`(try/catch). iOS는 이 순서를 벗어나면 카메라·오디오가 열리지 않는다.
- 제약: 모바일 `{ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 }, aspectRatio: { ideal: 9/16 } }, audio: false }`, 데스크톱 1280×720. `OverconstrainedError`면 ideal 없이 재시도.
- 오류 분기 → S-2: `NotAllowedError` 권한 거부 / `NotFoundError` 카메라 없음 / 그 외 일반 오류(메시지 표시). 재시도 버튼은 같은 핸들러를 다시 실행.
- 실제 스트림 크기는 요청과 다를 수 있으므로(iOS는 가로 크기로 반환하기도 함) 항상 `video.videoWidth/videoHeight`로 크롭·좌표 변환(5.1).
- `<video id="cam" playsinline muted autoplay>`는 화면에 보이지 않지만 DOM에 둔다: `position:fixed; width:1px; height:1px; opacity:0; pointer-events:none`. `display:none`이면 iOS가 프레임을 디코딩하지 않는다.
- `index.html`: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` (`env(safe-area-inset-*)`는 `viewport-fit=cover`가 있어야 값이 나온다), `lang="ko"`.
- 레이아웃: `body { margin:0; height:100dvh; overflow:hidden; overscroll-behavior:none; touch-action:none; }`. `#stage`가 두 캔버스의 공통 부모(화면 흔들림용).
- 방향: iOS는 화면 방향 고정 API가 없으므로 모바일(`navigator.maxTouchPoints > 0`)에서 `matchMedia('(orientation: landscape)')` 매치 시 S-R 오버레이 + `paused = true`, 세로 복귀 시 재개.
- 화면 꺼짐 방지: Wake Lock, `visibilitychange`로 visible 복귀 시 재요청.
- 탭 전환·앱 이탈(`visibilitychange` hidden) 시 일시정지(`game.pause(true)`), 복귀 시 카메라 트랙이 `ended`면 재요청.
- 얼굴 폭이 화면 폭 대비 25% 미만이면 "좀 더 가까이", 60% 초과면 "폰을 조금 멀리 — 손이 보이게" 토스트 [결정]. 3 s 이상 지속될 때만, 10 s에 1회.
- `pointerdown`을 수집해 `FrameInput.taps`로 전달(F-08 탭 판정용). 캔버스가 아닌 HUD 버튼 위 터치는 제외.
- HTTPS에서만 동작 (`getUserMedia` 제약).
**완료 조건**:
- [ ] 버튼 클릭 후 1회의 권한 팝업만 뜬다
- [ ] 사용자가 오른손을 들면 화면 오른쪽 손이 올라간다
- [ ] 권한 거부 시 S-2로 이동하고, 재시도 버튼으로 다시 요청된다
- [ ] 카메라가 없는 기기에서 S-2에 "카메라를 찾을 수 없음"이 표시된다
- [ ] iPhone Safari·Android Chrome 세로 화면에서 영상이 검은 여백·찌그러짐 없이 화면을 채운다
- [ ] `?debug=1`에서 코끝 점이 실제 코 위에 정확히 겹친다 (좌표계 검증)
- [ ] 게임 중 폰을 가로로 돌리면 모기가 멈추고 안내가 뜨며, 세로로 돌리면 그대로 이어진다
- [ ] 2분간 화면을 건드리지 않아도 화면이 꺼지지 않는다 (Wake Lock 지원 기기)

### F-02 얼굴 추적  [추론]
**담당·위치**: A — `src/perception/landmarkers.ts`, `face.ts`, `oneEuro.ts`, `mapper.ts`
**동작**: 매 프레임 얼굴의 위치와 표면 랜드마크를 추적한다. 모기의 목표 지점과 부기 위치가 모두 이 랜드마크에 고정된다.
**입력/출력**: 입력 `HTMLVideoElement` → 출력 `FaceFrame`(5.2).
**세부 요구사항**:
- 생성:
```ts
const fileset = await FilesetResolver.forVisionTasks('/wasm');   // public/wasm (node_modules/@mediapipe/tasks-vision/wasm 복사본)
const face = await FaceLandmarker.createFromOptions(fileset, {
  baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' },
  runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: false, outputFacialTransformationMatrixes: false,
});
```
  GPU 생성이 throw 하면 `delegate: 'CPU'`로 재시도하고 디버그 패널에 표시. iPhone에서 GPU가 실제로 붙는지 Day 1에 확인.
- S-3 로딩 중 빈 캔버스로 **1회 warm-up detect** (첫 추론 수백 ms 지연 제거).
- `detectForVideo(video, ts)`의 `ts`는 `performance.now()`. **단조 증가**해야 하며, `video.currentTime`이 직전과 같으면 호출하지 않는다.
- 정규화 좌표 → `mapper.toScreen` → **One Euro 필터**(점마다 x, y 각각, 478×2개 인스턴스). 시작값 `minCutoff 1.0, beta 0.01, dCutoff 1.0`, `src/perception/config.ts`에서 튜닝.
```ts
// src/perception/oneEuro.ts — erasableSyntaxOnly 때문에 파라미터 프로퍼티를 쓰지 않는다
export class OneEuro {
  private xPrev = Number.NaN; private dxPrev = 0; private tPrev = 0;
  private readonly minCutoff: number; private readonly beta: number; private readonly dCutoff: number;
  constructor(minCutoff = 1.0, beta = 0.01, dCutoff = 1.0) { this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = dCutoff; }
  reset(): void { this.xPrev = Number.NaN; this.dxPrev = 0; }
  private static alpha(cutoff: number, dt: number): number { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
  filter(x: number, t: number): number {
    if (Number.isNaN(this.xPrev)) { this.xPrev = x; this.tPrev = t; return x; }
    const dt = Math.max((t - this.tPrev) / 1000, 1e-3); this.tPrev = t;
    const dx = (x - this.xPrev) / dt;
    const dxHat = this.dxPrev + OneEuro.alpha(this.dCutoff, dt) * (dx - this.dxPrev);
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const xHat = this.xPrev + OneEuro.alpha(cutoff, dt) * (x - this.xPrev);
    this.xPrev = xHat; this.dxPrev = dxHat; return xHat;
  }
}
```
- `faceW`, `rotation`, `velocity`는 5.2·5.4 정의대로.
- 인식이 돌지 않은 프레임(`hasNewDetection=false`): 직전 랜드마크에 `velocity × dt`를 더해 외삽하되 마지막 검출 후 100 ms까지만, 그 뒤는 고정.
- 얼굴 소실(손으로 가림, 화면 밖): 마지막 자세 유지, 500 ms 넘으면 `visible=false`, `velocity=(0,0)`. HUD "얼굴 어디 갔어?"는 C가 `visible`을 보고 표시. 재검출 시 One Euro는 `reset()` 후 재시작(옛 값으로 끌려가는 것 방지). 부기는 B가 그대로 유지.
- 첫 검출 전: `landmarks = []`, `faceW = viewport.w × 0.35`, `visible=false`.
- `FaceFrame.landmarks` 배열과 각 `Vec2`는 한 번 만들어 재사용(478개 객체를 매 프레임 생성하면 GC 끊김).
**완료 조건**:
- [ ] 고개를 좌우로 45° 돌려도 코끝 마커가 코에서 벗어나지 않는다
- [ ] 손으로 얼굴을 1초 가렸다 떼도 부기가 사라지지 않는다
- [ ] 카메라에서 멀어져도 모기 크기·부기 크기가 얼굴 비율로 유지된다
- [ ] 가만히 있을 때 랜드마크 점이 눈에 띄게 떨리지 않는다 (One Euro 동작)

### F-03 손 추적  [추론]
**담당·위치**: A — `src/perception/hand.ts`
**동작**: 양손의 위치·속도·쥠 상태를 추적해 모기 잡기(F-08) 판정에 사용한다.
**입력/출력**: 출력 `HandFrame[]`(0~2개, 5.2). 200 ms 이상의 이력이 필요한 판정(박수·움켜쥐기)은 C가 `HandFrame.t`가 바뀔 때만 자기 링버퍼에 쌓아서 한다.
**세부 요구사항**:
- 생성: `HandLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: '/models/hand_landmarker.task', delegate: 'GPU' }, runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.5, minTrackingConfidence: 0.5 })`. GPU 실패 시 CPU.
- `Quality.handEvery` 프레임마다만 추론(기본 데스크톱 1, 모바일 2). `numHands`·`handsEnabled`도 Quality를 따른다.
- `palm`, `palmR`, `grip`, `confidence`(handedness score), `side`(handedness 라벨)는 5.2 정의. `confidence < 0.5`인 손은 내보내지 않는다.
- `velocity` = 최근 100 ms 손바닥 중심 이동량 / 시간. 같은 `side`가 200 ms 이상 안 보이다 재검출되면 이력을 비우고 `(0,0)`부터.
- 추론이 없는 프레임에는 직전 `HandFrame`을 `t` 그대로 다시 내보낸다(C는 `t`가 같으면 무시).
- 편 손 grip ≈ 1.8 이상, 주먹 ≈ 1.1 이하가 목표값. **Day 1에 실측해 `src/game/config.ts`의 임계값을 맞춘다.**
**완료 조건**:
- [ ] 손을 빠르게 휘두르면 `?debug=1`에서 속도 값이 1.5 faceW/s를 넘는 것이 보인다
- [ ] 손을 쥐면 grip이 1.1 아래로, 펴면 1.8 위로 간다 (미달 시 임계값 조정)
- [ ] 손이 얼굴 앞을 지나가도 얼굴 추적이 500 ms 이내 복구된다

### F-04 모기 추적 비행  [명시]
**담당·위치**: C — `src/game/mosquito.ts`, `src/game/sprites.ts`, `src/game/config.ts`
**동작**: 모기가 사용자의 얼굴을 따라다닌다. 사용자가 움직이면 경로를 바꿔 계속 쫓아온다.
**입력/출력**: 입력 `FrameInput.face`. 출력 없음(내부 상태, `drawOverlay`로 그림).
**세부 요구사항**:
- 각 모기는 앵커 후보(5.4) 중 하나를 `targetIdx`로 고르고 `targetOffset`(±0.1 faceW 랜덤, faceW 단위)을 더한 지점을 목표로 한다.
- 목표 좌표 = `lm[targetIdx] + targetOffset × faceW + face.velocity × 0.15 s`(도망가는 방향을 앞질러 감). `face.visible=false` 또는 `landmarks.length === 0`이면 화면 중앙 ± 0.5 faceW 랜덤 배회.
- 조향(매 프레임, dt초): `desired = normalize(target − pos) × maxSpeed`, `steer = clamp(desired − vel, maxAccel)`, `vel += steer × dt`, `pos += vel × dt`. `maxSpeed`는 F-05, `maxAccel = 12 faceW/s²` 시작값.
- 비행감: `pos += (sin(t×7 + seed), cos(t×5 + seed)) × 0.05 faceW`. Perlin 불필요.
- 모기끼리 겹침 방지: 거리 < 0.08 faceW인 쌍을 서로 밀어냄. 200마리 O(n²)는 감당 가능하되 루프 안에서 객체를 생성하지 않는다.
- 크기: 히트박스 반경 `mosqR = 0.06 faceW`, 그리기 몸통 길이 0.12 faceW, 날개는 2프레임 교대(매 2 rAF) [결정]. 상한 초과 시 1.5배(F-10).
- 진행 방향으로 몸통을 회전해 그린다.
**완료 조건**:
- [ ] 얼굴을 화면 왼쪽 끝으로 옮기면 모든 모기가 그쪽으로 이동한다
- [ ] 모기 50마리가 있어도 한 점에 뭉쳐 보이지 않는다
- [ ] 리플레이(`?replay=clip1`)에서 카메라 없이 동작한다

### F-05 "피할 수 없음" 보장  [명시]
**담당·위치**: C — `src/game/mosquito.ts`
**동작**: 사용자가 아무리 빨리 움직여도 모기는 결국 도달해서 문다.
**세부 요구사항**:
- `maxSpeed = 3.0 faceW/s` 기본. 목표 거리 d가 2 faceW를 넘으면 `3 + (d − 2) × 2.5`, 상한 8 faceW/s.
- 접근 시간 보장: APPROACH 상태가 4 s를 넘으면 0.3 s 동안 `maxSpeed`·`maxAccel` 상한 해제 → 사실상 즉시 도달.
- 얼굴이 화면 밖으로 나간 경우는 예외(F-02·F-04 배회 규칙).
**완료 조건**:
- [ ] 머리를 계속 좌우로 흔들어도 첫 물림이 6 s 이내 발생한다
- [ ] 가만히 있을 때보다 움직일 때 물림 간격이 2배 이상 늘어나지 않는다

### F-06 무는 동작  [명시]
**담당·위치**: C — `src/game/mosquito.ts`
**동작**: 모기가 얼굴에 착지해 잠시 붙어 있다가 물고 날아간다.
**입력/출력**: 출력 `GameOutput.biteEvents`(BITE 순간 1건), `GameOutput.shake`, `stats.bites`.
**세부 요구사항**:

| 상태 | 하는 일 | 다음 |
|---|---|---|
| APPROACH | F-04 조향으로 목표 추적 | 목표와 거리 < 0.1 faceW → LANDED |
| LANDED (0.8 s) | `pos = 목표`에 고정(얼굴과 함께 움직임), `vel = 0`. **이 동안 잡히면(F-08) 물림 없음** | 시간 종료 → BITE |
| BITE (1프레임) | `biteEvents.push({ anchorIdx, pos, t })`, `stats.bites++`, `shake = true` | FLY_OFF |
| FLY_OFF (0.6 s) | `vel` = 얼굴 중심 반대 방향 × 4 faceW/s | COOLDOWN |
| COOLDOWN (2~4 s 랜덤) | 얼굴에서 1.5~2.5 faceW 떨어진 점 주위 배회 | 새 `targetIdx` 선택 → APPROACH |
| SPAWNING (0.6 s) | 분열 직후(F-10). 무적, 반투명 깜빡임, 초기 `vel` 유지 | APPROACH |

- 화면 흔들림(80 ms)은 `ui`가 `#stage`에 `transform: translate(±3px)`로 재생 [결정].
**완료 조건**:
- [ ] 모기가 볼에 앉은 상태에서 고개를 돌리면 모기가 볼에 붙은 채 따라온다
- [ ] 물림 1회당 물린 횟수가 정확히 1 증가하고 `BiteEvent`가 정확히 1건 나간다
- [ ] LANDED 중에 치면 물림 없이 죽는다

### F-07 물린 부위 부기 필터  [명시]
**담당·위치**: B — `src/render/gl.ts`, `src/render/bites.ts`, `src/render/shaders.ts`, `src/render/config.ts`
**동작**: 물린 자리가 빨갛게 부풀어 오르고, 물릴수록 누적되어 얼굴 전체가 퉁퉁 붓는다.
**입력/출력**: 입력 `FaceFrame`, `BiteEvent[]` → 출력 GL 캔버스(거울 영상 + 부기). `renderer.bites`로 저장소 노출(디버그).
**세부 요구사항**:
- **저장**: 부기는 화면 좌표가 아니라 **랜드마크 인덱스 + 얼굴 로컬 오프셋**(`Bite`, 5.2)으로 저장 → 얼굴을 움직여도 피부에 붙어 다닌다. `BiteEvent` 수신 시 `localOffset = rotate((pos − lm[anchorIdx]) / faceW, −face.rotation)`.
- **누적 규칙**: 새 물림의 화면 좌표가 기존 부기 중심에서 `0.5 × R` 이내면 병합(`targetStrength += 0.15`, 상한 0.6; `radius ×= 1.1`, 상한 0.5 faceW). 아니면 신규 `radius 0.12 faceW, targetStrength 0.25`. 개수가 `Quality.maxBites`(32 또는 16)를 넘으면 가장 가까운 두 개를 병합.
- **등장 애니메이션**: `createdAt`부터 600 ms 동안 `strength = targetStrength × overshoot(k)`, `overshoot(k) = k < 0.5 ? 1.3 × easeOut(2k) : 1.3 − 0.3 × easeIn(2k − 1)`. 병합으로 목표가 오르면 같은 곡선을 차이분에 적용.
- **매 프레임 화면 좌표**: `center = lm[anchorIdx] + rotate(localOffset × faceW, face.rotation)`. uniform은 `[center.x / W, center.y / H, radius × faceW / H, strength]`.
- **GL 파이프라인**: `getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: false })`. 풀스크린 삼각형 1개. 비디오 텍스처는 매 프레임 `texImage2D(..., gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)`, `UNPACK_FLIP_Y_WEBGL`은 기본값(false) 유지. uniform: `uVideo, uBites[32](vec4), uCount, uAspect = W/H, uCrop = vec2(W/(vw·s), H/(vh·s))`. 셰이더 전문은 부록 B.
- 캔버스 내부 해상도는 결정 9·`Quality.glScale`. `resize`에서만 재할당.
- 부기는 게임 중 줄어들지 않는다(결정 7). `reset()`으로만 비운다.
- 가장자리 광택 하이라이트는 v1.1(결정 12).
**완료 조건**:
- [ ] 한 번 물리면 1 s 이내 해당 부위가 붉고 볼록해진다
- [ ] 같은 볼을 5번 물리면 1번 물렸을 때보다 눈에 띄게 크다
- [ ] 물린 뒤 고개를 45° 돌려도 부기가 원래 자리(피부)에 남아 있다
- [ ] `?debug=1`의 부기 중심 점이 셰이더의 볼록 중심과 겹친다 (좌표·크롭 검증)
- [ ] 물림 50회 이후에도 F-15 성능 기준을 만족한다

### F-08 손으로 모기 잡기  [명시]
**담당·위치**: C — `src/game/swat.ts`, `src/game/hands.ts`(이력 버퍼)
**동작**: 손으로 모기를 치거나 잡으면 모기가 죽는다.
**입력/출력**: 입력 `FrameInput.hands`, `FrameInput.taps`, `face.faceW`. 출력: 처치 → F-09·F-10 호출, `stats.kills++`.
**세부 요구사항**:
- `hands.ts`: `side`별 링버퍼(최근 300 ms의 `{t, palm, grip}`)를 `HandFrame.t`가 바뀔 때만 push. 그 `side`가 직전 프레임에 없었으면 버퍼를 비운다. `pause(true)`에서도 비운다.
- 공통: 판정은 **선분 기준** — 직전 push된 손 위치 → 현재 손 위치 선분과 모기 중심 거리(`distPointSeg`). 빠른 손이 모기를 건너뛰는 문제 방지. `invulnUntil > now`인 모기(F-10)는 제외. `LANDED` 상태도 잡힌다. 한 동작으로 여러 마리 동시 처치 가능(처치 즉시 리스트에서 제거하면 중복 판정 없음).
- 판정 4종(하나라도 만족) [결정]:
  1. **스윙**: `|velocity| / faceW > 1.5` AND `distPointSeg(mosq, palmPrev, palmNow) < palmR + mosqR`
  2. **박수** (폰 거치 시): 두 손 존재 AND 150 ms 안에 두 palm 거리가 50% 이상 줄어 현재 `< 0.6 faceW` AND `distPointSeg(mosq, palmA, palmB) < 0.3 faceW`. 발동 후 200 ms 재발동 금지
  3. **움켜쥐기**: `|mosq − palm| < palmR` AND 200 ms 안에 grip이 `≥ 1.8 → < 1.1`로 감소. 발동 후 200 ms 재발동 금지
  4. **화면 탭** (모바일 대체 입력): `taps` 각각에 대해 반경 `0.12 faceW` 안의 모기 처치. 폰을 든 손 엄지로 사용
- 세로 화면에서는 손이 화면 밖으로 나가기 쉬우므로 손이 부분적으로만 보여도(confidence ≥ 0.5) 인정.
- 손이 느리게 모기 위를 지나가는 것만으로는 죽지 않는다(스윙 속도 조건).
- `Quality.handsEnabled=false`면 1~3번을 건너뛰고 탭만 판정.
**완료 조건**:
- [ ] 손바닥으로 모기를 빠르게 치면 죽는다 (10회 스윙 중 8회 이상)
- [ ] 손을 모기 위에 천천히 올려두면 죽지 않는다
- [ ] 모기 앞에서 박수를 치면 죽는다
- [ ] 모기를 움켜쥐면 죽는다
- [ ] 모바일에서 모기를 손가락으로 탭하면 죽는다
- [ ] 폰을 한 손에 든 채 반대 손 스윙만으로 모기를 잡을 수 있다
- [ ] 분열 직후 0.6 s 안에는 같은 스윙으로 새 모기가 죽지 않는다

### F-09 피 튀김 효과  [명시]
**담당·위치**: C — `src/game/particles.ts`, `src/game/audio.ts`
**동작**: 잡힌 자리에서 피가 짧게 튀고 모기가 사라진다.
**세부 요구사항**:
- 파티클 12~20개, 랜덤 방향 초속 1~3 faceW/s, 중력 3 faceW/s², 수명 400 ms. 객체 풀(pool)로 재사용.
- 바닥 자국(splat) 1개, 1.5 s 동안 페이드아웃 [결정]. 캔버스 도형으로 그린다(이미지 파일 불필요).
- "찰싹" 효과음: 화이트노이즈 60 ms + 지수 감쇠(Web Audio, 파일 없음) [결정].
- 동시 파티클 상한 500개, 초과 시 오래된 것부터 제거.
**완료 조건**:
- [ ] 처치 순간 피 파티클이 보이고 2 s 후 흔적이 완전히 사라진다
- [ ] 연속 20회 처치해도 프레임이 떨어지지 않는다

### F-10 분열  [명시]
**담당·위치**: C — `src/game/mosquito.ts`
**동작**: 죽은 모기 자리에서 모기 2마리가 새로 생겨나 다시 쫓아와 문다.
**세부 요구사항**:
- 처치 위치에서 2마리 생성, 무작위 축 `u`로 `±u × 2 faceW/s` 튕겨 나감. `state = SPAWNING`, `invulnUntil = now + 600`, 반투명 깜빡임 [결정].
- 무적 종료 후 APPROACH, 각자 새 `targetIdx` 선택.
- `stats.mosquitoCount = 1 + kills`는 상한과 무관하게 계속 증가(HUD 표시값). 엔티티 수가 `Quality.mosquitoCap`(기본 200/120, 결정 5)에 닿으면 엔티티는 만들지 않고 화면의 모기를 1.5배 크게 그린다 [결정].
- 분열 로직은 순수 함수 `split(pos, faceW, now): [Mosquito, Mosquito]`로 분리하고 Vitest 테스트를 둔다(Vitest는 A가 Day 0에 설치).
**완료 조건**:
- [ ] 모기 1마리를 잡으면 HUD 모기 수가 1 → 2가 된다
- [ ] 분열 직후 0.6 s 안에 다시 쳐도 새 모기는 죽지 않는다
- [ ] 10회 처치 후 화면에 모기 11마리가 존재한다

### F-11 게임 흐름·HUD·사운드  [추론]
**담당·위치**: C — `src/ui/hud.ts`, `src/game/audio.ts`, `src/game/index.ts`(Game 구현)
**동작**: 시작 시 모기 1마리가 화면 가장자리에서 날아온다. 종료 조건 없이 계속 진행된다.
**세부 요구사항**:
- 초기 모기 1마리, 화면 밖 랜덤 위치에서 진입 [결정]. 자연 증식 없음(결정 3). 종료 조건 없음, "그만하기" 버튼 → `captureRequested` → S-5(결정 4).
- HUD(DOM): 상단 `padding-top: env(safe-area-inset-top)` 한 줄 "물림 N · 잡음 N · 모기 N · mm:ss". 하단 `padding-bottom: env(safe-area-inset-bottom)`에 그만하기 · 음소거. 얼굴이 주로 위치하는 화면 높이 40~75% 구간은 비운다. 버튼 최소 44×44 px.
- `face.visible=false`가 500 ms 넘으면 "얼굴 어디 갔어?" 표시.
- 윙윙 소리: Web Audio 오실레이터 3개(sawtooth 420 Hz, ±7 Hz 디튠) + 20 Hz LFO 주파수 흔들림 + lowpass 1.2 kHz. 마스터 게인 = `min(0.25, 0.02 × 엔티티 수)`를 0.3 s 시간상수로 따라감 [결정]. `AudioContext`는 `onUserGesture()`에서만 생성/`resume`. iOS 무음 모드에서 소리가 안 나는 것은 허용 [결정].
- 음소거 버튼은 마스터 게인 0(`setMuted`). `pause(true)`면 소리 정지.
**완료 조건**:
- [ ] 게임 시작 3 s 이내 첫 모기가 화면에 보인다
- [ ] 음소거 버튼으로 모든 소리가 꺼진다
- [ ] HUD가 iPhone 노치·홈 인디케이터와 겹치지 않는다

### F-12 결과 화면  [결정]
**담당·위치**: B — `renderer.capture()` / C — `src/ui/result.ts`
**동작**: 그만하기를 누르면 최종 통계와 퉁퉁 부은 얼굴의 마지막 프레임을 보여준다.
**세부 요구사항**:
- 그만하기 → `captureRequested = true` → 다음 프레임 `renderer.draw` 직후 `renderer.capture(overlayCanvas)`: 오프스크린 캔버스에 GL 캔버스 + 오버레이 캔버스를 `drawImage`로 합성해 반환. `preserveDrawingBuffer`는 쓰지 않는다(같은 프레임 안에서 읽어야 한다).
- `toDataURL('image/jpeg', 0.9)` → `<img>`. 통계(물림·잡음·모기 수·시간) 표시.
- 저장 = `<a download="mosquito.jpg" href={dataURL}>`. 서버 전송 없음.
- "다시 하기" = `game.reset()`, `renderer.reset()` 후 S-4. 카메라·모델은 유지.
**완료 조건**:
- [ ] 결과 화면 이미지에 부기와 모기가 모두 보인다
- [ ] 다시 하기 후 얼굴에 부기가 없고 모기가 1마리다

### F-13 링크 공유 미리보기  [추론]
**담당·위치**: A — `index.html`, `public/og.jpg`
**동작**: 링크를 메신저에 붙여넣으면 제목·설명·썸네일이 표시된다.
**세부 요구사항**:
- `public/og.jpg` 1200×630, 200 KB 이하. 게임 화면 캡처에 제목 한 줄.
- `index.html` head:
```html
<meta property="og:title" content="모기 피하기 (못 함)">
<meta property="og:description" content="웹캠 앞에서 모기를 피해봐. 못 피함.">
<meta property="og:image" content="https://<프로젝트>.vercel.app/og.jpg?v=1">
<meta property="og:url" content="https://<프로젝트>.vercel.app/">
<meta name="twitter:card" content="summary_large_image">
```
- 카카오톡은 미리보기를 오래 캐시한다. 이미지·제목을 바꾸면 `?v=`를 올리고 https://developers.kakao.com/tool/debugger/sharing 에서 캐시 초기화.
**완료 조건**:
- [ ] 카카오톡에 링크를 보내면 썸네일과 제목이 나온다

### F-14 기기 지원 감지·오류 안내  [결정]
**담당·위치**: A — `src/platform/support.ts`, `src/platform/errors.ts`
**동작**: 지원되지 않는 환경에서는 시작 전에 이유와 대안을 보여주고, 실행 중 오류는 화면에 표시해 친구가 그대로 보고할 수 있게 한다.
**세부 요구사항**:
- S-1 진입 시 순서대로 검사, 첫 실패 문구를 표시하고 시작 버튼을 숨긴다:
```ts
export function checkSupport(): string | 'IN_APP' | null {
  if (!window.isSecureContext) return 'HTTPS로 열어야 카메라를 쓸 수 있어요.';
  if (!navigator.mediaDevices?.getUserMedia) return '이 브라우저는 카메라를 지원하지 않아요. Safari나 Chrome으로 열어주세요.';
  if (!document.createElement('canvas').getContext('webgl2')) return '이 기기는 WebGL2를 지원하지 않아요. 브라우저를 업데이트해 주세요.';
  if (typeof WebAssembly !== 'object') return '이 브라우저는 WebAssembly를 지원하지 않아요.';
  if (/KAKAOTALK|Instagram|FBAN|FBAV|Line\//i.test(navigator.userAgent)) return 'IN_APP';
  return null;
}
```
- `IN_APP`: "우측 상단 ⋯ → 다른 브라우저로 열기" 안내 + URL 복사 버튼. Android는 `intent://<host>/#Intent;scheme=https;package=com.android.chrome;end` 링크로 Chrome을 직접 띄운다.
- 전역 `window.onerror`·`unhandledrejection`: 메시지 + `__APP_VERSION__` + UA를 하단 토스트로 5 s 표시, "복사" 버튼. 서버가 없으므로 친구가 복사해 보내는 것이 유일한 신고 경로.
- 화면 하단 구석에 버전 문자열(`__APP_VERSION__`, 커밋 해시 7자리) 상시 표시.
- 어두운 환경: 얼굴이 10 s 이상 미검출이면 "밝은 곳에서 해봐" 토스트.
**완료 조건**:
- [ ] HTTP로 열면 HTTPS 안내가 뜨고 시작 버튼이 없다
- [ ] 카카오톡 인앱에서 열면 외부 브라우저 안내가 뜨고, 안내대로 하면 Safari/Chrome에서 열린다
- [ ] 강제로 throw를 넣으면 토스트에 버전·메시지가 보이고 복사된다

### F-15 성능 측정·자동 조절  [추론]
**담당·위치**: A — `src/perception/perf.ts` (B·C는 `setQuality`로 받기만 한다)
**동작**: 프레임 속도와 인식 속도를 측정해 기준 미달 시 품질을 단계적으로 낮추고, 여유가 생기면 되돌린다.
**세부 요구사항**:
- 측정: 60프레임 이동평균 렌더 fps, 초당 얼굴 인식 횟수, 얼굴·손 추론 ms(`performance.now()` 차).
- 기본 Quality: 데스크톱 `{handEvery 1, numHands 2, detectScale 1, glScale 1, maxBites 32, mosquitoCap 200}`, 모바일 `{handEvery 2, numHands 2, detectScale 0.66, glScale 1, maxBites 32, mosquitoCap 120}`.
- 하향 조건: 5 s 연속 fps < 20 **또는** 인식 < 15회/s → 한 단계 하향. 복귀 조건: 10 s 동안 fps ≥ 28 → 한 단계 복귀(7단계 손 끔은 복귀하지 않음).

| 단계 | 조치 | 받는 파트 |
|---|---|---|
| 1 | `handEvery` 3 | A |
| 2 | `numHands` 1 | A |
| 3 | `glScale` 0.75 → 0.5 | B |
| 4 | `detectScale` 0.5 (인식 입력을 오프스크린 캔버스에 축소해 넘김. 정규화 좌표는 동일하므로 mapper 불변) | A |
| 5 | `maxBites` 16 | B |
| 6 | `mosquitoCap` 80 | C |
| 7 | `handsEnabled` false + 토스트 "손 인식을 껐어. 탭으로 잡아!" | A, C |

- 성능 관문(team-guide 8장): `?debug=1`로 iPhone 1대 + Android 중급기 1대에서 렌더 fps ≥ 30, 인식 ≥ 15회/s, 5분 연속 후 fps ≥ 20. 미달이면 다음 단계 진행 보류.
**완료 조건**:
- [ ] `?debug=1`에 fps·인식/s·추론 ms·현재 단계가 표시된다
- [ ] 디버그 패널에서 단계를 수동으로 올리면 각 파트가 즉시 반영한다
- [ ] 저사양 기기에서 20 fps 미만이 5 s 지속되면 단계가 자동으로 올라간다

### F-16 디버그 모드·리플레이·녹화  [결정]
**담당·위치**: A — `src/platform/debug.ts`, `src/perception/replay.ts`, `src/perception/recorder.ts`
**동작**: 카메라 없이도 B·C가 개발·회귀 테스트를 할 수 있게 녹화 데이터를 재생하고, 내부 수치를 화면에 보여준다.
**세부 요구사항**:
- `?debug=1`(데스크톱은 키 `D` 토글): 좌상단 패널에 fps / 인식 횟수/s / 얼굴 ms / 손 ms / Quality 단계 / faceW / 손별 속도(faceW/s)·grip. 오버레이에 478점(작은 점), 손바닥 원, 모기 상태 문자, 부기 중심·반경(`renderer.bites`).
- `?record=1`: REC 버튼. 누르면 ① MediaRecorder로 카메라 스트림 녹화(`video/mp4` 지원 시 우선, 아니면 `video/webm`) ② 인식이 돌 때마다 **정규화 좌표 원본**(얼굴 478점, 손 21점×손, handedness)을 `t = 녹화 시작 후 ms`와 함께 기록. 정지하면 `clip.json`·`clip.(mp4|webm)` 다운로드.
- 녹화 후 처리: `ffmpeg -i clip.webm -c:v libx264 -pix_fmt yuv420p -an clip1.mp4`(해상도 유지) → `public/replays/clip1.mp4` + `clip1.json`. 30 s 이내, 합계 20 MB 이하, git에 포함.
- `?replay=clip1`: 카메라 대신 `<video src="/replays/clip1.mp4" loop muted playsinline>`을 재생하고, `landmarkers.ts`가 MediaPipe 대신 `clip1.json`에서 `video.currentTime`에 가장 가까운 프레임을 돌려준다. 그 뒤 mapper·One Euro·HandFrame 계산은 **실시간과 같은 코드**를 탄다. 리플레이 영상의 `videoWidth/Height`로 mapper를 만든다.
- 리플레이·디버그 코드는 프로덕션 번들에 포함되어도 되지만 쿼리가 없으면 아무 것도 그리지 않는다.
**완료 조건**:
- [ ] Day 0 종료 시 `?replay=clip1&debug=1`이 폰의 Vercel 주소에서 열리고 점이 영상 위 얼굴·손에 겹친다
- [ ] 리플레이로 F-04~F-10이 카메라 없이 동작한다

---

## 7. 내부 데이터 모델 (파트 내부, 공유하지 않음)
전부 브라우저 메모리 상태이며 저장·전송하지 않는다.

| 엔티티 | 소유 | 필드 |
|---|---|---|
| Mosquito | C | `id`, `pos: Vec2`, `vel: Vec2`, `state: 'APPROACH' \| 'LANDED' \| 'BITE' \| 'FLY_OFF' \| 'COOLDOWN' \| 'SPAWNING'`, `stateTimer: ms`, `targetIdx`, `targetOffset: Vec2`(faceW 단위), `invulnUntil: ms`, `noiseSeed` |
| HandHistory | C | `side`, 링버퍼 `{t, palm, grip}[]` 최근 300 ms |
| Particle | C | `pos`, `vel`, `life`, `kind: 'drop' \| 'splat'` (풀) |
| Bite | B | 5.2 `Bite` |
| FaceState | A | 478×2 OneEuro, `FaceFrame` 재사용 객체, 코끝 위치 링버퍼 |
| HandState | A | side별 palm 링버퍼(100 ms), 마지막 검출 시각 |

## 8. 비기능 요구사항
- **성능**: 노트북 내장 GPU 및 최근 3년 내 중급 스마트폰에서 렌더 30 fps 이상, 인식 15회/s 이상, 인식 지연 100 ms 이하. 5분 연속 플레이(발열) 후 20 fps 이상. 미달 시 F-15가 단계적 하향.
- **초기 로딩**: 모델(약 11 MB)+WASM+코드 다운로드 후 첫 플레이까지 일반 Wi-Fi에서 5 s 이내. 모델·WASM은 1년 캐시(9.3).
- **프라이버시**: 영상·랜드마크·캡처 이미지는 기기 밖으로 나가지 않는다. localStorage 등 저장소도 쓰지 않는다. 랜딩에 "영상은 서버로 전송되지 않음" 1줄.
- **호환성**: iOS Safari 15+, Android Chrome 90+(1순위), 데스크톱 Chrome·Edge·Safari 최근 2년. 인앱 브라우저는 F-14로 외부 브라우저 유도.
- **HTTPS 필수.**
- **조명**: 어두운 환경에서 인식 실패 시 "밝은 곳에서 해봐" 안내(F-14).
- **번들**: JS gzip 1 MB 이하(tasks-vision 포함), 모델은 별도.

## 9. 배포 (A) — `git push`로 HTTPS 링크가 나오게

### 9.1 사전 준비
- Vercel 계정(GitHub 로그인). 레포는 Private 유지 가능.
- 모델 파일 `public/models/*.task`는 git에 그대로 포함(합계 약 11 MB, LFS 불필요). `.gitignore`에 `.vercel` 추가.
- `package.json`의 `build`가 `tsc && vite build`인지 확인(타입 오류가 배포를 막아야 한다). `postinstall`로 `node_modules/@mediapipe/tasks-vision/wasm` → `public/wasm` 복사 스크립트.

### 9.2 `vite.config.ts` 최종형
```ts
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { execSync } from 'node:child_process';

const sha = process.env.VERCEL_GIT_COMMIT_SHA
  ?? (() => { try { return execSync('git rev-parse HEAD').toString().trim(); } catch { return 'dev'; } })();

export default defineConfig({
  plugins: [basicSsl()],                       // 로컬 https://<LAN IP>:5173 — 같은 Wi-Fi의 폰에서 카메라가 열린다
  server: { host: true },
  build: { target: 'es2020', sourcemap: true }, // iOS 15 Safari까지, 소스맵은 원격 디버깅용
  define: { __APP_VERSION__: JSON.stringify(sha.slice(0, 7)) },
});
```

### 9.3 `vercel.json` (프로젝트 루트)
```json
{
  "headers": [
    { "source": "/(models|wasm)/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
    { "source": "/(.*)",
      "headers": [
        { "key": "Permissions-Policy", "value": "camera=(self)" },
        { "key": "X-Content-Type-Options", "value": "nosniff" } ] }
  ]
}
```
- 모델·WASM은 파일명에 해시가 없으므로 1년 캐시를 걸고, **모델을 바꿀 때는 폴더명을 올린다**(`models/v2/`). 친구 폰에 남은 옛 캐시가 문제를 안 일으키게.
- Vite 산출 JS/CSS는 이름에 해시가 붙어 별도 설정 불필요.
- `SharedArrayBuffer`가 필요 없으므로 COOP/COEP 헤더는 **넣지 않는다**(넣으면 외부 리소스가 막힌다).

### 9.4 최초 배포와 미리보기 (team-guide 6-8)
1. vercel.com → Add New Project → 레포 Import. Framework Preset **Vite** 자동 감지, Build `npm run build`, Output `dist` 확인 → Deploy.
2. `https://<프로젝트>.vercel.app` 생성. 이 주소를 `og:url`·`og:image`에 넣고 다시 push.
3. `main` push = 프로덕션, 그 외 브랜치·PR = 미리보기 URL. PR 리뷰어는 미리보기 URL을 자기 폰 세로 화면에서 연다.
4. Private 레포의 미리보기가 팀원에게 안 열리면 Vercel 프로젝트 Settings → Deployment Protection을 끄거나 팀원을 Vercel 팀에 초대.

### 9.5 주소 (선택)
Vercel Settings → Domains에서 `<원하는이름>.vercel.app`으로 변경 가능(무료). 자체 도메인도 같은 곳, 인증서 자동.

### 9.6 배포 후 확인 (매 프로덕션 배포마다, A)
1. 시크릿 창에서 링크 → 랜딩 → 시작 → 권한 팝업 1회 → 게임 진입.
2. Network 탭에서 `face_landmarker.task`, `hand_landmarker.task`, `vision_wasm_internal.wasm`이 200, 두 번째 로드에서 `(disk cache)`.
3. 콘솔 빨간 에러 0개.
4. 화면 구석 버전 문자열이 방금 배포한 커밋과 일치.

## 10. 공유 전 최종 점검표 (Day 9 통합 2 · Day 11 정식 배포)
**본인 기기 외 최소 2대**(iPhone 1, Android 1)에서 통과해야 링크를 보낸다. 기기·브라우저·결과를 Issue에 표로 기록.

진입
- [ ] 카카오톡에 링크를 보내면 썸네일·제목·설명이 뜬다
- [ ] 카카오톡 인앱에서 열면 외부 브라우저 안내가 뜨고, 그대로 하면 Safari/Chrome에서 열린다
- [ ] 시작 버튼 전에는 권한 팝업이 뜨지 않는다
- [ ] 시작 → 권한 허용 → 5 s 이내 게임 화면 (Wi-Fi)
- [ ] 권한 거부 → S-2 → 브라우저 설정에서 허용 후 재시도 성공
- [ ] HTTP·구형 기기에서 이유 문구가 뜬다

플레이
- [ ] iPhone Safari 세로: 영상이 꽉 차고 `?debug=1` 점이 코·손에 정확히 겹친다
- [ ] Android Chrome 세로: 동일
- [ ] 데스크톱 Chrome 가로 웹캠: 인식·HUD 정상
- [ ] 첫 모기 3 s 이내, 첫 물림 6 s 이내
- [ ] 부기가 얼굴을 따라오고 고개를 돌려도 미끄러지지 않는다
- [ ] 스윙·박수·움켜쥐기·탭으로 모기가 죽고 2마리로 는다
- [ ] 30 fps 이상, 중급 폰에서 하향 단계가 작동한다
- [ ] 가로 회전 → 일시정지 안내 → 세로 복귀 → 재개
- [ ] 홈 화면 나갔다 돌아오면 이어지고 모기가 튀지 않는다
- [ ] 2분 방치해도 화면이 안 꺼진다 (Wake Lock 지원 기기)
- [ ] 그만하기 → 결과 이미지·통계·저장·다시 하기 정상

배포
- [ ] 프로덕션 URL = `og:url`
- [ ] 두 번째 방문에서 모델이 디스크 캐시로 로드된다
- [ ] 콘솔 에러 0, 버전 문자열 일치
- [ ] `git tag v1.0 && git push --tags`

친구에게 링크와 같이 보낼 한 줄: "카카오톡 안에서 말고 Safari/Chrome으로 열어줘. 카메라 허용 필요하고 영상은 어디에도 안 올라가."

## 11. 범위 밖
- 회원가입, 랭킹, 서버 저장
- 멀티플레이(여러 얼굴 동시 추적)
- 영상 녹화·자동 SNS 업로드 (F-16 녹화는 개발용)
- 모기 외 다른 적, 아이템, 레벨/스테이지
- 부기 회복(시간 경과로 가라앉기) — 결정 7로 제외 확정
- 난이도 옵션, 자연 증식 모드 — 이후

## 12. 구현 우선순위와 일정 매핑 (team-guide 8장)
- **MVP**: F-01~F-11, F-13~F-16 · **v1.1**: F-12, 윙윙 사운드, 결정 12 광택

| team-guide 일정 | A 인식·플랫폼 | B 렌더링 | C 게임플레이 |
|---|---|---|---|
| Day 0 | 5장 공통 규약 전부, F-16, 9.4 Vercel 연결, Vitest 설치, `strict: true` | 스텁 Renderer | 스텁 Game |
| Day 1–3 | F-01, F-02, F-03, F-15 측정부. 성능 관문 통과 | F-07 비디오 출력 + 부기 1개 셰이더 | F-04, F-06 (리플레이 기반) |
| Day 4 통합 1 | 실기기에서 인식 → 추적 → 물림 → 부기 연결 | | |
| Day 5–8 | F-14, F-15 하향 단계, F-01 회전·Wake Lock·탭 수집 | F-07 앵커링·병합·32개·애니메이션 | F-05, F-08, F-09, F-10, F-11 |
| Day 9 통합 2 | 10장 점검표 1차, iPhone·Android·카톡 인앱 전수 테스트, 버그 분배 | | |
| Day 10–11 | F-13, 9장 정식 배포, 버그 수정 | F-12 capture | F-12 결과 화면, 사운드, 수치 튜닝 |

## 13. 요구사항 추적
| # | 원문 | 반영 위치 |
|---|------|-----------|
| 1 | 링크를 친구에게 보내 친구가 링크에 들어가 어이없게 웃게 만드는 그런 흥미로운 웹 | 한 줄 소개, F-13, F-14, 9장, 10장 |
| 2 | 동작을 감지해서 모기 피하는 게임 | F-01~F-04 |
| 3 | 모기를 피하지만 모기를 피할 수 없다는거야 | F-05 |
| 4 | 상반신 나와서 화면에서 | F-01 |
| 5 | 사용자가 움직이면 동작 감지로 모기가 따라가서 | F-02, F-04 |
| 6 | 얼굴을 무는거야 | F-06 |
| 7 | 필터 느낌으로 물린 부분 빨갛게 부어오를거야 | F-07 |
| 8 | 아무리 움직여도 모기가 계속 와서 물게 만들거야 | F-05, F-06(COOLDOWN 후 재접근) |
| 9 | 나중에는 얼굴이 엄청 퉁퉁 붓는거지 | F-07 누적 규칙, 결정 7 |
| 10 | 모기를 손으로 잡아 죽일 수 있는 기능 | F-03, F-08 |
| 11 | 모기를 잡으면 짧게 피가 튀기고 없어지지만 | F-09 |
| 12 | 그 자리에서 2개로 분열하게 만들거야 | F-10 |
| 13 | 그 모기들이 또 따라다니며 물고 | F-10(무적 종료 후 APPROACH) |
| 14 | 계속 늘어나서 모기가 겁나 많아지게 | F-10 상한 규칙, F-04 분리 힘, F-15 |
| 15 | open cv 이용해서 동작 감지할거야 | 결정 1 (MediaPipe로 확정), 부록 A |
| 16 | 핸드폰에서 세로로 실행할 수 있게 해줘 | 사용 맥락, S-R, F-01, F-08, F-10, F-11, F-14, F-15, 결정 6 |

---

# 부록

## 부록 A. 인식 기술 선택 근거 (결정 1)
| | A. MediaPipe Tasks Vision (브라우저) — **채택** | B. OpenCV.js (브라우저) | C. Python OpenCV 서버 |
|---|---|---|---|
| 얼굴 표면 점 | 478점 → 부기 고정 가능 | 없음 (얼굴 사각형만) | dlib·MediaPipe 병행 시 가능 |
| 손 관절 | 21점 → 스윙·박수·쥠 판정 | 피부색·윤곽 직접 구현, 조명에 취약 | 가능 |
| 지연 | GPU 추론, 로컬 | CPU WASM, 느림 | 영상 왕복 수백 ms |
| 배포·비용 | 정적 호스팅, 무료 | 정적 호스팅 | 서버 비용, GPU 부하 |
| 프라이버시 | 영상이 기기 밖으로 안 나감 | 동일 | 친구 얼굴 영상이 서버로 |

핵심 두 기능(피부에 붙는 부기, 손으로 잡기)이 모두 랜드마크를 요구한다. OpenCV를 굳이 쓰려면 A 위에 "프레임 차분 움직임량 → 모기 흥분도" 연출용으로만 얹는 것이 현실적이며, MVP 범위 밖이다.

## 부록 B. 부기 셰이더 전문 (B)
버텍스 — 풀스크린 삼각형, `vUv (0,0)` = 화면 좌상단(CSS px / (W,H)와 같은 방향):
```glsl
#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID == 1) ? 3.0 : -1.0, (gl_VertexID == 2) ? 3.0 : -1.0);
  vUv = vec2((p.x + 1.0) * 0.5, 1.0 - (p.y + 1.0) * 0.5);
  gl_Position = vec4(p, 0.0, 1.0);
}
```
프래그먼트 — 볼록 왜곡 + 붉은 기 + cover 크롭 역변환 + 거울:
```glsl
#version 300 es
precision highp float;
uniform sampler2D uVideo;
uniform vec4 uBites[32];   // xy: 화면 uv 중심, z: 반경(px/H), w: 세기
uniform int uCount;
uniform float uAspect;     // W / H
uniform vec2 uCrop;        // (W / (vw*s), H / (vh*s)) — 5.1 mapper의 s
in vec2 vUv; out vec4 o;
void main() {
  vec2 uv = vUv; float red = 0.0;
  for (int i = 0; i < 32; i++) {
    if (i >= uCount) break;
    vec2 d = uv - uBites[i].xy; d.x *= uAspect;        // 높이 기준 단위로 통일
    float r = length(d) / uBites[i].z;
    if (r < 1.0) {
      float k = uBites[i].w * pow(1.0 - r * r, 2.0);
      d *= (1.0 - k); d.x /= uAspect;
      uv = uBites[i].xy + d;                            // 중심부 확대 = 부풀어 보임
      red += k;
    }
  }
  vec2 vuv = 0.5 + (uv - 0.5) * uCrop;                 // 화면 uv → 비디오 uv (cover 크롭 역변환)
  vec3 c = texture(uVideo, vec2(1.0 - vuv.x, vuv.y)).rgb;   // 거울 반전만. UNPACK_FLIP_Y=false면 t=0이 영상 윗줄이라 y는 뒤집지 않는다
  vec3 swollen = c * vec3(1.0, 0.55, 0.55) + vec3(0.15, 0.0, 0.0);
  o = vec4(mix(c, swollen, clamp(red, 0.0, 0.8)), 1.0);
}
```
- 부기가 얼굴을 따라오지 않거나 좌우가 어긋나면 `uCrop`·거울 순서가 mapper와 다른 것이다. `?debug=1`의 부기 중심 점과 셰이더 볼록 중심이 겹치는지로 확인한다.
- 영상이 상하로 뒤집혀 보이면 `UNPACK_FLIP_Y_WEBGL`을 건드린 것이다. false로 되돌린다.

## 부록 C. 흔한 함정
- **iOS**: `getUserMedia`·`video.play()`·`AudioContext`는 모두 시작 버튼 핸들러 안에서. `playsinline muted`가 빠지면 전체화면 플레이어가 뜬다. `display:none` 비디오는 프레임이 갱신되지 않는다.
- `detectForVideo` 타임스탬프가 직전보다 작으면 에러. `performance.now()`만 쓴다.
- 첫 추론이 느려 게임 시작 직후 멈춤 → S-3에서 warm-up.
- 거울 반전 이중 적용: CSS `scaleX(-1)` 금지. mapper(오버레이용)와 셰이더(GL용)에서 각각 한 번씩만 — 캔버스가 다르므로 둘 다 필요하다.
- `devicePixelRatio`: 캔버스 `width/height` 속성은 px×dpr, `ctx.scale(dpr, dpr)` 후 CSS px로 그린다. 판정 좌표와 그리기 좌표가 어긋나면 이게 원인.
- `erasableSyntaxOnly`: `constructor(private x)`·enum을 쓰면 컴파일 실패. 5.6 참조.
- `public/` 경로: Vercel이면 `/models/...` 절대경로 그대로. GitHub Pages로 옮기면 `import.meta.env.BASE_URL` 필요.
- 손 검출이 끊겼다 붙으면 속도가 폭발 → 재검출 시 이력 초기화(A는 velocity, C는 링버퍼).
- `dt`를 50 ms로 클램프하지 않으면 탭 복귀 순간 모기가 화면 밖으로 튄다.
- 분리 힘·파티클 루프 안에서 `{x, y}` 리터럴을 만들면 GC 끊김. 풀·재사용.
- 카카오톡 인앱 브라우저는 카메라 권한이 막힌다 → F-14 안내가 먼저.
- 다른 기기에서만 안 될 때의 원인 4가지: HTTP 접속, 인앱 브라우저, 옛 모델 캐시(폴더명 버전 올리기), iOS 저전력 모드(F-15 하향이 받쳐야 함).
