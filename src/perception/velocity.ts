// src/perception/velocity.ts
// 최근 windowMs 동안의 위치 표본으로 이동평균 속도(px/s)를 구한다. 고정 크기 링버퍼, 할당 없음.

import type { Vec2 } from '../shared/types';

const CAPACITY = 32;

export class VelocityTracker {
  private readonly ts = new Float64Array(CAPACITY);
  private readonly xs = new Float64Array(CAPACITY);
  private readonly ys = new Float64Array(CAPACITY);
  private head = 0; // 다음에 쓸 자리
  private count = 0;
  private readonly windowMs: number;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  reset(): void {
    this.count = 0;
  }

  push(x: number, y: number, t: number): void {
    this.ts[this.head] = t;
    this.xs[this.head] = x;
    this.ys[this.head] = y;
    this.head = (this.head + 1) % CAPACITY;
    if (this.count < CAPACITY) this.count++;
  }

  /** 창 안의 가장 오래된 표본 → 최신 표본 변위 / 시간. 표본이 부족하면 (0,0) */
  velocity(out: Vec2): Vec2 {
    out.x = 0;
    out.y = 0;
    if (this.count < 2) return out;
    const last = (this.head - 1 + CAPACITY) % CAPACITY;
    const tLast = this.ts[last];
    let first = last;
    for (let k = 1; k < this.count; k++) {
      const i = (last - k + CAPACITY) % CAPACITY;
      if (tLast - this.ts[i] > this.windowMs) break;
      first = i;
    }
    const dt = (tLast - this.ts[first]) / 1000;
    if (dt <= 0) return out;
    out.x = (this.xs[last] - this.xs[first]) / dt;
    out.y = (this.ys[last] - this.ys[first]) / dt;
    return out;
  }
}
