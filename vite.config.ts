import { defineConfig } from 'vite';
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

export default defineConfig({
  build: { target: 'es2020', sourcemap: true }, // 소스맵은 배포 후 오류 추적용
  define: { __APP_VERSION__: JSON.stringify(sha.slice(0, 7)) },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
