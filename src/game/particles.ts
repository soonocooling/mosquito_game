// src/game/particles.ts
// F-09 피 튀김: 처치 위치에서 피 방울이 튀고(400 ms, 중력), 바닥 자국 1개가 1.5 s 동안 옅어진다.
// 객체 풀을 미리 만들어 재사용한다 — 연속 처치에도 할당이 없다.

import type { Vec2 } from "../shared/types";
import {
  BLOOD_COLOR,
  BLOOD_COUNT_MAX,
  BLOOD_COUNT_MIN,
  BLOOD_DROP_R,
  BLOOD_GRAVITY,
  BLOOD_LIFE_MS,
  BLOOD_MAX,
  BLOOD_SPEED_MAX,
  BLOOD_SPEED_MIN,
  SPLAT_LIFE_MS,
  SPLAT_MAX,
  SPLAT_R,
} from "./config";

interface Drop {
  x: number;
  y: number;
  vx: number; // px/s
  vy: number;
  bornAt: number;
  alive: boolean;
}

interface Splat {
  x: number;
  y: number;
  r: number; // px
  bornAt: number;
  alive: boolean;
}

export class BloodEffects {
  private readonly drops: Drop[] = Array.from({ length: BLOOD_MAX }, () => ({ x: 0, y: 0, vx: 0, vy: 0, bornAt: 0, alive: false }));
  private readonly splats: Splat[] = Array.from({ length: SPLAT_MAX }, () => ({ x: 0, y: 0, r: 0, bornAt: 0, alive: false }));
  // 링 버퍼 커서: 상한을 넘으면 가장 오래된 것부터 덮어쓴다
  private dropCursor = 0;
  private splatCursor = 0;
  private faceW = 100;

  /** 살아 있는 방울 수 (테스트·디버그용) */
  get dropCount(): number {
    let n = 0;
    for (const d of this.drops) if (d.alive) n++;
    return n;
  }

  get splatCount(): number {
    let n = 0;
    for (const s of this.splats) if (s.alive) n++;
    return n;
  }

  clear(): void {
    for (const d of this.drops) d.alive = false;
    for (const s of this.splats) s.alive = false;
  }

  /** 처치 1건 */
  burst(pos: Vec2, faceW: number, now: number): void {
    this.faceW = faceW;
    const count = BLOOD_COUNT_MIN + Math.floor(Math.random() * (BLOOD_COUNT_MAX - BLOOD_COUNT_MIN + 1));
    for (let i = 0; i < count; i++) {
      const d = this.drops[this.dropCursor];
      this.dropCursor = (this.dropCursor + 1) % BLOOD_MAX;
      const angle = Math.random() * Math.PI * 2;
      const speed = (BLOOD_SPEED_MIN + Math.random() * (BLOOD_SPEED_MAX - BLOOD_SPEED_MIN)) * faceW;
      d.x = pos.x;
      d.y = pos.y;
      d.vx = Math.cos(angle) * speed;
      d.vy = Math.sin(angle) * speed;
      d.bornAt = now;
      d.alive = true;
    }
    const s = this.splats[this.splatCursor];
    this.splatCursor = (this.splatCursor + 1) % SPLAT_MAX;
    s.x = pos.x;
    s.y = pos.y;
    s.r = SPLAT_R * faceW * (0.8 + Math.random() * 0.4);
    s.bornAt = now;
    s.alive = true;
  }

  /** @param dt ms */
  update(dt: number, now: number): void {
    const sec = dt / 1000;
    const g = BLOOD_GRAVITY * this.faceW;
    for (const d of this.drops) {
      if (!d.alive) continue;
      if (now - d.bornAt >= BLOOD_LIFE_MS) {
        d.alive = false;
        continue;
      }
      d.vy += g * sec;
      d.x += d.vx * sec;
      d.y += d.vy * sec;
    }
    for (const s of this.splats) {
      if (s.alive && now - s.bornAt >= SPLAT_LIFE_MS) s.alive = false;
    }
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    ctx.save();
    ctx.fillStyle = BLOOD_COLOR;
    // 자국 먼저 (방울 아래)
    for (const s of this.splats) {
      if (!s.alive) continue;
      ctx.globalAlpha = 0.8 * (1 - (now - s.bornAt) / SPLAT_LIFE_MS);
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.r, s.r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const r = BLOOD_DROP_R * this.faceW;
    for (const d of this.drops) {
      if (!d.alive) continue;
      ctx.globalAlpha = 1 - (now - d.bornAt) / BLOOD_LIFE_MS;
      ctx.beginPath();
      ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
