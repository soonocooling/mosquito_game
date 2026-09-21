// src/render/bites.ts
// F-07 부기 저장소: BiteEvent → 얼굴 로컬 좌표 변환, 병합, 상한, 등장 애니메이션.
// DOM·WebGL에 의존하지 않는 순수 로직이라 단독으로 테스트할 수 있다.

import {
  APPEAR_MS,
  BITE_RADIUS_GROW,
  BITE_RADIUS_INIT,
  BITE_RADIUS_MAX,
  BITE_STRENGTH_INIT,
  BITE_STRENGTH_MAX,
  BITE_STRENGTH_STEP,
  DEFAULT_MAX_BITES,
  MERGE_DIST_RATIO,
  OVERSHOOT_PEAK,
} from './config';
import type { Bite, BiteEvent, FaceFrame, Vec2 } from './types';

/** 저장소 내부 요소. 병합으로 목표가 오를 때 차이분에만 애니메이션을 다시 건다 */
interface StoredBite extends Bite {
  animFrom: number;  // 애니메이션 시작 시점의 세기
  animStart: number; // ms
}

const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);
const easeIn = (t: number): number => t * t;

/** 0→1 진행도 k에 대해 0 → PEAK → 1로 가는 곡선 (F-07) */
export function overshoot(k: number): number {
  if (k <= 0) return 0;
  if (k >= 1) return 1;
  const dip = OVERSHOOT_PEAK - 1;
  return k < 0.5 ? OVERSHOOT_PEAK * easeOut(2 * k) : OVERSHOOT_PEAK - dip * easeIn(2 * k - 1);
}

/** v를 a(rad)만큼 회전해 out에 쓴다 */
export function rotate(x: number, y: number, a: number, out: Vec2): Vec2 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  out.x = x * c - y * s;
  out.y = x * s + y * c;
  return out;
}

export class BiteStore {
  private readonly items: StoredBite[] = [];
  private maxBites = DEFAULT_MAX_BITES;
  private readonly tmp: Vec2 = { x: 0, y: 0 };
  private readonly tmpA: Vec2 = { x: 0, y: 0 };
  private readonly tmpB: Vec2 = { x: 0, y: 0 };

  get bites(): ReadonlyArray<Bite> {
    return this.items;
  }

  get count(): number {
    return this.items.length;
  }

  setMaxBites(n: number): void {
    this.maxBites = n;
  }

  reset(): void {
    this.items.length = 0;
  }

  /**
   * 부기 i의 현재 화면 중심(CSS px)을 out에 쓴다.
   * center = lm[anchorIdx] + rotate(localOffset × faceW, rotation)
   * 앵커 랜드마크가 없으면 false.
   */
  centerOf(b: Bite, face: FaceFrame, out: Vec2): boolean {
    const lm = face.landmarks[b.anchorIdx];
    if (!lm) return false;
    rotate(b.localOffset.x * face.faceW, b.localOffset.y * face.faceW, face.rotation, out);
    out.x += lm.x;
    out.y += lm.y;
    return true;
  }

  /** 이번 프레임 물림 이벤트를 반영한다. 얼굴 랜드마크가 없으면 고정할 곳이 없어 버린다 */
  ingest(events: ReadonlyArray<BiteEvent>, face: FaceFrame, now: number): void {
    for (const ev of events) this.add(ev, face, now);
    this.enforceLimit(face, now);
  }

  private add(ev: BiteEvent, face: FaceFrame, now: number): void {
    const lm = face.landmarks[ev.anchorIdx];
    if (!lm || face.faceW <= 0) return;

    // 가장 가까운 병합 대상 찾기 (화면 px 기준, 거리 < 0.5 × R)
    let best: StoredBite | null = null;
    let bestD = Infinity;
    for (const b of this.items) {
      if (!this.centerOf(b, face, this.tmp)) continue;
      const d = Math.hypot(ev.pos.x - this.tmp.x, ev.pos.y - this.tmp.y);
      if (d < MERGE_DIST_RATIO * b.radius * face.faceW && d < bestD) {
        best = b;
        bestD = d;
      }
    }

    if (best) {
      this.grow(best, now);
      return;
    }

    const local = rotate(
      (ev.pos.x - lm.x) / face.faceW,
      (ev.pos.y - lm.y) / face.faceW,
      -face.rotation,
      { x: 0, y: 0 },
    );
    this.items.push({
      anchorIdx: ev.anchorIdx,
      localOffset: local,
      radius: BITE_RADIUS_INIT,
      strength: 0,
      targetStrength: BITE_STRENGTH_INIT,
      createdAt: now,
      animFrom: 0,
      animStart: now,
    });
  }

  /** 반경·목표 세기를 올리고, 현재 세기에서 새 목표까지 애니메이션을 다시 시작한다 */
  private grow(b: StoredBite, now: number): void {
    b.radius = Math.min(b.radius * BITE_RADIUS_GROW, BITE_RADIUS_MAX);
    b.targetStrength = Math.min(b.targetStrength + BITE_STRENGTH_STEP, BITE_STRENGTH_MAX);
    b.animFrom = b.strength;
    b.animStart = now;
  }

  /** 상한을 넘으면 화면상 가장 가까운 두 부기를 하나로 합친다 */
  private enforceLimit(face: FaceFrame, now: number): void {
    while (this.items.length > this.maxBites) {
      let bi = -1;
      let bj = -1;
      let bestD = Infinity;
      for (let i = 0; i < this.items.length; i++) {
        if (!this.centerOf(this.items[i], face, this.tmpA)) continue;
        for (let j = i + 1; j < this.items.length; j++) {
          if (!this.centerOf(this.items[j], face, this.tmpB)) continue;
          const d = Math.hypot(this.tmpA.x - this.tmpB.x, this.tmpA.y - this.tmpB.y);
          if (d < bestD) {
            bestD = d;
            bi = i;
            bj = j;
          }
        }
      }
      // 랜드마크가 없어 위치를 못 구하면 가장 오래된 두 개를 합친다
      if (bi < 0) {
        bi = 0;
        bj = 1;
      }
      this.mergePair(bi, bj, face, now);
    }
  }

  /** j를 i에 합친다. 중심은 두 중심의 중점, 앵커는 i의 것을 유지 */
  private mergePair(i: number, j: number, face: FaceFrame, now: number): void {
    const a = this.items[i];
    const b = this.items[j];
    const hasA = this.centerOf(a, face, this.tmpA);
    const hasB = this.centerOf(b, face, this.tmpB);
    const lm = face.landmarks[a.anchorIdx];
    if (hasA && hasB && lm && face.faceW > 0) {
      const mx = (this.tmpA.x + this.tmpB.x) / 2;
      const my = (this.tmpA.y + this.tmpB.y) / 2;
      rotate((mx - lm.x) / face.faceW, (my - lm.y) / face.faceW, -face.rotation, a.localOffset);
    }
    a.radius = Math.max(a.radius, b.radius);
    a.targetStrength = Math.max(a.targetStrength, b.targetStrength);
    a.strength = Math.max(a.strength, b.strength);
    this.grow(a, now);
    this.items.splice(j, 1);
  }

  /** 등장·병합 애니메이션을 진행한다 */
  animate(now: number): void {
    for (const b of this.items) {
      const k = (now - b.animStart) / APPEAR_MS;
      b.strength = b.animFrom + (b.targetStrength - b.animFrom) * overshoot(k);
    }
  }

  /**
   * 셰이더 uBites용 vec4 배열을 채운다: [cx/W, cy/H, radius×faceW/H, strength].
   * 채운 개수를 반환한다.
   */
  writeUniforms(face: FaceFrame, W: number, H: number, out: Float32Array): number {
    const cap = out.length / 4;
    let n = 0;
    for (const b of this.items) {
      if (n >= cap) break;
      if (!this.centerOf(b, face, this.tmp)) continue;
      const o = n * 4;
      out[o] = this.tmp.x / W;
      out[o + 1] = this.tmp.y / H;
      out[o + 2] = (b.radius * face.faceW) / H;
      out[o + 3] = b.strength;
      n++;
    }
    return n;
  }
}
