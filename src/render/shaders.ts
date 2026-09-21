// src/render/shaders.ts
// F-07 부기 셰이더 (product-spec 부록 B). 색 계수와 배열 크기는 config.ts에서 주입한다.

import { MAX_BITES_UNIFORM, RED_MAX, SWELL_ADD, SWELL_MUL } from './config';

const f = (n: number): string => n.toFixed(4);
const vec3 = (v: readonly [number, number, number]): string => `vec3(${v.map(f).join(', ')})`;

/** 풀스크린 삼각형. vUv (0,0) = 화면 좌상단 */
export const VERT_SRC = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID == 1) ? 3.0 : -1.0, (gl_VertexID == 2) ? 3.0 : -1.0);
  vUv = vec2((p.x + 1.0) * 0.5, 1.0 - (p.y + 1.0) * 0.5);
  gl_Position = vec4(p, 0.0, 1.0);
}
`;

/** 볼록 왜곡 + 붉은 기 + cover 크롭 역변환 + 거울 */
export const FRAG_SRC = `#version 300 es
precision highp float;
#define MAX_BITES ${MAX_BITES_UNIFORM}
uniform sampler2D uVideo;
uniform vec4 uBites[MAX_BITES]; // xy: 화면 uv 중심, z: 반경(px/H), w: 세기
uniform int uCount;
uniform float uAspect;          // W / H
uniform vec2 uCrop;             // (W / (vw*s), H / (vh*s))
in vec2 vUv;
out vec4 o;
void main() {
  vec2 uv = vUv;
  float red = 0.0;
  for (int i = 0; i < MAX_BITES; i++) {
    if (i >= uCount) break;
    vec2 d = uv - uBites[i].xy;
    d.x *= uAspect;
    float r = length(d) / uBites[i].z;
    if (r < 1.0) {
      float k = uBites[i].w * pow(1.0 - r * r, 2.0);
      d *= (1.0 - k);
      d.x /= uAspect;
      uv = uBites[i].xy + d;
      red += k;
    }
  }
  vec2 vuv = 0.5 + (uv - 0.5) * uCrop;
  vec3 c = texture(uVideo, vec2(1.0 - vuv.x, vuv.y)).rgb;
  vec3 swollen = c * ${vec3(SWELL_MUL)} + ${vec3(SWELL_ADD)};
  o = vec4(mix(c, swollen, clamp(red, 0.0, ${f(RED_MAX)})), 1.0);
}
`;
