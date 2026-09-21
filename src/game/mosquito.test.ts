import { describe, expect, it } from "vitest";
import { Mosquito } from "./mosquito";
import { ANCHOR_IDS, LANDED_MS, FLY_OFF_MS, COOLDOWN_MIN_MS, COOLDOWN_MAX_MS } from "./config";
import type { BiteEvent, FaceState, MosquitoState, Vec2 } from "./types";

const DT = 1 / 60;

function makeFace(x: number, y: number): FaceState {
  const landmarks: Record<number, Vec2> = {};
  for (const i of ANCHOR_IDS) landmarks[i] = { x: x + (i % 5) * 10, y: y + (i % 3) * 10 };
  return { landmarks, faceWidthPx: 200, velocity: { x: 0, y: 0 }, visible: true };
}

/** 30초 동안 돌리며 상태 전이와 머문 시간을 기록한다 */
function simulate(onFrame?: (m: Mosquito, frame: number, face: FaceState) => void) {
  const face = makeFace(500, 500);
  const m = new Mosquito({ x: 0, y: 0 });
  const transitions: { from: MosquitoState; to: MosquitoState; stayed: number }[] = [];
  const bites: BiteEvent[] = [];
  let prev = m.state;
  let enteredAt = 0;
  let t = 0;
  for (let f = 0; f < 60 * 30; f++) {
    onFrame?.(m, f, face);
    m.update(DT, face, [m], bites);
    t += DT;
    if (m.state !== prev) {
      transitions.push({ from: prev, to: m.state, stayed: t - enteredAt });
      prev = m.state;
      enteredAt = t;
    }
  }
  return { transitions, bites };
}

const stays = (tr: ReturnType<typeof simulate>["transitions"], from: MosquitoState) =>
  tr.filter((x) => x.from === from).map((x) => x.stayed);

describe("Mosquito F-06 상태 머신", () => {
  it("APPROACH → LANDED → BITE → FLY_OFF → COOLDOWN → APPROACH 순서로 돈다", () => {
    const { transitions } = simulate();
    expect(transitions.slice(0, 5).map((x) => `${x.from}->${x.to}`)).toEqual([
      "APPROACH->LANDED",
      "LANDED->BITE",
      "BITE->FLY_OFF",
      "FLY_OFF->COOLDOWN",
      "COOLDOWN->APPROACH",
    ]);
  });

  it("상태별 시간이 스펙과 같다", () => {
    const { transitions } = simulate();
    for (const s of stays(transitions, "LANDED")) expect(s).toBeCloseTo(LANDED_MS / 1000, 1);
    for (const s of stays(transitions, "BITE")) expect(s).toBeLessThanOrEqual(DT + 1e-9);
    for (const s of stays(transitions, "FLY_OFF")) expect(s).toBeCloseTo(FLY_OFF_MS / 1000, 1);
    for (const s of stays(transitions, "COOLDOWN")) {
      expect(s).toBeGreaterThanOrEqual(COOLDOWN_MIN_MS / 1000 - DT);
      expect(s).toBeLessThanOrEqual(COOLDOWN_MAX_MS / 1000 + DT);
    }
  });

  it("물림 1회당 BiteEvent가 정확히 1건 나가고 anchorIdx는 앵커 후보다", () => {
    const { transitions, bites } = simulate();
    expect(bites.length).toBeGreaterThan(0);
    expect(bites.length).toBe(transitions.filter((x) => x.to === "BITE").length);
    for (const b of bites) expect(ANCHOR_IDS).toContain(b.anchorIdx);
  });

  it("LANDED 중 얼굴이 움직이면 모기도 같이 따라간다", () => {
    let followed = true;
    let landedFrames = 0;
    simulate((m, f, face) => {
      if (m.state !== "LANDED") return;
      landedFrames++;
      const x = 500 + Math.sin(f / 10) * 50;
      for (const i of ANCHOR_IDS) face.landmarks[i].x = x + (i % 5) * 10;
      m.update(0, face, [m], []);
      const a = face.landmarks[m.targetLandmarkIndex];
      if (a.x !== m.position.x || a.y !== m.position.y) followed = false;
    });
    expect(landedFrames).toBeGreaterThan(0);
    expect(followed).toBe(true);
  });

  it("SPAWNING은 무적이고 0.6 s 뒤 APPROACH가 된다", () => {
    const face = makeFace(500, 500);
    const m = new Mosquito({ x: 0, y: 0 }, "SPAWNING");
    expect(m.isInvulnerable).toBe(true);
    for (let i = 0; i < 37; i++) m.update(DT, face, [m], []);
    expect(m.state).toBe("APPROACH");
    expect(m.isInvulnerable).toBe(false);
  });
});
