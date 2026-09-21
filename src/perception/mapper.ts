// src/perception/mapper.ts
// 비디오 정규화 좌표(0~1) → 거울 반전 → cover 크롭 → 화면 CSS px (product-spec 5.1).
// 이 변환은 여기 한 곳에서만 한다. 셰이더(render)는 같은 식을 역으로 쓴다.

import type { Vec2 } from '../shared/types';

export interface Mapper {
  s: number; ox: number; oy: number; vw: number; vh: number;
  toScreen(nx: number, ny: number, out: Vec2): Vec2;
}

export function makeMapper(vw: number, vh: number, W: number, H: number): Mapper {
  const s = Math.max(W / vw, H / vh); // cover: 짧은 쪽을 화면에 맞추고 긴 쪽을 잘라냄
  const ox = (W - vw * s) / 2;
  const oy = (H - vh * s) / 2;
  return {
    s, ox, oy, vw, vh,
    toScreen(nx, ny, out) {
      out.x = (1 - nx) * vw * s + ox; // 1-nx = 거울
      out.y = ny * vh * s + oy;
      return out;
    },
  };
}
