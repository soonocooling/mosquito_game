// src/perception/landmarkers.ts
// 랜드마크 공급원: MediaPipe Face/Hand Landmarker (F-02, F-03).
// "정규화 좌표 원본"을 돌려주고, mapper·One Euro·HandFrame 계산은 face.ts·hand.ts가 한다.
// 나중에 리플레이(F-16)를 붙일 때 같은 인터페이스로 공급원을 하나 더 만들면 된다.

import { FaceLandmarker, FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { FACE_MODEL_PATH, HAND_MODEL_PATH, WASM_PATH } from './config';

export interface NormPoint { x: number; y: number }
export interface RawHand { landmarks: NormPoint[]; side: 'Left' | 'Right'; score: number }
export type DetectImage = HTMLVideoElement | HTMLCanvasElement;
export type LoadStage = 'wasm' | 'face' | 'hand' | 'warmup';

export interface LandmarkSource {
  /** 디버그 표시용: GPU | CPU */
  readonly delegate: string;
  face(image: DetectImage, ts: number): NormPoint[] | null;
  hands(image: DetectImage, ts: number): RawHand[];
  setNumHands(n: 1 | 2): void;
}

// ---------------- 실시간 (MediaPipe) ----------------

type Fileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

async function withCpuFallback<T>(create: (delegate: 'GPU' | 'CPU') => Promise<T>): Promise<{ task: T; delegate: 'GPU' | 'CPU' }> {
  try {
    return { task: await create('GPU'), delegate: 'GPU' };
  } catch (err) {
    console.warn('[perception] GPU 델리게이트 실패, CPU로 재시도', err);
    return { task: await create('CPU'), delegate: 'CPU' };
  }
}

export async function createLiveSource(onProgress: (stage: LoadStage, ratio: number) => void): Promise<LandmarkSource> {
  onProgress('wasm', 0);
  const fileset: Fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
  onProgress('wasm', 1);

  onProgress('face', 0);
  const face = await withCpuFallback((delegate) =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: FACE_MODEL_PATH, delegate },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    }),
  );
  onProgress('face', 1);

  onProgress('hand', 0);
  const hand = await withCpuFallback((delegate) =>
    HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: HAND_MODEL_PATH, delegate },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    }),
  );
  onProgress('hand', 1);

  // 첫 추론이 수백 ms 걸려 게임 시작 직후 멈추는 것을 막는다 (F-02 warm-up)
  onProgress('warmup', 0);
  const blank = document.createElement('canvas');
  blank.width = 64;
  blank.height = 64;
  blank.getContext('2d')?.fillRect(0, 0, 64, 64);
  const warmTs = performance.now();
  face.task.detectForVideo(blank, warmTs);
  hand.task.detectForVideo(blank, warmTs);
  onProgress('warmup', 1);

  // detectForVideo 타임스탬프는 작업(얼굴·손)마다 직전보다 커야 한다.
  // rAF 시각이 warm-up 시각보다 앞설 수 있어서 여기서 단조 증가를 보장한다
  let lastFaceTs = warmTs;
  let lastHandTs = warmTs;
  let numHands: 1 | 2 = 2;
  return {
    delegate: face.delegate === hand.delegate ? face.delegate : `face ${face.delegate} / hand ${hand.delegate}`,
    face(image, ts) {
      lastFaceTs = Math.max(ts, lastFaceTs + 1);
      return face.task.detectForVideo(image, lastFaceTs).faceLandmarks?.[0] ?? null;
    },
    hands(image, ts) {
      lastHandTs = Math.max(ts, lastHandTs + 1);
      const r = hand.task.detectForVideo(image, lastHandTs);
      const out: RawHand[] = [];
      for (let i = 0; i < r.landmarks.length; i++) {
        const cat = r.handedness[i]?.[0];
        // MediaPipe는 원본(거울 전) 영상 기준으로 좌우를 붙이므로 화면에서 보이는 손과 맞게 뒤집는다
        out.push({ landmarks: r.landmarks[i], side: cat?.categoryName === 'Left' ? 'Right' : 'Left', score: cat?.score ?? 0 });
      }
      return out;
    },
    setNumHands(n) {
      if (n === numHands) return;
      numHands = n;
      void hand.task.setOptions({ numHands: n });
    },
  };
}
