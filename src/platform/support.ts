// src/platform/support.ts
// F-14: 시작 전에 지원 여부를 검사한다. 첫 실패 문구를 돌려준다 (지금은 데스크톱 브라우저 기준).

export function checkSupport(): string | null {
  if (!window.isSecureContext) return 'HTTPS로 열어야 카메라를 쓸 수 있어요.';
  if (!navigator.mediaDevices?.getUserMedia) return '이 브라우저는 카메라를 지원하지 않아요. Safari나 Chrome으로 열어주세요.';
  if (!document.createElement('canvas').getContext('webgl2')) return '이 기기는 WebGL2를 지원하지 않아요. 브라우저를 업데이트해 주세요.';
  if (typeof WebAssembly !== 'object') return '이 브라우저는 WebAssembly를 지원하지 않아요.';
  return null;
}
