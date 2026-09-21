// F-03 손 추적 [추론]
// MediaPipe Hand Landmarker(손당 21점), 최대 2손. 모기 잡기(F-08) 판정에 사용.
import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";
import type { Vec2 } from "./types";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const VELOCITY_WINDOW_MS = 100; // 손 속도 = 최근 100ms 이동평균 [명시]
const PALM_LANDMARK_IDX = [0, 5, 9, 13, 17];
const FINGERTIP_IDX = [4, 8, 12, 16, 20];

interface HandSample {
  pos: Vec2;
  tMs: number;
}

export interface HandTrackResult {
  handedness: "Left" | "Right";
  palmCenter: Vec2; // 비디오-픽셀 좌표계, 좌우 반전 보정 완료
  palmR: number; // |p0 - p9| * 0.8
  velocity: Vec2; // 비디오-픽셀 / s
  grip: number; // 손끝~손목 평균 거리 / |p0 - p9| — 값이 작을수록 움켜쥔 상태
}

export class HandTracker {
  private landmarker: HandLandmarker | null = null;
  private history = new Map<string, HandSample[]>();

  async init() {
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);
    const options = {
      baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "GPU" as const },
      runningMode: "VIDEO" as const,
      numHands: 2,
    };
    try {
      this.landmarker = await HandLandmarker.createFromOptions(vision, options);
    } catch {
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        ...options,
        baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "CPU" as const },
      });
    }
  }

  detect(video: HTMLVideoElement, timestampMs: number): HandTrackResult[] {
    if (!this.landmarker) return [];

    const vw = video.videoWidth || 1;
    const vh = video.videoHeight || 1;
    const result: HandLandmarkerResult = this.landmarker.detectForVideo(video, timestampMs);
    const out: HandTrackResult[] = [];
    const seenKeys = new Set<string>();

    for (let i = 0; i < result.landmarks.length; i++) {
      const lm = result.landmarks[i];
      // 화면은 거울 모드이므로 MediaPipe가 원본 영상 기준으로 분류한 좌/우를 뒤집어
      // 사용자가 화면에서 보는 손과 일치시킨다.
      const rawLabel = result.handedness[i]?.[0]?.categoryName;
      const handedness: "Left" | "Right" = rawLabel === "Left" ? "Right" : "Left";

      const px: Vec2[] = lm.map((p: { x: number; y: number }) => ({ x: (1 - p.x) * vw, y: p.y * vh }));

      const palmCenter: Vec2 = {
        x: PALM_LANDMARK_IDX.reduce((sum, idx) => sum + px[idx].x, 0) / PALM_LANDMARK_IDX.length,
        y: PALM_LANDMARK_IDX.reduce((sum, idx) => sum + px[idx].y, 0) / PALM_LANDMARK_IDX.length,
      };

      const p0p9 = Math.hypot(px[9].x - px[0].x, px[9].y - px[0].y) || 1;
      const palmR = p0p9 * 0.8;

      const gripSum = FINGERTIP_IDX.reduce(
        (sum, idx) => sum + Math.hypot(px[idx].x - px[0].x, px[idx].y - px[0].y),
        0,
      );
      const grip = gripSum / FINGERTIP_IDX.length / p0p9;

      let samples = this.history.get(handedness);
      if (!samples) {
        samples = [];
        this.history.set(handedness, samples);
      }
      samples.push({ pos: palmCenter, tMs: timestampMs });
      while (samples.length > 0 && timestampMs - samples[0].tMs > VELOCITY_WINDOW_MS) {
        samples.shift();
      }

      let velocity: Vec2 = { x: 0, y: 0 };
      if (samples.length >= 2) {
        const first = samples[0];
        const last = samples[samples.length - 1];
        const dt = (last.tMs - first.tMs) / 1000;
        if (dt > 0) {
          velocity = {
            x: (last.pos.x - first.pos.x) / dt,
            y: (last.pos.y - first.pos.y) / dt,
          };
        }
      }

      seenKeys.add(handedness);
      out.push({ handedness, palmCenter, palmR, velocity, grip });
    }

    // 화면에서 사라진 손의 이력은 정리 (재등장 시 속도 계산이 이전 위치로 튀지 않도록)
    for (const key of Array.from(this.history.keys())) {
      if (!seenKeys.has(key)) this.history.delete(key);
    }

    return out;
  }

  close() {
    this.landmarker?.close();
    this.landmarker = null;
    this.history.clear();
  }
}
