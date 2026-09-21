import { describe, expect, it } from "vitest";
import type { FrameInput } from "../shared/types";
import { HandHistory } from "./hands";
import { makeHalfImmortal } from "./immortal";
import { Mosquito } from "./mosquito";
import { Swatter } from "./swat";

function tapAt(x: number, y: number): FrameInput {
  return {
    face: { visible: true, landmarks: [], faceW: 200, rotation: 0, velocity: { x: 0, y: 0 }, t: 0 },
    hands: [],
    taps: [{ x, y }],
    now: 0,
    dt: 16,
    viewport: { w: 1000, h: 1000 },
    hasNewDetection: false,
  };
}

describe("분열 모기 절반은 평생 무적", () => {
  it("2마리로 나뉘면 정확히 1마리가 무적", () => {
    for (let i = 0; i < 20; i++) {
      const children = [new Mosquito({ x: 0, y: 0 }, "SPAWNING"), new Mosquito({ x: 0, y: 0 }, "SPAWNING")];
      makeHalfImmortal(children);
      expect(children.filter((m) => m.immortal)).toHaveLength(1);
    }
  });

  it("어느 쪽이 무적인지는 무작위다", () => {
    const pick = (r: number) => {
      const c = [{ immortal: false }, { immortal: false }];
      makeHalfImmortal(c, () => r);
      return c.findIndex((m) => m.immortal);
    };
    expect(pick(0)).toBe(0);
    expect(pick(0.99)).toBe(1);
  });

  it("무적 모기는 분열 직후 무적 시간이 끝나도 잡히지 않는다", () => {
    const immortal = new Mosquito({ x: 500, y: 500 });
    immortal.immortal = true;
    const normal = new Mosquito({ x: 500, y: 500 });
    expect(immortal.state).toBe("APPROACH");
    expect(immortal.isInvulnerable).toBe(true);
    expect(normal.isInvulnerable).toBe(false);

    const killed: Mosquito[] = [];
    new Swatter().judge([immortal, normal], tapAt(500, 500), new HandHistory(), true, (m) => killed.push(m));
    expect(killed).toEqual([normal]);
  });
});
