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

// ---- F-08 잡기 ----
/** 모기 히트박스 반경 (faceW). 그리기 크기 getSize와 같은 값 */
export const MOSQ_HIT_R = 0.06;
/** 손 이력 보관 시간 */
export const HAND_HISTORY_MS = 300;
/** 스윙: 손 속도가 이 값(faceW/s)을 넘어야 한다 */
export const SWING_SPEED = 1.5;
/** 박수: 이 시간 안에 두 손바닥 거리가 CLAP_SHRINK 비율 이하로 줄고 CLAP_CLOSE(faceW) 안으로 들어오면 */
export const CLAP_WINDOW_MS = 150;
export const CLAP_SHRINK = 0.5;
export const CLAP_CLOSE = 0.6;
/** 박수: 두 손바닥을 잇는 선분과 모기 거리 (faceW) */
export const CLAP_HIT = 0.3;
/** 움켜쥐기: 이 시간 안에 grip이 GRIP_OPEN 이상 → GRIP_CLOSED 미만 */
export const GRAB_WINDOW_MS = 200;
export const GRIP_OPEN = 1.8;
export const GRIP_CLOSED = 1.1;
/** 박수·움켜쥐기 발동 후 재발동 금지 시간 */
export const SWAT_COOLDOWN_MS = 200;
/** 클릭(탭) 반경 (faceW) */
export const TAP_R = 0.12;

// ---- F-09 피 튀김 ----
export const BLOOD_COUNT_MIN = 12;
export const BLOOD_COUNT_MAX = 20;
/** 파티클 초속 범위 (faceW/s) */
export const BLOOD_SPEED_MIN = 1;
export const BLOOD_SPEED_MAX = 3;
/** 중력 (faceW/s², 화면 아래 방향) */
export const BLOOD_GRAVITY = 3;
export const BLOOD_LIFE_MS = 400;
/** 파티클 크기 (faceW) */
export const BLOOD_DROP_R = 0.022;
/** 동시 파티클 상한. 넘으면 오래된 것부터 덮어쓴다 */
export const BLOOD_MAX = 500;
/** 바닥 자국: 크기(faceW), 페이드아웃 시간 */
export const SPLAT_R = 0.09;
export const SPLAT_LIFE_MS = 1500;
export const SPLAT_MAX = 64;
export const BLOOD_COLOR = "#b3001b";
/** "찰싹" 효과음: 화이트노이즈 길이·음량 */
export const SLAP_MS = 60;
export const SLAP_GAIN = 0.5;

// ---- F-10 분열 ----
/** 분열 직후 두 모기가 튕겨 나가는 속도 (faceW/s) */
export const SPLIT_SPEED_FACEW = 2;
