// src/perception/oneEuro.ts
// One Euro 필터 (Casiez et al.). 느리게 움직일 때는 많이 평활, 빠를 때는 반응성 유지 (F-02).
// erasableSyntaxOnly 때문에 파라미터 프로퍼티를 쓰지 않는다.

export class OneEuro {
  private xPrev = Number.NaN;
  private dxPrev = 0;
  private tPrev = 0;
  private readonly minCutoff: number;
  private readonly beta: number;
  private readonly dCutoff: number;

  constructor(minCutoff = 1.0, beta = 0.01, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  reset(): void {
    this.xPrev = Number.NaN;
    this.dxPrev = 0;
  }

  private static alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  filter(x: number, t: number): number {
    if (Number.isNaN(this.xPrev)) {
      this.xPrev = x;
      this.tPrev = t;
      return x;
    }
    const dt = Math.max((t - this.tPrev) / 1000, 1e-3);
    this.tPrev = t;
    const dx = (x - this.xPrev) / dt;
    const dxHat = this.dxPrev + OneEuro.alpha(this.dCutoff, dt) * (dx - this.dxPrev);
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const xHat = this.xPrev + OneEuro.alpha(cutoff, dt) * (x - this.xPrev);
    this.xPrev = xHat;
    this.dxPrev = dxHat;
    return xHat;
  }
}
