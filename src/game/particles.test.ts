import { describe, expect, it } from "vitest";
import { BLOOD_COUNT_MAX, BLOOD_COUNT_MIN, BLOOD_LIFE_MS, BLOOD_MAX, SPLAT_LIFE_MS } from "./config";
import { BloodEffects } from "./particles";

const FW = 200;

describe("F-09 피 튀김", () => {
  it("처치 1건에 방울 12~20개와 자국 1개", () => {
    const b = new BloodEffects();
    b.burst({ x: 100, y: 100 }, FW, 0);
    expect(b.dropCount).toBeGreaterThanOrEqual(BLOOD_COUNT_MIN);
    expect(b.dropCount).toBeLessThanOrEqual(BLOOD_COUNT_MAX);
    expect(b.splatCount).toBe(1);
  });

  it("방울은 400 ms 뒤, 자국은 1.5 s 뒤 사라진다 (2 s 후 흔적 없음)", () => {
    const b = new BloodEffects();
    b.burst({ x: 100, y: 100 }, FW, 0);
    b.update(16, BLOOD_LIFE_MS);
    expect(b.dropCount).toBe(0);
    expect(b.splatCount).toBe(1);
    b.update(16, SPLAT_LIFE_MS);
    expect(b.splatCount).toBe(0);
  });

  it("중력으로 아래로 떨어진다", () => {
    const b = new BloodEffects();
    b.burst({ x: 100, y: 100 }, FW, 0);
    // 방울 평균 y가 시간이 지나면 커진다(화면 아래 방향)
    let sumBefore = 0;
    let sumAfter = 0;
    const drops = (b as unknown as { drops: { y: number; alive: boolean }[] }).drops.filter((d) => d.alive);
    for (const d of drops) sumBefore += d.y;
    for (let t = 16; t <= 320; t += 16) b.update(16, t);
    for (const d of drops) sumAfter += d.y;
    expect(sumAfter / drops.length).toBeGreaterThan(sumBefore / drops.length);
  });

  it("연속 처치해도 동시 방울은 상한(500)을 넘지 않는다", () => {
    const b = new BloodEffects();
    for (let i = 0; i < 60; i++) b.burst({ x: i, y: i }, FW, 0);
    expect(b.dropCount).toBeLessThanOrEqual(BLOOD_MAX);
  });

  it("clear()로 모두 지운다 (다시 하기)", () => {
    const b = new BloodEffects();
    b.burst({ x: 1, y: 1 }, FW, 0);
    b.clear();
    expect(b.dropCount).toBe(0);
    expect(b.splatCount).toBe(0);
  });
});
