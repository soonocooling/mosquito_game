import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { execSync } from 'node:child_process';

// 화면 구석 버전 문자열(F-14). Vercel은 환경변수로, 로컬은 git에서 읽는다
const sha =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  (() => {
    try {
      return execSync('git rev-parse HEAD').toString().trim();
    } catch {
      return 'dev';
    }
  })();

export default defineConfig(({ mode }) => {
  // `npm run dev:phone` → https://<LAN IP>:5173 — 같은 Wi-Fi의 폰에서 카메라가 열린다 (자체 서명 인증서 경고는 "계속"으로 통과)
  const phone = mode === 'phone';
  return {
    plugins: phone ? [basicSsl()] : [],
    server: { host: phone },
    build: { target: 'es2020', sourcemap: true }, // iOS 15 Safari까지, 소스맵은 원격 디버깅용
    define: { __APP_VERSION__: JSON.stringify(sha.slice(0, 7)) },
    test: { environment: 'node', include: ['src/**/*.test.ts'] },
  };
});
