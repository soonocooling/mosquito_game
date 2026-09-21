// src/game/noise.ts
// F-04 "비행감: Perlin noise로 좌우 흔들림"을 위한 아주 가벼운 자체 노이즈 함수.
// 외부 라이브러리(npm install) 없이 동작합니다.

function hash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453123;
  return s - Math.floor(s);
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * x 값에 대해 -1~1 사이를 부드럽게 오가는 값을 반환합니다.
 * (performance.now() / 300 같은 값을 x로 넣으면 시간에 따라 자연스럽게 흔들립니다)
 */
export function noise1D(x: number, seed = 0): number {
  const xi = Math.floor(x);
  const xf = x - xi;
  const a = hash(xi + seed * 1000);
  const b = hash(xi + 1 + seed * 1000);
  const t = smoothstep(xf);
  return (a + (b - a) * t) * 2 - 1;
}
