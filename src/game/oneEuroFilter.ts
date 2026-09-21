// F-02 요구사항: "떨림 제거: One Euro Filter로 랜드마크 평활화"
// 참고: 표준 One Euro Filter 공식 (Casiez et al.) — 값이 느리게 움직일 때는 많이 스무딩하고,
// 빠르게 움직일 때는 스무딩을 줄여 반응성을 살리는 필터.

function smoothingAlpha(cutoffHz: number, dtSec: number): number {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dtSec);
}

export class OneEuroFilter1D {
  private readonly minCutoff: number;
  private readonly beta: number;
  private readonly dCutoff: number;
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrevMs: number | null = null;

  constructor(minCutoff = 1.0, beta = 0.3, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  filter(x: number, timestampMs: number): number {
    if (this.tPrevMs === null || this.xPrev === null) {
      this.tPrevMs = timestampMs;
      this.xPrev = x;
      this.dxPrev = 0;
      return x;
    }

    const dt = Math.max((timestampMs - this.tPrevMs) / 1000, 1 / 240);
    this.tPrevMs = timestampMs;

    const dx = (x - this.xPrev) / dt;
    const aD = smoothingAlpha(this.dCutoff, dt);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;
    this.dxPrev = dxHat;

    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = smoothingAlpha(cutoff, dt);
    const xHat = a * x + (1 - a) * this.xPrev;
    this.xPrev = xHat;

    return xHat;
  }
}

export interface Point2 {
  x: number;
  y: number;
}

export class OneEuroFilter2D {
  private readonly fx: OneEuroFilter1D;
  private readonly fy: OneEuroFilter1D;

  constructor(minCutoff = 1.0, beta = 0.3, dCutoff = 1.0) {
    this.fx = new OneEuroFilter1D(minCutoff, beta, dCutoff);
    this.fy = new OneEuroFilter1D(minCutoff, beta, dCutoff);
  }

  filter(p: Point2, timestampMs: number): Point2 {
    return {
      x: this.fx.filter(p.x, timestampMs),
      y: this.fy.filter(p.y, timestampMs),
    };
  }
}
