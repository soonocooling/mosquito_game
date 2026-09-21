// src/platform/errors.ts
// F-14: 전역 오류를 토스트로 보여주고 복사할 수 있게 한다 (서버가 없어서 친구가 복사해 보내는 게 유일한 신고 경로).
// 화면 구석에 버전 문자열을 상시 표시한다.

import type { Screens } from './screens';

const ERROR_TOAST_MS = 5000;

export function installErrorReporting(screens: Screens, root: HTMLElement): void {
  const version = document.createElement('div');
  version.className = 'version';
  version.textContent = __APP_VERSION__;
  root.append(version);

  const report = (message: string) => {
    const text = `[${__APP_VERSION__}] ${message}\n${navigator.userAgent}`;
    screens.toast(`오류: ${message}`, ERROR_TOAST_MS, {
      label: '복사',
      onClick: () => void navigator.clipboard?.writeText(text),
    });
  };
  window.addEventListener('error', (e) => report(e.message || String(e.error)));
  window.addEventListener('unhandledrejection', (e) => report(String((e.reason as Error)?.message ?? e.reason)));
}
