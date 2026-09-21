// src/perception/index.ts
// A의 Perception 구현 (spec 5.2): 새 비디오 프레임일 때만 인식하고, 매 프레임 FrameInput을 돌려준다.

import type { FrameInput, Perception, Quality, Vec2 } from '../shared/types';
import { DT_MAX_MS } from './config';
import { FaceProcessor } from './face';
import { HandProcessor } from './hand';
import {
  createLiveSource,
  type DetectImage,
  type LandmarkSource,
  type LoadStage,
  type NormPoint,
} from './landmarkers';
import { makeMapper, type Mapper } from './mapper';
import type { PerfMonitor } from './perf';


export class PerceptionImpl implements Perception {
  private source: LandmarkSource | null = null;
  private video: HTMLVideoElement | null = null;
  private mapper: Mapper | null = null;
  private readonly face = new FaceProcessor();
  private readonly hand = new HandProcessor();
  private readonly perf: PerfMonitor;
  private quality: Quality;
  private lastVideoTime = -1;
  private loggedError = false;
  private prevNow = 0;
  private frameNo = 0;
  private readonly noHands: [] = [];
  private pendingTaps: Vec2[] = [];
  private frameTaps: Vec2[] = [];
  private scaleCanvas: HTMLCanvasElement | null = null;
  private readonly input: FrameInput;

  constructor(perf: PerfMonitor) {
    this.perf = perf;
    this.quality = perf.quality;
    this.input = {
      face: this.face.frame,
      hands: this.noHands,
      taps: this.frameTaps,
      now: 0,
      dt: 0,
      viewport: { w: 0, h: 0 },
      hasNewDetection: false,
    };
  }

  get delegate(): string {
    return this.source?.delegate ?? '-';
  }

  async load(onProgress: (stage: LoadStage, ratio: number) => void): Promise<void> {
    if (this.source) return;
    this.source = await createLiveSource(onProgress);
    this.source.setNumHands(this.quality.numHands);
  }

  attach(video: HTMLVideoElement, viewport: { w: number; h: number }): void {
    this.video = video;
    this.input.viewport.w = viewport.w;
    this.input.viewport.h = viewport.h;
    // 창 크기·카메라 해상도가 바뀌면 다시 만든다
    this.mapper = video.videoWidth > 0 ? makeMapper(video.videoWidth, video.videoHeight, viewport.w, viewport.h) : null;
  }

  /** platform이 모은 pointerdown 좌표 (HUD 버튼 위는 제외된 상태로 들어온다) */
  addTap(x: number, y: number): void {
    this.pendingTaps.push({ x, y });
  }

  /** 다시 하기: 얼굴·손 이력을 비운다 */
  reset(): void {
    this.face.reset();
    this.hand.reset();
  }

  setQuality(q: Quality): void {
    this.quality = q;
    this.source?.setNumHands(q.numHands);
  }

  update(now: number): FrameInput {
    const input = this.input;
    const dt = this.prevNow === 0 ? 0 : Math.min(now - this.prevNow, DT_MAX_MS);
    this.prevNow = now;

    // 탭: 이번 프레임 것만 넘기고 버퍼를 맞바꾼다 (할당 없음)
    const taps = this.frameTaps;
    taps.length = 0;
    this.frameTaps = this.pendingTaps;
    this.pendingTaps = taps;
    input.taps = this.frameTaps;

    const video = this.video;
    const source = this.source;
    let detected = false;
    let faceNorm: NormPoint[] | null = null;
    if (video && source && this.mapper && video.readyState >= 2 && video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = video.currentTime;
      detected = true;
      this.frameNo++;
      try {
        const image = this.detectImage(video);
        const t0 = performance.now();
        faceNorm = source.face(image, t0); // 단조 증가 보정은 source가 한다
        const t1 = performance.now();
        this.perf.onFaceDetect(t1 - t0);

        if (this.quality.handsEnabled && this.frameNo % this.quality.handEvery === 0) {
          const handsRaw = source.hands(image, t1);
          this.perf.onHandDetect(performance.now() - t1);
          this.hand.update(handsRaw, this.mapper, now);
        }
      } catch (err) {
        // 인식 한 번 실패로 게임 루프가 멈추지 않게 한다. 이번 프레임은 인식 없음으로 처리
        if (!this.loggedError) console.error('[perception] 인식 실패', err);
        this.loggedError = true;
        detected = false;
        faceNorm = null;
      }
    }

    this.face.update(detected, faceNorm, this.mapper, now, dt, input.viewport.w);
    input.hands = this.quality.handsEnabled ? this.hand.hands : this.noHands;
    input.now = now;
    input.dt = dt;
    input.hasNewDetection = detected;
    return input;
  }

  /** Quality.detectScale < 1 이면 오프스크린 캔버스에 축소해서 넘긴다 (정규화 좌표는 같으므로 mapper 불변) */
  private detectImage(video: HTMLVideoElement): DetectImage {
    const scale = this.quality.detectScale;
    if (scale >= 1) return video;
    const c = (this.scaleCanvas ??= document.createElement('canvas'));
    const w = Math.max(1, Math.round(video.videoWidth * scale));
    const h = Math.max(1, Math.round(video.videoHeight * scale));
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    c.getContext('2d')?.drawImage(video, 0, 0, w, h);
    return c;
  }
}
