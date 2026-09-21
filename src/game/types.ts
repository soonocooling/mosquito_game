// src/game/types.ts
// F-04 모기 비행 + F-01~F-03 인식 모듈이 함께 쓰는 공용 타입.

export interface Vec2 {
  x: number;
  y: number;
}

// 기획서 데이터 모델의 Mosquito.state 그대로. F-04는 APPROACH 상태일 때만 움직이고
// 나머지 상태(LANDED/BITE/FLY_OFF/COOLDOWN)는 F-06 담당자의 몫입니다.
export type MosquitoState =
  | "SPAWNING"
  | "APPROACH"
  | "LANDED"
  | "BITE"
  | "FLY_OFF"
  | "COOLDOWN";

// 물림 이벤트·게임 출력은 공유 타입(product-spec 5.2)을 그대로 쓴다
export type { BiteEvent, GameOutput } from "../shared/types";

export interface FaceState {
  // 랜드마크 인덱스 -> 화면 좌표(px). 예: landmarks[10] = 이마. FaceTracker(F-02)가 채워줌.
  landmarks: Record<number, Vec2>;
  faceWidthPx: number; // 기획서의 faceW를 px로 표현한 값
  velocity: Vec2; // 얼굴 이동 속도 (px/s)
  visible: boolean;
}

// 기획서 데이터 모델의 HandState. HandTracker(F-03)가 채워줌 (F-08 잡기 판정용).
export interface HandState {
  handedness: "Left" | "Right";
  palmCenter: Vec2;
  palmR: number;
  velocity: Vec2; // px/s
  grip: number; // 값이 작을수록 움켜쥔 상태
}
