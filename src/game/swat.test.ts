import { describe, expect, it } from "vitest";
import type { FaceFrame, FrameInput, HandFrame, Vec2 } from "../shared/types";
import { HandHistory } from "./hands";
import { distPointSeg, Swatter, type SwatKind, type Swattable } from "./swat";

const FW = 200; // faceW px

function face(): FaceFrame {
  return { visible: true, landmarks: [], faceW: FW, rotation: 0, velocity: { x: 0, y: 0 }, t: 0 };
}

function hand(side: "Left" | "Right", x: number, y: number, t: number, opts: Partial<HandFrame> = {}): HandFrame {
  return { side, palm: { x, y }, palmR: 30, velocity: { x: 0, y: 0 }, grip: 1.9, confidence: 0.9, t, ...opts };
}

function input(now: number, hands: HandFrame[], taps: Vec2[] = []): FrameInput {
  return { face: face(), hands, taps, now, dt: 16, viewport: { w: 1000, h: 1000 }, hasNewDetection: true };
}

function mosq(x: number, y: number, isInvulnerable = false): Swattable {
  return { position: { x, y }, isInvulnerable };
}

/** 손 프레임을 순서대로 넣으며 판정하고, 처치된 종류를 모은다 */
function run(frames: { now: number; hands: HandFrame[]; taps?: Vec2[] }[], mosquitoes: Swattable[], handsEnabled = true) {
  const history = new HandHistory();
  const swatter = new Swatter();
  const kills: SwatKind[] = [];
  for (const f of frames) {
    const inp = input(f.now, f.hands, f.taps);
    history.update(inp.hands);
    swatter.judge(mosquitoes, inp, history, handsEnabled, (_m, kind) => kills.push(kind));
  }
  return kills;
}

describe("distPointSeg", () => {
  it("선분 위·끝점 밖 거리", () => {
    expect(distPointSeg(5, 3, 0, 0, 10, 0)).toBeCloseTo(3);
    expect(distPointSeg(-4, 3, 0, 0, 10, 0)).toBeCloseTo(5);
  });
});

describe("F-08 잡기 판정", () => {
  const fast = { velocity: { x: 3 * FW, y: 0 } }; // 3 faceW/s
  const slow = { velocity: { x: 0.5 * FW, y: 0 } };

  it("스윙: 빠른 손이 모기를 지나가면 죽는다 (한 프레임에 건너뛰어도 선분으로 판정)", () => {
    const kills = run(
      [
        { now: 0, hands: [hand("Right", 100, 500, 0, fast)] },
        { now: 33, hands: [hand("Right", 400, 500, 33, fast)] }, // 모기(250,500)를 한 번에 지나감
      ],
      [mosq(250, 500)],
    );
    expect(kills).toEqual(["swing"]);
  });

  it("천천히 모기 위에 손을 올려두면 죽지 않는다", () => {
    const kills = run(
      [
        { now: 0, hands: [hand("Right", 240, 500, 0, slow)] },
        { now: 33, hands: [hand("Right", 250, 500, 33, slow)] },
      ],
      [mosq(250, 500)],
    );
    expect(kills).toEqual([]);
  });

  it("분열 직후(무적) 모기는 같은 스윙으로 죽지 않는다", () => {
    const kills = run(
      [
        { now: 0, hands: [hand("Right", 100, 500, 0, fast)] },
        { now: 33, hands: [hand("Right", 400, 500, 33, fast)] },
      ],
      [mosq(250, 500, true)],
    );
    expect(kills).toEqual([]);
  });

  it("같은 검출(t가 같음)이 반복되면 새 선분을 만들지 않는다", () => {
    const kills = run(
      [
        { now: 0, hands: [hand("Right", 100, 500, 0, fast)] },
        { now: 16, hands: [hand("Right", 100, 500, 0, fast)] },
      ],
      [mosq(250, 500)],
    );
    expect(kills).toEqual([]);
  });

  it("움켜쥐기: 손바닥 안의 모기를 200 ms 안에 편 손 → 주먹", () => {
    const kills = run(
      [
        { now: 0, hands: [hand("Right", 500, 500, 0, { grip: 1.9 })] },
        { now: 100, hands: [hand("Right", 500, 500, 100, { grip: 1.0 })] },
      ],
      [mosq(510, 505)],
    );
    expect(kills).toEqual(["grab"]);
  });

  it("박수: 두 손이 150 ms 안에 가까워지면 사이의 모기가 죽는다", () => {
    const kills = run(
      [
        { now: 0, hands: [hand("Left", 300, 500, 0), hand("Right", 700, 500, 0)] },
        { now: 100, hands: [hand("Left", 470, 500, 100), hand("Right", 530, 500, 100)] },
      ],
      [mosq(500, 510)],
    );
    expect(kills).toEqual(["clap"]);
  });

  it("클릭: 반경 0.12 faceW 안의 모기가 죽고, 손 인식을 꺼도 동작한다", () => {
    const kills = run([{ now: 0, hands: [], taps: [{ x: 510, y: 500 }] }], [mosq(500, 500), mosq(800, 800)], false);
    expect(kills).toEqual(["tap"]);
  });

  it("손 인식이 꺼지면 스윙은 판정하지 않는다", () => {
    const kills = run(
      [
        { now: 0, hands: [hand("Right", 100, 500, 0, fast)] },
        { now: 33, hands: [hand("Right", 400, 500, 33, fast)] },
      ],
      [mosq(250, 500)],
      false,
    );
    expect(kills).toEqual([]);
  });

  it("한 동작으로 여러 마리를 동시에 잡지만 같은 모기는 한 번만", () => {
    const kills = run(
      [
        { now: 0, hands: [hand("Right", 100, 500, 0, fast)] },
        { now: 33, hands: [hand("Right", 400, 500, 33, fast)], taps: [{ x: 200, y: 500 }] },
      ],
      [mosq(200, 500), mosq(300, 500)],
    );
    expect(kills.sort()).toEqual(["swing", "tap"]);
  });
});
