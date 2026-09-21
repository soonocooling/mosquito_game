// src/shared/types.ts
// 세 파트(A 인식·플랫폼 / B 렌더링 / C 게임플레이)를 잇는 계약서. product-spec 5.2 그대로.
// 공동 소유 — 변경은 3인 동의 후 PR.

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

/** 모듈 인터페이스 — main.ts(A)는 이 형태로만 호출한다 */
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
