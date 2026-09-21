// src/game/types.ts
// F-04 모기 비행에서 쓰는 공용 타입.
// 실제 얼굴/손 인식(F-01~F-03) 담당자가 코드를 올리면
// 여기 FaceState 모양을 서로 맞춰봐야 할 수 있어요 (채팅으로 합의 후 조정).

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

export interface FaceState {
  // 랜드마크 인덱스 -> 화면 좌표(px). 예: landmarks[10] = 이마
  landmarks: Record<number, Vec2>;
  faceWidthPx: number; // 기획서의 faceW를 px로 표현한 값
  velocity: Vec2; // 얼굴 이동 속도 (px/s)
  visible: boolean;
}
