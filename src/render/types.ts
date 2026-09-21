// src/render/types.ts
// 임시: src/shared/types.ts(A, Day 0)가 main에 머지되기 전까지 쓰는 사본.
// product-spec 5.2에서 render가 쓰는 타입만 그대로 옮겼다. 필드를 바꾸지 말 것.
// shared/types.ts가 들어오면 이 파일을 지우고 import 경로를 '../shared/types'로 바꾼다.

export type Vec2 = { x: number; y: number };

export interface FaceFrame {
  visible: boolean;
  landmarks: Vec2[];
  faceW: number;
  rotation: number;
  velocity: Vec2;
  t: number;
}

export interface BiteEvent {
  anchorIdx: number;
  pos: Vec2;
  t: number;
}

export interface Bite {
  anchorIdx: number;
  localOffset: Vec2;
  radius: number;
  strength: number;
  targetStrength: number;
  createdAt: number;
}

export interface Quality {
  level: number;
  handEvery: 1 | 2 | 3;
  numHands: 1 | 2;
  detectScale: number;
  glScale: number;
  maxBites: 32 | 16;
  mosquitoCap: number;
  handsEnabled: boolean;
}

export interface Renderer {
  resize(viewport: { w: number; h: number }, video: { w: number; h: number }, dpr: number): void;
  draw(face: FaceFrame, events: BiteEvent[]): void;
  capture(overlay: HTMLCanvasElement): HTMLCanvasElement;
  reset(): void;
  setQuality(q: Quality): void;
  readonly bites: ReadonlyArray<Bite>;
}
