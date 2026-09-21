// src/game/config.ts
// 게임플레이 튜닝 수치. 길이·속도는 faceW 배수, 시간은 ms.

/** 물기 앵커 후보 (product-spec 5.4). 이마, 코끝, 턱, 좌우 볼, 좌우 눈썹, 윗입술 */
export const ANCHOR_IDS = [10, 1, 152, 50, 280, 105, 334, 0];

/** 얼굴 중심으로 쓰는 랜드마크 (코끝) */
export const FACE_CENTER_IDX = 1;

// ---- F-06 무는 동작 ----
/** 목표와 이 거리(faceW) 안에 들어오면 착지 */
export const LAND_DIST = 0.1;
/** 착지 후 무는 순간까지 */
export const LANDED_MS = 800;
/** 문 뒤 날아가는 시간 */
export const FLY_OFF_MS = 600;
/** 날아갈 때 속도 (faceW/s) */
export const FLY_OFF_SPEED = 4;
/** 쿨다운 시간 범위 */
export const COOLDOWN_MIN_MS = 2000;
export const COOLDOWN_MAX_MS = 4000;
/** 쿨다운 중 배회할 지점의 얼굴 중심으로부터 거리 범위 (faceW) */
export const COOLDOWN_DIST_MIN = 1.5;
export const COOLDOWN_DIST_MAX = 2.5;
/** 쿨다운 배회 속도 배율 (APPROACH 기본 속도 대비) */
export const COOLDOWN_SPEED_RATIO = 0.6;
/** 분열 직후 무적 시간 (F-10) */
export const SPAWNING_MS = 600;
