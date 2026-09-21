// postinstall: MediaPipe WASM을 public/wasm으로 복사한다 (product-spec 9.1).
// CDN 대신 같은 도메인에서 받아 학교·회사 Wi-Fi 차단과 버전 불일치를 피한다.
import { cpSync, existsSync } from 'node:fs';

const src = 'node_modules/@mediapipe/tasks-vision/wasm';
const dest = 'public/wasm';
if (existsSync(src)) {
  cpSync(src, dest, { recursive: true });
  console.log(`[copy-wasm] ${src} → ${dest}`);
} else {
  console.warn(`[copy-wasm] ${src} 없음 — npm install을 먼저 실행하세요`);
}
