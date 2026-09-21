// src/game/mosquito.ts
// F-04 모기 추적 비행 + F-06 무는 동작 (상태 머신)
//
// SPAWNING(0.6s) ─▶ APPROACH ─(목표까지 0.1 faceW)─▶ LANDED(0.8s) ─▶ BITE(1프레임)
//     ─▶ FLY_OFF(0.6s) ─▶ COOLDOWN(2~4s) ─(새 목표)─▶ APPROACH ...

import { noise1D } from "./noise";
import {
  ANCHOR_IDS,
  COOLDOWN_DIST_MAX,
  COOLDOWN_DIST_MIN,
  COOLDOWN_MAX_MS,
  COOLDOWN_MIN_MS,
  COOLDOWN_SPEED_RATIO,
  FACE_CENTER_IDX,
  FLY_OFF_MS,
  FLY_OFF_SPEED,
  LAND_DIST,
  LANDED_MS,
  SPAWNING_MS,
} from "./config";
import type { Vec2, FaceState, MosquitoState, BiteEvent } from "./types";

// 목표로 삼을 수 있는 얼굴 랜드마크 인덱스 (product-spec 5.4, config.ts)
export const TARGET_LANDMARKS = ANCHOR_IDS;

// F-05에서 정한 기본 속도(faceW/s 단위). 거리에 따라 늘어나는 로직(F-05)은
// 이 파일 책임이 아니라서 일단 기본값만 사용합니다. F-05 담당자와 맞춰서
// maxSpeedFaceW를 상황에 따라 올리는 로직을 추가하면 됩니다.
const BASE_MAX_SPEED_FACEW = 3.0; // faceW / s
const MAX_ACCEL_FACEW = 12; // faceW / s^2 (튜닝 가능)

let idCounter = 0;

const randomAnchor = () => ANCHOR_IDS[Math.floor(Math.random() * ANCHOR_IDS.length)];
const randomRange = (min: number, max: number) => min + Math.random() * (max - min);

export class Mosquito {
  id: number;
  position: Vec2;
  velocity: Vec2 = { x: 0, y: 0 };
  state: MosquitoState = "APPROACH";
  targetLandmarkIndex: number;
  noiseSeed: number;
  wingFrame: 0 | 1 = 0;
  private wingTimer = 0;
  /** 현재 상태에 머문 시간 (s) */
  private stateTimer = 0;
  /** 현재 상태의 길이 (s). APPROACH처럼 끝이 없는 상태는 Infinity */
  private stateDuration = Infinity;
  // COOLDOWN 배회 지점: 얼굴 중심 기준 각도·거리(faceW)
  private cooldownAngle = 0;
  private cooldownDist = 0;

  constructor(spawnPos: Vec2, state: MosquitoState = "APPROACH") {
    this.id = idCounter++;
    this.position = { ...spawnPos };
    this.targetLandmarkIndex = randomAnchor();
    this.noiseSeed = Math.random() * 1000;
    this.enter(state);
  }

  /** 모기 지름(px). 기획서: 0.06 * faceW */
  getSize(faceWidthPx: number): number {
    return 0.06 * faceWidthPx;
  }

  /** 분열 직후 무적 (F-10). F-08 잡기 판정에서 제외해야 한다 */
  get isInvulnerable(): boolean {
    return this.state === "SPAWNING";
  }

  private enter(state: MosquitoState) {
    this.state = state;
    this.stateTimer = 0;
    switch (state) {
      case "SPAWNING":
        this.stateDuration = SPAWNING_MS / 1000;
        break;
      case "APPROACH":
        this.stateDuration = Infinity;
        break;
      case "LANDED":
        this.stateDuration = LANDED_MS / 1000;
        this.velocity.x = 0;
        this.velocity.y = 0;
        break;
      case "BITE":
        this.stateDuration = 0;
        break;
      case "FLY_OFF":
        this.stateDuration = FLY_OFF_MS / 1000;
        break;
      case "COOLDOWN":
        this.stateDuration = randomRange(COOLDOWN_MIN_MS, COOLDOWN_MAX_MS) / 1000;
        this.cooldownAngle = Math.random() * Math.PI * 2;
        this.cooldownDist = randomRange(COOLDOWN_DIST_MIN, COOLDOWN_DIST_MAX);
        break;
    }
  }

  /**
   * 매 프레임 호출.
   * @param dt 초 단위
   * @param bites 이번 프레임에 문 경우 BiteEvent를 여기에 추가한다 (F-06)
   */
  update(dt: number, face: FaceState, others: Mosquito[], bites: BiteEvent[]) {
    this.stateTimer += dt;
    const done = this.stateTimer >= this.stateDuration;

    switch (this.state) {
      case "SPAWNING":
        // 분열 직후 초기 속도 그대로 날아간다
        this.move(dt, face);
        if (done) this.enter("APPROACH");
        break;

      case "APPROACH":
        this.updateApproach(dt, face, others);
        break;

      case "LANDED":
        // 목표 랜드마크에 고정 — 얼굴과 함께 움직인다
        this.stickToTarget(face);
        if (done) this.bite(bites);
        break;

      case "BITE":
        this.enter("FLY_OFF");
        break;

      case "FLY_OFF":
        this.updateFlyOff(dt, face);
        if (done) this.enter("COOLDOWN");
        break;

      case "COOLDOWN":
        this.updateCooldown(dt, face, others);
        if (done) {
          this.targetLandmarkIndex = randomAnchor();
          this.enter("APPROACH");
        }
        break;
    }

    // 날개 애니메이션 (2프레임, 약 80ms 간격). 앉아 있을 때는 멈춤
    if (this.state === "LANDED" || this.state === "BITE") return;
    this.wingTimer += dt;
    if (this.wingTimer > 0.08) {
      this.wingTimer = 0;
      this.wingFrame = this.wingFrame === 0 ? 1 : 0;
    }
  }

  private updateApproach(dt: number, face: FaceState, others: Mosquito[]) {
    const landmark = face.landmarks[this.targetLandmarkIndex];
    if (!landmark || !face.visible) return;

    const faceWidthPx = face.faceWidthPx || 1;

    // 예측 추적: 목표 위치 = 현재 랜드마크 + 얼굴 속도 * 0.15s
    const predictedX = landmark.x + face.velocity.x * 0.15;
    const predictedY = landmark.y + face.velocity.y * 0.15;
    this.steer(predictedX, predictedY, BASE_MAX_SPEED_FACEW, dt, face, others);
    this.move(dt, face);

    // 목표 랜드마크에 충분히 가까우면 착지
    const d = Math.hypot(landmark.x - this.position.x, landmark.y - this.position.y);
    if (d < LAND_DIST * faceWidthPx) {
      this.enter("LANDED");
      this.stickToTarget(face);
    }
  }

  private stickToTarget(face: FaceState) {
    const landmark = face.landmarks[this.targetLandmarkIndex];
    if (!landmark) return;
    this.position.x = landmark.x;
    this.position.y = landmark.y;
  }

  private bite(bites: BiteEvent[]) {
    this.enter("BITE");
    bites.push({
      anchorIdx: this.targetLandmarkIndex,
      pos: { x: this.position.x, y: this.position.y },
      t: performance.now(),
    });
  }

  private updateFlyOff(dt: number, face: FaceState) {
    // 얼굴 중심 반대 방향으로 일정 속도
    const speed = FLY_OFF_SPEED * (face.faceWidthPx || 1);
    const center = face.landmarks[FACE_CENTER_IDX];
    let dx = 0;
    let dy = -1; // 중심을 모르거나 중심(코끝)에 앉아 있었으면 위로
    if (center) {
      const ox = this.position.x - center.x;
      const oy = this.position.y - center.y;
      const len = Math.hypot(ox, oy);
      if (len > 0.001) {
        dx = ox / len;
        dy = oy / len;
      }
    }
    this.velocity.x = dx * speed;
    this.velocity.y = dy * speed;
    this.move(dt, face);
  }

  private updateCooldown(dt: number, face: FaceState, others: Mosquito[]) {
    const center = face.landmarks[FACE_CENTER_IDX];
    if (!center) {
      this.move(dt, face);
      return;
    }
    // 얼굴 중심에서 1.5~2.5 faceW 떨어진 지점 주위를 배회
    const r = this.cooldownDist * (face.faceWidthPx || 1);
    const tx = center.x + Math.cos(this.cooldownAngle) * r;
    const ty = center.y + Math.sin(this.cooldownAngle) * r;
    this.steer(tx, ty, BASE_MAX_SPEED_FACEW * COOLDOWN_SPEED_RATIO, dt, face, others);
    this.move(dt, face);
  }

  /** 조향: 가속 = normalize(목표 - 위치) * maxSpeed - 속도, 분리 힘 포함 */
  private steer(tx: number, ty: number, maxSpeedFaceW: number, dt: number, face: FaceState, others: Mosquito[]) {
    const faceWidthPx = face.faceWidthPx || 1;
    const maxSpeed = maxSpeedFaceW * faceWidthPx; // px/s
    const maxAccel = MAX_ACCEL_FACEW * faceWidthPx; // px/s^2

    const dx = tx - this.position.x;
    const dy = ty - this.position.y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    let accelX = (dx / dist) * maxSpeed - this.velocity.x;
    let accelY = (dy / dist) * maxSpeed - this.velocity.y;

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
  }

  /** 속도만큼 이동 + 비행감 흔들림 */
  private move(dt: number, face: FaceState) {
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // 비행감: 노이즈로 좌우 흔들림 (진폭 0.05 faceW)
    const wobbleAmp = 0.05 * (face.faceWidthPx || 1);
    const wobble = noise1D(performance.now() / 300, this.noiseSeed) * wobbleAmp;
    this.position.x += wobble * dt * 2;
  }
}
