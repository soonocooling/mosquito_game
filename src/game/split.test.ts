import { describe, expect, it } from "vitest";
import { SPLIT_SPEED_FACEW, SPAWNING_MS } from "./config";
import { Mosquito, split } from "./mosquito";
import { MosquitoManager } from "./mosquitoManager";
import { SwatDetector } from "./swat";
import type { HandState } from "./types";

const FACE_W = 100;

function hand(x: number, t: number, velocityX: number): HandState {
  return {
    handedness: "Left",
    palmCenter: { x, y: 100 },
    palmR: 12,
    velocity: { x: velocityX, y: 0 },
    grip: 1.5,
    t,
  };
}

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
});

describe("F-08 손 스윙 잡기", () => {
  it("빠른 손 선분이 모기를 지나가면 잡는다", () => {
    const detector = new SwatDetector();
    const mosquito = new Mosquito({ x: 100, y: 100 });
    expect(detector.detect([hand(0, 0, 2000)], [mosquito], FACE_W)).toEqual([]);
    expect(detector.detect([hand(200, 100, 2000)], [mosquito], FACE_W)).toEqual([mosquito.id]);
  });

  it("느린 손과 분열 직후 모기는 잡지 않는다", () => {
    const detector = new SwatDetector();
    const normal = new Mosquito({ x: 100, y: 100 });
    detector.detect([hand(0, 0, 100)], [normal], FACE_W);
    expect(detector.detect([hand(200, 100, 100)], [normal], FACE_W)).toEqual([]);

    detector.reset();
    const spawning = new Mosquito({ x: 100, y: 100 }, "SPAWNING", 0);
    detector.detect([hand(0, 200, 2000)], [spawning], FACE_W);
    expect(detector.detect([hand(200, 300, 2000)], [spawning], FACE_W)).toEqual([]);
  });
});
