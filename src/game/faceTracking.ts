// F-02 얼굴 추적 [추론]
// MediaPipe Face Landmarker(478점)로 1인 추적. 근거는 product-spec.md의 "구현 방향" 참조.
import {
  FilesetResolver,
  FaceLandmarker,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { OneEuroFilter2D } from "./oneEuroFilter";
import type { Vec2 } from "./types";

const WASM_URL = "/wasm"; // postinstall이 node_modules에서 복사 (product-spec 9.1)
const FACE_MODEL_URL = "/models/face_landmarker.task";

// 좌/우 광대 랜드마크 (MediaPipe Face Mesh 기준)
const RIGHT_CHEEK_IDX = 234;
const LEFT_CHEEK_IDX = 454;

// 얼굴 소실 시 마지막 자세를 유지하는 시간 [명시]
const FACE_LOST_HOLD_MS = 500;

export interface FaceTrackResult {
  // 비디오-픽셀 좌표계, x' = 1 - x 좌우 반전 보정 완료, One Euro Filter로 평활화됨
  landmarks: Record<number, Vec2>;
  faceW: number; // 비디오-픽셀 단위의 얼굴 폭 기준값
  visible: boolean; // 지금 화면에 보이는지 (소실 유예 시간 포함)
  justLost: boolean; // 유예 시간(500ms)까지 지나 완전히 놓친 첫 프레임인지
}

export class FaceTracker {
  private landmarker: FaceLandmarker | null = null;
  private filters = new Map<number, OneEuroFilter2D>();
  private lastLandmarks: Record<number, Vec2> | null = null;
  private lastFaceW = 0;
  private lastSeenAtMs = 0;
  private everSeen = false;

  async init() {
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);
    const options = {
      baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: "GPU" as const },
      runningMode: "VIDEO" as const,
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    };
    try {
      this.landmarker = await FaceLandmarker.createFromOptions(vision, options);
    } catch {
      // 일부 기기는 GPU 델리게이트를 지원하지 않음 → CPU로 재시도
      this.landmarker = await FaceLandmarker.createFromOptions(vision, {
        ...options,
        baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: "CPU" as const },
      });
    }
  }

  detect(video: HTMLVideoElement, timestampMs: number): FaceTrackResult {
    if (!this.landmarker) {
      return { landmarks: this.lastLandmarks ?? {}, faceW: this.lastFaceW, visible: false, justLost: false };
    }

    const vw = video.videoWidth || 1;
    const vh = video.videoHeight || 1;
    const result: FaceLandmarkerResult = this.landmarker.detectForVideo(video, timestampMs);
    const raw = result.faceLandmarks?.[0];

    if (raw && raw.length > 0) {
      const smoothed: Record<number, Vec2> = {};
      for (let i = 0; i < raw.length; i++) {
        const px = (1 - raw[i].x) * vw; // 좌우 반전 x' = 1 - x [명시]
        const py = raw[i].y * vh;
        let filter = this.filters.get(i);
        if (!filter) {
          filter = new OneEuroFilter2D(1.0, 0.3, 1.0);
          this.filters.set(i, filter);
        }
        smoothed[i] = filter.filter({ x: px, y: py }, timestampMs);
      }

      const l = smoothed[LEFT_CHEEK_IDX];
      const r = smoothed[RIGHT_CHEEK_IDX];
      const faceW = l && r ? Math.hypot(l.x - r.x, l.y - r.y) : this.lastFaceW;

      this.lastLandmarks = smoothed;
      this.lastFaceW = faceW || this.lastFaceW;
      this.lastSeenAtMs = timestampMs;
      this.everSeen = true;

      return { landmarks: smoothed, faceW: this.lastFaceW, visible: true, justLost: false };
    }

    // 손으로 가림·화면 밖: 500ms 동안 마지막 자세 유지 [완료 조건]
    if (this.everSeen && timestampMs - this.lastSeenAtMs < FACE_LOST_HOLD_MS) {
      return { landmarks: this.lastLandmarks ?? {}, faceW: this.lastFaceW, visible: true, justLost: false };
    }

    const justLost = this.everSeen && timestampMs - this.lastSeenAtMs < FACE_LOST_HOLD_MS + 34;
    return { landmarks: this.lastLandmarks ?? {}, faceW: this.lastFaceW, visible: false, justLost };
  }

  close() {
    this.landmarker?.close();
    this.landmarker = null;
    this.filters.clear();
  }
}
