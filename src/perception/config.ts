// src/perception/config.ts
// 인식·성능 튜닝 수치 (product-spec 5.5). 시간은 ms.

import type { Quality } from '../shared/types';

// ---- 모델 경로 (spec 9.1: public/ 에서 같은 도메인으로 제공) ----
export const WASM_PATH = '/wasm';
export const FACE_MODEL_PATH = '/models/face_landmarker.task';
export const HAND_MODEL_PATH = '/models/hand_landmarker.task';

// ---- F-02 얼굴 ----
export const LANDMARK_COUNT = 478;
export const ONE_EURO_MIN_CUTOFF = 1.0;
export const ONE_EURO_BETA = 0.01;
export const ONE_EURO_D_CUTOFF = 1.0;
/** 이 시간 이상 미검출이면 visible=false */
export const FACE_LOST_MS = 500;
/** 인식이 없는 프레임에 velocity로 외삽하는 최대 시간 */
export const EXTRAPOLATE_MS = 100;
/** 얼굴·손 속도 이동평균 창 */
export const VELOCITY_WINDOW_MS = 100;
/** 첫 검출 전 faceW = viewport.w × 이 값 */
export const FACE_W_BEFORE_FIRST = 0.35;
/** 5.4 인덱스 */
export const IDX_FACE_EDGE_R = 234;
export const IDX_FACE_EDGE_L = 454;
export const IDX_EYE_OUTER_R = 33;
export const IDX_EYE_OUTER_L = 263;
export const IDX_NOSE = 1;

// ---- F-03 손 ----
export const HAND_MIN_CONFIDENCE = 0.5;
/** 같은 side가 이 시간 이상 안 보이다 재검출되면 속도 이력 초기화 */
export const HAND_RESET_GAP_MS = 200;
export const PALM_IDX = [0, 5, 9, 13, 17];
export const FINGERTIP_IDX = [4, 8, 12, 16, 20];
export const PALM_R_RATIO = 0.8;

// ---- 5.3 루프 ----
export const DT_MAX_MS = 50;

// ---- F-15 기본 Quality (지금은 데스크톱 웹캠만 지원) ----
export const QUALITY_DESKTOP: Quality = {
  level: 0, handEvery: 1, numHands: 2, detectScale: 1, glScale: 1, maxBites: 32, handsEnabled: true,
};

// ---- F-15 자동 조절 ----
export const PERF_FPS_WINDOW = 60; // 프레임
export const PERF_DOWN_FPS = 20;
export const PERF_DOWN_DETECTS = 15; // 초당 얼굴 인식 횟수
export const PERF_DOWN_HOLD_MS = 5000;
export const PERF_UP_FPS = 28;
export const PERF_UP_HOLD_MS = 10000;
/** 시작 직후(모델 warm-up·첫 프레임 지연)는 판정하지 않는다 */
export const PERF_GRACE_MS = 3000;
