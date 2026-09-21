import { describe, expect, it } from "vitest";
import { Mosquito } from "./mosquito";
import { MosquitoManager } from "./mosquitoManager";

describe("모기는 화면 밖으로 나가지 않는다", () => {
  it("밖으로 나간 모기를 가장자리 안쪽으로 밀어 넣고, 바깥으로 향하던 속도를 없앤다", () => {
    const manager = new MosquitoManager();
    const left = new Mosquito({ x: -50, y: 300 });
    left.velocity = { x: -100, y: 20 };
    const bottomRight = new Mosquito({ x: 1200, y: 900 });
    bottomRight.velocity = { x: 50, y: 60 };
    manager.mosquitoes.push(left, bottomRight);

    manager.confine(1000, 800, 24);

    expect(left.position).toEqual({ x: 24, y: 300 });
    expect(left.velocity).toEqual({ x: 0, y: 20 }); // 화면 안쪽/옆 방향 속도는 유지
    expect(bottomRight.position).toEqual({ x: 976, y: 776 });
    expect(bottomRight.velocity).toEqual({ x: 0, y: 0 });
  });

  it("화면 안의 모기는 건드리지 않는다", () => {
    const manager = new MosquitoManager();
    const inside = new Mosquito({ x: 500, y: 400 });
    inside.velocity = { x: -30, y: 40 };
    manager.mosquitoes.push(inside);
    manager.confine(1000, 800, 24);
    expect(inside.position).toEqual({ x: 500, y: 400 });
    expect(inside.velocity).toEqual({ x: -30, y: 40 });
  });

  it("화면 밖에서 생성된 모기도 첫 프레임에 화면 안으로 들어온다", () => {
    const manager = new MosquitoManager();
    for (let i = 0; i < 20; i++) manager.spawnFromEdge(1000, 800);
    manager.confine(1000, 800, 24);
    for (const m of manager.mosquitoes) {
      expect(m.position.x).toBeGreaterThanOrEqual(24);
      expect(m.position.x).toBeLessThanOrEqual(976);
      expect(m.position.y).toBeGreaterThanOrEqual(24);
      expect(m.position.y).toBeLessThanOrEqual(776);
    }
  });
});
