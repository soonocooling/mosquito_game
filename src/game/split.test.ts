import { describe, expect, it } from "vitest";
import { SPLIT_SPEED_FACEW, SPAWNING_MS } from "./config";
import { Mosquito, split } from "./mosquito";
import { MosquitoManager } from "./mosquitoManager";

const FACE_W = 100;

describe("F-10 모기 분열", () => {
  it("잡힌 위치에서 서로 반대 방향으로 두 마리가 생성된다", () => {
    const now = 1000;
    const [first, second] = split({ x: 30, y: 40 }, FACE_W, now, 0);
    expect(first.position).toEqual({ x: 30, y: 40 });
    expect(second.position).toEqual({ x: 30, y: 40 });
    expect(first.state).toBe("SPAWNING");
    expect(second.state).toBe("SPAWNING");
    expect(first.velocity).toEqual({ x: SPLIT_SPEED_FACEW * FACE_W, y: 0 });
    expect(second.velocity).toEqual({ x: -SPLIT_SPEED_FACEW * FACE_W, y: -0 });
    expect(first.invulnUntil).toBe(now + SPAWNING_MS);
    expect(second.invulnUntil).toBe(now + SPAWNING_MS);
  });

  it("10회 처치하면 모기 수가 1마리에서 11마리가 된다", () => {
    const manager = new MosquitoManager();
    manager.mosquitoes.push(new Mosquito({ x: 100, y: 100 }));
    for (let kill = 0; kill < 10; kill += 1) {
      const target = manager.mosquitoes[0];
      target.state = "APPROACH";
      expect(manager.splitById(target.id, FACE_W, kill * 1000)).toBe(true);
    }
    expect(manager.mosquitoes).toHaveLength(11);
  });

  it("모기 수 상한이 없다 — 200마리가 넘어도 계속 분열한다", () => {
    const manager = new MosquitoManager();
    for (let i = 0; i < 250; i += 1) manager.mosquitoes.push(new Mosquito({ x: i, y: i }));
    const target = manager.mosquitoes[0];
    expect(manager.splitById(target.id, FACE_W, 0)).toBe(true);
    expect(manager.mosquitoes).toHaveLength(251);
  });
});
