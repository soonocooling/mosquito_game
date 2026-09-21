// src/render/config.ts
// F-07 부기 튜닝 수치. 길이는 전부 faceW 배수, 시간은 ms.
// 팀장 결정으로 스펙 시작값(세기 0.25→0.6, 반경 0.12→0.5)보다 진하게 조정했다.

/** 신규 부기 반경 (faceW) */
export const BITE_RADIUS_INIT = 0.16;
/** 부기 반경 상한 (faceW) */
export const BITE_RADIUS_MAX = 0.6;
/** 병합 시 반경 배율 */
export const BITE_RADIUS_GROW = 1.1;

/** 신규 부기 목표 세기 */
export const BITE_STRENGTH_INIT = 0.45;
/** 병합 시 목표 세기 증가량 */
export const BITE_STRENGTH_STEP = 0.2;
/** 목표 세기 상한 */
export const BITE_STRENGTH_MAX = 0.8;

/** 새 물림이 기존 부기 중심에서 (이 값 × 반경) 이내면 병합 */
export const MERGE_DIST_RATIO = 0.5;

/** 셰이더 uniform 배열 크기. Quality.maxBites는 이 값 이하 */
export const MAX_BITES_UNIFORM = 32;
/** Quality를 받기 전 기본 상한 */
export const DEFAULT_MAX_BITES = 32;

/** 등장·병합 애니메이션 길이 */
export const APPEAR_MS = 600;
/** 애니메이션 최고점 배율 (목표의 130%까지 부풀었다가 돌아옴) */
export const OVERSHOOT_PEAK = 1.3;

/** 부은 피부 색: c * SWELL_MUL + SWELL_ADD */
export const SWELL_MUL: readonly [number, number, number] = [1.0, 0.4, 0.4];
export const SWELL_ADD: readonly [number, number, number] = [0.25, 0.02, 0.02];
/** 붉은 기 누적 상한 */
export const RED_MAX = 0.95;
