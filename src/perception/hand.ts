// src/perception/hand.ts
// F-03: 정규화 손 랜드마크 → HandFrame[] (화면 px, 손바닥·반경·쥠·속도).

import type { HandFrame, Vec2 } from '../shared/types';
import { FINGERTIP_IDX, HAND_MIN_CONFIDENCE, HAND_RESET_GAP_MS, PALM_IDX, PALM_R_RATIO, VELOCITY_WINDOW_MS } from './config';
import type { RawHand } from './landmarkers';
import type { Mapper } from './mapper';
import { VelocityTracker } from './velocity';

interface SideState {
  frame: HandFrame;
  vel: VelocityTracker;
  lastSeen: number;
}

function makeSide(side: 'Left' | 'Right'): SideState {
  return {
    frame: { side, palm: { x: 0, y: 0 }, palmR: 0, velocity: { x: 0, y: 0 }, grip: 0, confidence: 0, t: 0 },
    vel: new VelocityTracker(VELOCITY_WINDOW_MS),
    lastSeen: -Infinity,
  };
}

export class HandProcessor {
  /** 이번 프레임 출력 (재사용 배열). 추론이 없는 프레임에는 직전 값을 t 그대로 유지한다 */
  readonly hands: HandFrame[] = [];
  private readonly sides: Record<'Left' | 'Right', SideState> = { Left: makeSide('Left'), Right: makeSide('Right') };
  private readonly p0: Vec2 = { x: 0, y: 0 };
  private readonly p9: Vec2 = { x: 0, y: 0 };
  private readonly tmp: Vec2 = { x: 0, y: 0 };

  reset(): void {
    this.hands.length = 0;
    for (const s of Object.values(this.sides)) {
      s.vel.reset();
      s.lastSeen = -Infinity;
    }
  }

  /** 추론이 돈 프레임에만 호출한다 */
  update(raw: RawHand[], mapper: Mapper, now: number): HandFrame[] {
    this.hands.length = 0;
    for (const h of raw) {
      if (h.score < HAND_MIN_CONFIDENCE || h.landmarks.length < 21) continue;
      const s = this.sides[h.side];
      // 같은 side가 이미 이번 프레임에 들어왔으면(라벨 중복) 두 번째는 버린다
      if (this.hands.includes(s.frame)) continue;
      const f = s.frame;
      const lm = h.landmarks;

      f.palm.x = 0;
      f.palm.y = 0;
      for (const i of PALM_IDX) {
        mapper.toScreen(lm[i].x, lm[i].y, this.tmp);
        f.palm.x += this.tmp.x;
        f.palm.y += this.tmp.y;
      }
      f.palm.x /= PALM_IDX.length;
      f.palm.y /= PALM_IDX.length;

      mapper.toScreen(lm[0].x, lm[0].y, this.p0);
      mapper.toScreen(lm[9].x, lm[9].y, this.p9);
      const p0p9 = Math.hypot(this.p9.x - this.p0.x, this.p9.y - this.p0.y) || 1;
      f.palmR = p0p9 * PALM_R_RATIO;

      let tipSum = 0;
      for (const i of FINGERTIP_IDX) {
        mapper.toScreen(lm[i].x, lm[i].y, this.tmp);
        tipSum += Math.hypot(this.tmp.x - this.p0.x, this.tmp.y - this.p0.y);
      }
      f.grip = tipSum / FINGERTIP_IDX.length / p0p9;
      f.confidence = h.score;

      // 끊겼다 재검출되면 속도가 폭발하지 않게 이력을 비운다
      if (now - s.lastSeen > HAND_RESET_GAP_MS) s.vel.reset();
      s.vel.push(f.palm.x, f.palm.y, now);
      s.vel.velocity(f.velocity);
      s.lastSeen = now;
      f.t = now;
      this.hands.push(f);
    }
    return this.hands;
  }
}
