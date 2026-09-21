import { describe, expect, it } from 'vitest';
import { FACE_LOST_MS, LANDMARK_COUNT, QUALITY_DESKTOP } from './config';
import { FaceProcessor } from './face';
import { HandProcessor } from './hand';
import type { NormPoint, RawHand } from './landmarkers';
import { makeMapper } from './mapper';
import { MAX_LEVEL, PerfMonitor, qualityForLevel } from './perf';
import { VelocityTracker } from './velocity';

describe('mapper (5.1)', () => {
  it('거울 반전: 영상 왼쪽 끝(nx=0)이 화면 오른쪽 끝이 된다', () => {
    const m = makeMapper(1280, 720, 1280, 720);
    const p = m.toScreen(0, 0, { x: 0, y: 0 });
    expect(p.x).toBeCloseTo(1280);
    expect(p.y).toBeCloseTo(0);
  });

  it('cover 크롭: 화면이 더 넓으면 위아래를 잘라 가운데를 맞춘다', () => {
    const m = makeMapper(640, 480, 1280, 720); // s = 2, 세로 960 중 720만 보임
    expect(m.s).toBeCloseTo(2);
    expect(m.oy).toBeCloseTo(-120);
    const center = m.toScreen(0.5, 0.5, { x: 0, y: 0 });
    expect(center.x).toBeCloseTo(640);
    expect(center.y).toBeCloseTo(360);
  });
});

describe('VelocityTracker', () => {
  it('최근 100 ms 이동평균 속도(px/s)', () => {
    const v = new VelocityTracker(100);
    for (let t = 0; t <= 200; t += 20) v.push(t, 0, t); // 1 px/ms = 1000 px/s
    const out = v.velocity({ x: 0, y: 0 });
    expect(out.x).toBeCloseTo(1000);
    expect(out.y).toBeCloseTo(0);
  });

  it('표본이 1개면 0', () => {
    const v = new VelocityTracker(100);
    v.push(5, 5, 0);
    expect(v.velocity({ x: 1, y: 1 })).toEqual({ x: 0, y: 0 });
  });
});

function normFace(cx: number, cy: number): NormPoint[] {
  const pts = Array.from({ length: LANDMARK_COUNT }, () => ({ x: cx, y: cy }));
  pts[234] = { x: cx + 0.1, y: cy }; // 영상 기준 오른쪽 → 거울 후 화면 왼쪽
  pts[454] = { x: cx - 0.1, y: cy };
  pts[33] = { x: cx + 0.05, y: cy };
  pts[263] = { x: cx - 0.05, y: cy };
  return pts;
}

describe('FaceProcessor (F-02)', () => {
  const mapper = makeMapper(1000, 1000, 1000, 1000);

  it('첫 검출 전: landmarks 없음, faceW = viewport.w × 0.35', () => {
    const f = new FaceProcessor().update(false, null, mapper, 0, 16, 1000);
    expect(f.landmarks.length).toBe(0);
    expect(f.faceW).toBeCloseTo(350);
    expect(f.visible).toBe(false);
  });

  it('검출되면 478점, faceW, 양 눈이 수평이면 rotation 0', () => {
    const f = new FaceProcessor().update(true, normFace(0.5, 0.5), mapper, 0, 16, 1000);
    expect(f.visible).toBe(true);
    expect(f.landmarks.length).toBe(LANDMARK_COUNT);
    expect(f.faceW).toBeCloseTo(200);
    expect(f.rotation).toBeCloseTo(0);
  });

  it('500 ms 넘게 못 찾으면 visible=false, 마지막 자세는 유지', () => {
    const p = new FaceProcessor();
    p.update(true, normFace(0.5, 0.5), mapper, 0, 16, 1000);
    const lost = p.update(true, null, mapper, FACE_LOST_MS + 1, 16, 1000);
    expect(lost.visible).toBe(false);
    expect(lost.landmarks.length).toBe(LANDMARK_COUNT);
    expect(lost.velocity).toEqual({ x: 0, y: 0 });
  });

  it('배열·객체를 재사용한다 (매 프레임 새로 만들지 않음)', () => {
    const p = new FaceProcessor();
    const a = p.update(true, normFace(0.5, 0.5), mapper, 0, 16, 1000);
    const lm0 = a.landmarks[0];
    const b = p.update(true, normFace(0.4, 0.5), mapper, 33, 16, 1000);
    expect(b).toBe(a);
    expect(b.landmarks[0]).toBe(lm0);
  });
});

function normHand(cx: number, cy: number, open: boolean, score = 0.9, side: 'Left' | 'Right' = 'Right'): RawHand {
  const lm = Array.from({ length: 21 }, () => ({ x: cx, y: cy }));
  lm[9] = { x: cx, y: cy - 0.1 }; // |p0 - p9| = 0.1
  for (const i of [4, 8, 12, 16, 20]) lm[i] = { x: cx, y: cy - (open ? 0.2 : 0.1) };
  return { landmarks: lm, side, score };
}

describe('HandProcessor (F-03)', () => {
  const mapper = makeMapper(1000, 1000, 1000, 1000);

  it('편 손 grip ≈ 2, 주먹 grip ≈ 1', () => {
    const h = new HandProcessor();
    expect(h.update([normHand(0.5, 0.5, true)], mapper, 0)[0].grip).toBeCloseTo(2);
    expect(h.update([normHand(0.5, 0.5, false)], mapper, 16)[0].grip).toBeCloseTo(1);
  });

  it('confidence 0.5 미만은 내보내지 않는다', () => {
    expect(new HandProcessor().update([normHand(0.5, 0.5, true, 0.3)], mapper, 0)).toHaveLength(0);
  });

  it('200 ms 넘게 끊겼다 재검출되면 속도가 (0,0)부터', () => {
    const h = new HandProcessor();
    h.update([normHand(0.2, 0.5, true)], mapper, 0);
    const f = h.update([normHand(0.8, 0.5, true)], mapper, 300)[0];
    expect(f.velocity).toEqual({ x: 0, y: 0 });
  });
});

describe('F-15 품질 단계', () => {
  it('단계가 오를수록 누적해서 낮아지고, 마지막 단계는 손 인식을 끈다', () => {
    expect(qualityForLevel(QUALITY_DESKTOP, 0)).toEqual(QUALITY_DESKTOP);
    const q4 = qualityForLevel(QUALITY_DESKTOP, 4);
    expect(q4.handEvery).toBe(3);
    expect(q4.numHands).toBe(1);
    expect(q4.glScale).toBe(0.5);
    expect(qualityForLevel(QUALITY_DESKTOP, MAX_LEVEL).handsEnabled).toBe(false);
  });

  it('fps가 5 s 연속 20 미만이면 한 단계 내린다', () => {
    const p = new PerfMonitor(QUALITY_DESKTOP);
    p.start(0);
    let changed = null;
    for (let t = 0; t <= 9000 && !changed; t += 100) {
      p.onFaceDetect(1);
      changed = p.tick(t); // 10 fps
    }
    expect(changed?.level).toBe(1);
  });
});
