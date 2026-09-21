// src/perception/perf.ts
// F-15: 렌더 fps·인식 횟수를 재고, 기준 미달이 이어지면 품질을 한 단계씩 낮춘다.

import type { Quality } from '../shared/types';
import {
  PERF_DOWN_DETECTS,
  PERF_DOWN_FPS,
  PERF_DOWN_HOLD_MS,
  PERF_FPS_WINDOW,
  PERF_GRACE_MS,
  PERF_UP_FPS,
  PERF_UP_HOLD_MS,
} from './config';

/**
 * 단계별 조치 (spec F-15 표). 3번의 "glScale 0.75 → 0.5"는 두 단계로 나눴다.
 * 1 handEvery 3 · 2 numHands 1 · 3 glScale 0.75 · 4 glScale 0.5 · 5 detectScale 0.5
 * 6 maxBites 16 · 7 mosquitoCap 80 · 8 손 인식 끔(복귀하지 않음)
 */
export const MAX_LEVEL = 8;
export const HANDS_OFF_LEVEL = 8;

export function qualityForLevel(base: Quality, level: number): Quality {
  const q: Quality = { ...base, level };
  if (level >= 1) q.handEvery = 3;
  if (level >= 2) q.numHands = 1;
  if (level >= 3) q.glScale = Math.min(base.glScale, 0.75);
  if (level >= 4) q.glScale = Math.min(base.glScale, 0.5);
  if (level >= 5) q.detectScale = Math.min(base.detectScale, 0.5);
  if (level >= 6) q.maxBites = 16;
  if (level >= 7) q.mosquitoCap = Math.min(base.mosquitoCap, 80);
  if (level >= HANDS_OFF_LEVEL) q.handsEnabled = false;
  return q;
}

export class PerfMonitor {
  fps = 0;
  detectsPerSec = 0;
  faceMs = 0;
  handMs = 0;
  private readonly frameTimes = new Float64Array(PERF_FPS_WINDOW);
  private frameIdx = 0;
  private frameCount = 0;
  private prevFrame = 0;
  private detectCount = 0;
  private detectWindowStart = 0;
  private startedAt = 0;
  private lowSince: number | null = null;
  private highSince: number | null = null;
  private readonly base: Quality;
  private current: Quality;

  constructor(base: Quality) {
    this.base = base;
    this.current = qualityForLevel(base, 0);
  }

  get quality(): Quality {
    return this.current;
  }

  /** 게임 시작·재개 시. 대기 중 시간이 fps 계산에 섞이지 않게 */
  start(now: number): void {
    this.startedAt = now;
    this.prevFrame = now;
    this.frameCount = 0;
    this.detectCount = 0;
    this.detectWindowStart = now;
    this.lowSince = null;
    this.highSince = null;
  }

  onFaceDetect(ms: number): void {
    this.faceMs = ms;
    this.detectCount++;
  }

  onHandDetect(ms: number): void {
    this.handMs = ms;
  }

  /** 디버그 패널에서 수동 조절 */
  setLevel(level: number): Quality {
    this.current = qualityForLevel(this.base, Math.max(0, Math.min(MAX_LEVEL, level)));
    this.lowSince = null;
    this.highSince = null;
    return this.current;
  }

  /** 매 프레임. 단계가 바뀌면 새 Quality, 아니면 null */
  tick(now: number): Quality | null {
    const dt = now - this.prevFrame;
    this.prevFrame = now;
    if (dt > 0) {
      this.frameTimes[this.frameIdx] = dt;
      this.frameIdx = (this.frameIdx + 1) % PERF_FPS_WINDOW;
      if (this.frameCount < PERF_FPS_WINDOW) this.frameCount++;
      let sum = 0;
      for (let i = 0; i < this.frameCount; i++) sum += this.frameTimes[i];
      this.fps = (1000 * this.frameCount) / sum;
    }
    if (now - this.detectWindowStart >= 1000) {
      this.detectsPerSec = (this.detectCount * 1000) / (now - this.detectWindowStart);
      this.detectCount = 0;
      this.detectWindowStart = now;
    }
    if (now - this.startedAt < PERF_GRACE_MS) return null;

    const level = this.current.level;
    const low = this.fps < PERF_DOWN_FPS || this.detectsPerSec < PERF_DOWN_DETECTS;
    if (low) {
      this.highSince = null;
      this.lowSince ??= now;
      if (now - this.lowSince >= PERF_DOWN_HOLD_MS && level < MAX_LEVEL) return this.setLevel(level + 1);
    } else {
      this.lowSince = null;
    }
    if (this.fps >= PERF_UP_FPS) {
      this.highSince ??= now;
      if (now - this.highSince >= PERF_UP_HOLD_MS && level > 0 && level < HANDS_OFF_LEVEL) return this.setLevel(level - 1);
    } else {
      this.highSince = null;
    }
    return null;
  }
}
