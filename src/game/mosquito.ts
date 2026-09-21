// src/game/mosquito.ts
// F-04 모기 추적 비행

import { noise1D } from "./noise";
import type { Vec2, FaceState, MosquitoState } from "./types";

// 목표로 삼을 수 있는 얼굴 랜드마크 인덱스 (기획서 예시 값)
// 이마(10), 코끝(1), 턱(152), 좌우 볼(50,280), 좌우 윗눈꺼풀(159,386), 입술 위(0)
// -> perception 담당자가 실제 MediaPipe 인덱스로 확인해줘야 함
export const TARGET_LANDMARKS = [10, 1, 152, 50, 280, 159, 386, 0];

// F-05에서 정한 기본 속도(faceW/s 단위). 거리에 따라 늘어나는 로직(F-05)은
// 이 파일 책임이 아니라서 일단 기본값만 사용합니다. F-05 담당자와 맞춰서
// maxSpeedFaceW를 상황에 따라 올리는 로직을 추가하면 됩니다.
const BASE_MAX_SPEED_FACEW = 3.0; // faceW / s
const MAX_ACCEL_FACEW = 12; // faceW / s^2 (튜닝 가능)

let idCounter = 0;

export class Mosquito {
  id: number;
  position: Vec2;
  velocity: Vec2 = { x: 0, y: 0 };
  state: MosquitoState;
  targetLandmarkIndex: number;
  noiseSeed: number;
  wingFrame: 0 | 1 = 0;
  private wingTimer = 0;

  constructor(spawnPos: Vec2, state: MosquitoState = "APPROACH") {
    this.id = idCounter++;
    this.position = { ...spawnPos };
    this.state = state;
    this.targetLandmarkIndex =
      TARGET_LANDMARKS[Math.floor(Math.random() * TARGET_LANDMARKS.length)];
    this.noiseSeed = Math.random() * 1000;
  }

  /** 모기 지름(px). 기획서: 0.06 * faceW */
  getSize(faceWidthPx: number): number {
    return 0.06 * faceWidthPx;
  }

  /**
   * 매 프레임 호출. APPROACH 상태일 때만 추적 비행을 계산합니다.
   * (LANDED 이후 상태는 F-06 담당자가 별도로 처리)
   */
  update(dt: number, face: FaceState, others: Mosquito[]) {
    if (this.state !== "APPROACH" && this.state !== "SPAWNING") return;

    const landmark = face.landmarks[this.targetLandmarkIndex];
    if (!landmark || !face.visible) return;

    const faceWidthPx = face.faceWidthPx || 1;
    const maxSpeed = BASE_MAX_SPEED_FACEW * faceWidthPx; // px/s
    const maxAccel = MAX_ACCEL_FACEW * faceWidthPx; // px/s^2

    // 예측 추적: 목표 위치 = 현재 랜드마크 + 얼굴 속도 * 0.15s
    const predictedTarget: Vec2 = {
      x: landmark.x + face.velocity.x * 0.15,
      y: landmark.y + face.velocity.y * 0.15,
    };

    // 조향: 가속 = normalize(목표 - 위치) * maxSpeed - 속도
    const dx = predictedTarget.x - this.position.x;
    const dy = predictedTarget.y - this.position.y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const desiredVel = {
      x: (dx / dist) * maxSpeed,
      y: (dy / dist) * maxSpeed,
    };
    let accelX = desiredVel.x - this.velocity.x;
    let accelY = desiredVel.y - this.velocity.y;

    const accelMag = Math.hypot(accelX, accelY);
    if (accelMag > maxAccel) {
      accelX = (accelX / accelMag) * maxAccel;
      accelY = (accelY / accelMag) * maxAccel;
    }

    // 분리(separation): 반경 0.08*faceW 안의 다른 모기를 밀어냄
    const sepRadius = 0.08 * faceWidthPx;
    let sepX = 0;
    let sepY = 0;
    for (const other of others) {
      if (other.id === this.id) continue;
      const ox = this.position.x - other.position.x;
      const oy = this.position.y - other.position.y;
      const odist = Math.hypot(ox, oy);
      if (odist > 0 && odist < sepRadius) {
        const push = (sepRadius - odist) / sepRadius;
        sepX += (ox / odist) * push;
        sepY += (oy / odist) * push;
      }
    }
    const sepStrength = 4 * faceWidthPx; // px/s^2, 튜닝값
    accelX += sepX * sepStrength;
    accelY += sepY * sepStrength;

    this.velocity.x += accelX * dt;
    this.velocity.y += accelY * dt;
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // 비행감: 노이즈로 좌우 흔들림 (진폭 0.05 faceW)
    const wobbleAmp = 0.05 * faceWidthPx;
    const wobble = noise1D(performance.now() / 300, this.noiseSeed) * wobbleAmp;
    this.position.x += wobble * dt * 2;

    // 날개 애니메이션 (2프레임, 약 80ms 간격)
    this.wingTimer += dt;
    if (this.wingTimer > 0.08) {
      this.wingTimer = 0;
      this.wingFrame = this.wingFrame === 0 ? 1 : 0;
    }
  }
}
