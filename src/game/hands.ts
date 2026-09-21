// src/game/hands.ts
// F-08 손 이력: side별로 최근 300 ms의 {t, palm, grip}을 쌓는다.
// HandFrame.t가 바뀔 때만 push(같은 t는 새 검출이 아님). 그 side가 이번 프레임에 없으면 비운다.

import type { HandFrame } from "../shared/types";
import { HAND_HISTORY_MS } from "./config";

export interface HandSample {
  t: number;
  x: number;
  y: number;
  grip: number;
}

const CAPACITY = 32;

export class HandTrack {
  /** 오래된 것 → 최신 순. 객체는 풀에서 재사용 */
  readonly samples: HandSample[] = [];
  private readonly pool: HandSample[] = Array.from({ length: CAPACITY }, () => ({ t: 0, x: 0, y: 0, grip: 0 }));
  private poolIdx = 0;
  /** 이번 프레임에 새 표본이 들어왔는지 (스윙 선분 판정은 새 표본이 있을 때만) */
  fresh = false;

  clear(): void {
    this.samples.length = 0;
    this.fresh = false;
  }

  push(h: HandFrame): void {
    const s = this.pool[this.poolIdx];
    this.poolIdx = (this.poolIdx + 1) % CAPACITY;
    s.t = h.t;
    s.x = h.palm.x;
    s.y = h.palm.y;
    s.grip = h.grip;
    this.samples.push(s);
    // 300 ms보다 오래된 것은 버리되, 최소 2개는 남겨 선분을 만들 수 있게 한다
    while (this.samples.length > 2 && h.t - this.samples[0].t > HAND_HISTORY_MS) this.samples.shift();
    if (this.samples.length > CAPACITY - 1) this.samples.shift();
    this.fresh = true;
  }

  get last(): HandSample | undefined {
    return this.samples[this.samples.length - 1];
  }

  get prev(): HandSample | undefined {
    return this.samples[this.samples.length - 2];
  }

  /** t - windowMs 이후 표본 중 가장 오래된 것 */
  since(t: number, windowMs: number): HandSample | undefined {
    for (const s of this.samples) if (t - s.t <= windowMs) return s;
    return undefined;
  }

  /** t - windowMs 이후 표본의 최대 grip */
  maxGripSince(t: number, windowMs: number): number {
    let m = 0;
    for (const s of this.samples) if (t - s.t <= windowMs && s.grip > m) m = s.grip;
    return m;
  }
}

export class HandHistory {
  readonly left = new HandTrack();
  readonly right = new HandTrack();

  track(side: "Left" | "Right"): HandTrack {
    return side === "Left" ? this.left : this.right;
  }

  clear(): void {
    this.left.clear();
    this.right.clear();
  }

  update(hands: ReadonlyArray<HandFrame>): void {
    this.left.fresh = false;
    this.right.fresh = false;
    let seenLeft = false;
    let seenRight = false;
    for (const h of hands) {
      const tr = this.track(h.side);
      if (h.side === "Left") seenLeft = true;
      else seenRight = true;
      if (tr.last?.t !== h.t) tr.push(h);
    }
    if (!seenLeft) this.left.clear();
    if (!seenRight) this.right.clear();
  }
}
