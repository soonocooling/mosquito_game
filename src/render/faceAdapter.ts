// src/render/faceAdapter.ts
// 임시 변환기: A의 FaceTracker 결과(FaceTrackResult, 비디오 px) → 스펙 5.2 FaceFrame(화면 CSS px).
// perception이 FaceFrame을 직접 내보내게 되면 이 파일을 지운다.
//
// 좌표 변환은 product-spec 5.1 mapper와 같은 식(cover: s = max(W/vw, H/vh), 중앙 정렬)이다.
// A의 Camera.mapPoint와도 같은 결과지만, 478점마다 새 객체를 만들지 않으려고 여기서 직접 계산한다.

import type { FaceTrackResult } from '../game/faceTracking';
import type { FaceFrame, Vec2 } from '../shared/types';

const LANDMARK_COUNT = 478;
const EYE_OUTER_R = 33; // 회전 기준 (5.4)
const EYE_OUTER_L = 263;
const FACE_W_BEFORE_FIRST = 0.35; // 첫 검출 전 faceW = viewport.w × 0.35 (5.2)

export class FaceFrameAdapter {
  readonly frame: FaceFrame = {
    visible: false,
    landmarks: [],
    faceW: 0,
    rotation: 0,
    velocity: { x: 0, y: 0 },
    t: 0,
  };
  private readonly pool: Vec2[] = Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0, y: 0 }));

  update(r: FaceTrackResult, vw: number, vh: number, W: number, H: number, now: number): FaceFrame {
    const f = this.frame;
    const src = r.landmarks;
    const first = src[0];
    if (!first || vw <= 0 || vh <= 0) {
      f.landmarks = [];
      f.faceW = W * FACE_W_BEFORE_FIRST;
      f.visible = false;
      return f;
    }

    const s = Math.max(W / vw, H / vh);
    const ox = (W - vw * s) / 2;
    const oy = (H - vh * s) / 2;
    for (let i = 0; i < LANDMARK_COUNT; i++) {
      const p = src[i];
      if (!p) continue;
      const out = this.pool[i];
      out.x = p.x * s + ox;
      out.y = p.y * s + oy;
    }
    f.landmarks = this.pool;
    f.faceW = r.faceW * s;
    const a = this.pool[EYE_OUTER_R];
    const b = this.pool[EYE_OUTER_L];
    f.rotation = Math.atan2(b.y - a.y, b.x - a.x);
    f.visible = r.visible;
    if (r.visible) f.t = now;
    return f;
  }
}
