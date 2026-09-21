// src/perception/face.ts
// F-02: 정규화 얼굴 랜드마크 → FaceFrame(화면 px, One Euro 평활, faceW·rotation·velocity).

import type { FaceFrame, Vec2 } from '../shared/types';
import {
  EXTRAPOLATE_MS,
  FACE_LOST_MS,
  FACE_W_BEFORE_FIRST,
  IDX_EYE_OUTER_L,
  IDX_EYE_OUTER_R,
  IDX_FACE_EDGE_L,
  IDX_FACE_EDGE_R,
  IDX_NOSE,
  LANDMARK_COUNT,
  ONE_EURO_BETA,
  ONE_EURO_D_CUTOFF,
  ONE_EURO_MIN_CUTOFF,
  VELOCITY_WINDOW_MS,
} from './config';
import type { NormPoint } from './landmarkers';
import type { Mapper } from './mapper';
import { OneEuro } from './oneEuro';
import { VelocityTracker } from './velocity';

export class FaceProcessor {
  /** 매 프레임 같은 객체를 돌려준다 (5.2: 배열·객체 재사용) */
  readonly frame: FaceFrame = {
    visible: false,
    landmarks: [],
    faceW: 0,
    rotation: 0,
    velocity: { x: 0, y: 0 },
    t: 0,
  };
  private readonly pool: Vec2[] = Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0, y: 0 }));
  private readonly fx: OneEuro[] = [];
  private readonly fy: OneEuro[] = [];
  private readonly nose = new VelocityTracker(VELOCITY_WINDOW_MS);
  private readonly tmp: Vec2 = { x: 0, y: 0 };
  private everSeen = false;
  private lastSeen = -Infinity;

  constructor() {
    for (let i = 0; i < LANDMARK_COUNT; i++) {
      this.fx.push(new OneEuro(ONE_EURO_MIN_CUTOFF, ONE_EURO_BETA, ONE_EURO_D_CUTOFF));
      this.fy.push(new OneEuro(ONE_EURO_MIN_CUTOFF, ONE_EURO_BETA, ONE_EURO_D_CUTOFF));
    }
  }

  /** 다시 하기·카메라 전환 시. 첫 검출 전 상태로 */
  reset(): void {
    this.everSeen = false;
    this.lastSeen = -Infinity;
    this.frame.landmarks = [];
    this.frame.visible = false;
    this.resetFilters();
  }

  private resetFilters(): void {
    for (let i = 0; i < LANDMARK_COUNT; i++) {
      this.fx[i].reset();
      this.fy[i].reset();
    }
    this.nose.reset();
  }

  /**
   * @param detected 이번 프레임에 인식이 실제로 돌았는지
   * @param norm 인식 결과 (돌았는데 얼굴이 없으면 null)
   * @param dt 직전 프레임과의 간격 ms (외삽용)
   */
  update(detected: boolean, norm: NormPoint[] | null, mapper: Mapper | null, now: number, dt: number, viewportW: number): FaceFrame {
    const f = this.frame;

    if (detected && norm && mapper && norm.length >= LANDMARK_COUNT) {
      // 가려졌다 재검출: 옛 값으로 끌려가지 않게 필터를 비운다
      if (!f.visible) this.resetFilters();
      for (let i = 0; i < LANDMARK_COUNT; i++) {
        mapper.toScreen(norm[i].x, norm[i].y, this.tmp);
        const p = this.pool[i];
        p.x = this.fx[i].filter(this.tmp.x, now);
        p.y = this.fy[i].filter(this.tmp.y, now);
      }
      f.landmarks = this.pool;
      const l = this.pool[IDX_FACE_EDGE_L];
      const r = this.pool[IDX_FACE_EDGE_R];
      f.faceW = Math.hypot(l.x - r.x, l.y - r.y);
      const a = this.pool[IDX_EYE_OUTER_R];
      const b = this.pool[IDX_EYE_OUTER_L];
      f.rotation = Math.atan2(b.y - a.y, b.x - a.x);
      const nose = this.pool[IDX_NOSE];
      this.nose.push(nose.x, nose.y, now);
      this.nose.velocity(f.velocity);
      f.visible = true;
      f.t = now;
      this.everSeen = true;
      this.lastSeen = now;
      return f;
    }

    if (!this.everSeen) {
      f.landmarks = [];
      f.faceW = viewportW * FACE_W_BEFORE_FIRST;
      f.visible = false;
      return f;
    }

    const since = now - this.lastSeen;
    if (since > FACE_LOST_MS) {
      // 손으로 가림·화면 밖: 마지막 자세를 유지한 채 visible=false
      f.visible = false;
      f.velocity.x = 0;
      f.velocity.y = 0;
      return f;
    }

    // 인식이 안 돈 프레임: 마지막 검출 후 100 ms까지 속도로 외삽, 그 뒤는 고정
    if (!detected && since <= EXTRAPOLATE_MS) {
      const ox = (f.velocity.x * dt) / 1000;
      const oy = (f.velocity.y * dt) / 1000;
      for (const p of this.pool) {
        p.x += ox;
        p.y += oy;
      }
    }
    return f;
  }
}
