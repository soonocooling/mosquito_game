import { describe, expect, it } from 'vitest';
import { BiteStore, overshoot } from './bites';
import type { FaceFrame, Vec2 } from '../shared/types';

function makeFace(x: number, y: number, faceW = 200, rotation = 0): FaceFrame {
  const landmarks = Array.from({ length: 478 }, () => ({ x, y }));
  return { visible: true, landmarks, faceW, rotation, velocity: { x: 0, y: 0 }, t: 0 };
}

function moveFace(face: FaceFrame, x: number, y: number): void {
  for (const p of face.landmarks) {
    p.x = x;
    p.y = y;
  }
}

describe('overshoot', () => {
  it('0 → 1.3 → 1 곡선', () => {
    expect(overshoot(0)).toBe(0);
    expect(overshoot(0.5)).toBeCloseTo(1.3);
    expect(overshoot(1)).toBe(1);
  });
});

describe('BiteStore', () => {
  it('물린 자리를 얼굴 로컬 좌표(faceW 단위)로 저장한다', () => {
    const s = new BiteStore();
    s.ingest([{ anchorIdx: 1, pos: { x: 540, y: 500 }, t: 0 }], makeFace(500, 500), 0);
    expect(s.count).toBe(1);
    expect(s.bites[0].localOffset.x).toBeCloseTo(0.2);
    expect(s.bites[0].localOffset.y).toBeCloseTo(0);
  });

  it('얼굴이 움직이고 회전해도 부기가 같은 피부 자리에 붙어 있다', () => {
    const s = new BiteStore();
    const face = makeFace(500, 500);
    s.ingest([{ anchorIdx: 1, pos: { x: 540, y: 500 }, t: 0 }], face, 0);
    moveFace(face, 300, 100);
    face.rotation = Math.PI / 2;
    const c: Vec2 = { x: 0, y: 0 };
    s.centerOf(s.bites[0], face, c);
    expect(c.x).toBeCloseTo(300);
    expect(c.y).toBeCloseTo(140);
  });

  it('같은 볼을 5번 물리면 1개로 병합되고 커진다', () => {
    const s = new BiteStore();
    const face = makeFace(500, 500);
    for (let i = 0; i < 5; i++) s.ingest([{ anchorIdx: 1, pos: { x: 541, y: 501 }, t: 0 }], face, i * 100);
    expect(s.count).toBe(1);
    expect(s.bites[0].targetStrength).toBeCloseTo(0.6); // 상한
    expect(s.bites[0].radius).toBeCloseTo(0.12 * 1.1 ** 4);
  });

  it('멀리 떨어진 물림은 새 부기가 된다', () => {
    const s = new BiteStore();
    const face = makeFace(500, 500);
    s.ingest([{ anchorIdx: 1, pos: { x: 540, y: 500 }, t: 0 }], face, 0);
    s.ingest([{ anchorIdx: 1, pos: { x: 500, y: 300 }, t: 0 }], face, 0);
    expect(s.count).toBe(2);
  });

  it('등장 애니메이션은 목표를 넘었다가 600 ms에 목표로 안착한다', () => {
    const s = new BiteStore();
    s.ingest([{ anchorIdx: 1, pos: { x: 540, y: 500 }, t: 0 }], makeFace(500, 500), 0);
    s.animate(300);
    expect(s.bites[0].strength).toBeGreaterThan(0.25);
    s.animate(600);
    expect(s.bites[0].strength).toBeCloseTo(0.25);
  });

  it('상한(32)을 넘으면 가장 가까운 두 개를 병합하고, 16으로 내리면 즉시 줄어든다', () => {
    const s = new BiteStore();
    const face = makeFace(500, 500);
    const events = Array.from({ length: 40 }, (_, i) => ({
      anchorIdx: 1,
      pos: { x: 300 + (i % 8) * 60, y: 380 + Math.floor(i / 8) * 60 },
      t: 0,
    }));
    s.ingest(events, face, 0);
    expect(s.count).toBe(32);
    s.setMaxBites(16);
    s.ingest([], face, 0);
    expect(s.count).toBe(16);
  });

  it('첫 검출 전(랜드마크 없음) 이벤트는 버린다', () => {
    const s = new BiteStore();
    const face = makeFace(0, 0);
    face.landmarks = [];
    s.ingest([{ anchorIdx: 1, pos: { x: 1, y: 1 }, t: 0 }], face, 0);
    expect(s.count).toBe(0);
  });

  it('셰이더 uniform을 [cx/W, cy/H, r/H, strength]로 채운다', () => {
    const s = new BiteStore();
    const face = makeFace(500, 1000);
    s.ingest([{ anchorIdx: 1, pos: { x: 500, y: 1000 }, t: 0 }], face, 0);
    s.animate(1000);
    const u = new Float32Array(32 * 4);
    expect(s.writeUniforms(face, 1000, 2000, u)).toBe(1);
    expect(u[0]).toBeCloseTo(0.5);
    expect(u[1]).toBeCloseTo(0.5);
    expect(u[2]).toBeCloseTo((0.12 * 200) / 2000);
    expect(u[3]).toBeCloseTo(0.25);
  });
});
