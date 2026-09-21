// src/main.ts
// 메인 루프 (product-spec 5.3). 지금은 데스크톱 브라우저 + 웹캠만 지원한다.
// S-1 랜딩 → (시작) 카메라 → S-3 로딩 → S-4 게임 → (그만하기) S-5 결과 → (다시 하기) S-4

import './platform/style.css';
import { GameImpl } from './game/index';
import { QUALITY_DESKTOP } from './perception/config';
import { PerceptionImpl } from './perception/index';
import { PerfMonitor } from './perception/perf';
import { Camera } from './platform/camera';
import { OVERLAY_DPR_MAX, SHAKE_MS, SHAKE_PX } from './platform/config';
import { DebugPanel } from './platform/debug';
import { installErrorReporting } from './platform/errors';
import { Screens } from './platform/screens';
import { checkSupport } from './platform/support';
import { createRenderer } from './render/gl';
import type { Quality } from './shared/types';
import { ResultScreen } from './ui/result';

const video = document.querySelector<HTMLVideoElement>('#cam')!;
const stage = document.querySelector<HTMLDivElement>('#stage')!;
const glCanvas = document.querySelector<HTMLCanvasElement>('#gl')!;
const overlay = document.querySelector<HTMLCanvasElement>('#overlay')!;
const hudRoot = document.querySelector<HTMLDivElement>('#hud')!;
const uiRoot = document.querySelector<HTMLDivElement>('#ui')!;

const screens = new Screens(uiRoot);
installErrorReporting(screens, uiRoot);

const unsupported = checkSupport();
if (unsupported) {
  screens.showLanding(() => {}, unsupported);
} else {
  boot();
}

function boot(): void {
  const overlayCtx = overlay.getContext('2d')!;
  const perf = new PerfMonitor(QUALITY_DESKTOP);
  const perception = new PerceptionImpl(perf);
  const renderer = createRenderer(glCanvas, video);
  const camera = new Camera(video);
  const result = new ResultScreen(uiRoot);
  const game = new GameImpl(hudRoot, () => {
    captureRequested = true;
  });
  const debug = new DebugPanel(uiRoot, new URLSearchParams(location.search).get('debug') === '1', (delta) =>
    applyQuality(perf.setLevel(perf.quality.level + delta)),
  );

  const viewport = { w: innerWidth, h: innerHeight };
  let running = false;
  let paused = false;
  let captureRequested = false;
  let shakeUntil = 0;

  function applyQuality(q: Quality): void {
    perception.setQuality(q);
    renderer.setQuality(q);
    game.setQuality(q);
  }

  function resize(): void {
    viewport.w = innerWidth;
    viewport.h = innerHeight;
    const dpr = devicePixelRatio || 1;
    const odpr = Math.min(dpr, OVERLAY_DPR_MAX);
    overlay.width = Math.round(viewport.w * odpr);
    overlay.height = Math.round(viewport.h * odpr);
    overlayCtx.setTransform(odpr, 0, 0, odpr, 0, 0);
    renderer.resize(viewport, { w: video.videoWidth, h: video.videoHeight }, dpr);
    perception.attach(video, viewport);
  }
  addEventListener('resize', resize);
  video.addEventListener('resize', resize); // 카메라 해상도가 바뀌는 경우

  // 탭·클릭 (F-08 탭 잡기용). HUD 버튼은 #stage 밖이라 자연히 제외된다
  stage.addEventListener('pointerdown', (e) => perception.addTap(e.clientX, e.clientY));

  function beginPlay(): void {
    hudRoot.hidden = false;
    debug.setActive(true);
    game.reset();
    perf.start(performance.now());
    running = true;
    requestAnimationFrame(loop);
  }

  /** 시작 버튼 · 다시 시도 버튼. 한 번의 클릭 안에서 오디오 → 카메라 순서로 연다 */
  async function start(): Promise<void> {
    game.onUserGesture();
    camera.stop();
    const err = await camera.start();
    if (err) {
      screens.showError(err, () => void start(), err === 'other' ? camera.lastErrorMessage : '');
      return;
    }

    screens.showLoading();
    try {
      await perception.load((stage, ratio) => screens.setProgress(stage, ratio));
    } catch (e) {
      console.error('[main] 인식 모델 로딩 실패', e);
      screens.showError('model', () => void start(), String((e as Error)?.message ?? e));
      return;
    }
    if (video.videoWidth === 0) {
      await new Promise((r) => video.addEventListener('loadedmetadata', r, { once: true }));
    }
    resize();
    applyQuality(perf.quality);
    screens.hideScreens();
    beginPlay();
  }

  function showResult(image: HTMLCanvasElement): void {
    running = false;
    hudRoot.hidden = true;
    debug.setActive(false);
    result.show(
      image,
      { bites: game.stats.bites, kills: game.stats.kills, mosquitoCount: game.stats.mosquitoCount, elapsedSec: game.elapsedSec },
      () => {
        // 다시 하기: 카메라·모델은 유지하고 부기·모기·기록만 초기화 (F-12)
        game.onUserGesture();
        renderer.reset();
        perception.reset();
        beginPlay();
      },
    );
  }

  function loop(now: number): void {
    if (!running) return;
    if (paused) {
      requestAnimationFrame(loop);
      return;
    }
    const input = perception.update(now); // 새 카메라 프레임이면 인식, 아니면 직전 결과 외삽
    const out = game.update(input); // 모기 → 물림 이벤트, HUD
    renderer.draw(input.face, out.biteEvents); // 비디오 + 부기
    overlayCtx.clearRect(0, 0, viewport.w, viewport.h);
    game.drawOverlay(overlayCtx);
    debug.draw(overlayCtx, input, renderer.bites, perf, perf.quality, perception.delegate, game.manager.mosquitoes);

    if (out.shake) shakeUntil = now + SHAKE_MS;
    stage.style.transform = now < shakeUntil ? `translate(${Math.random() < 0.5 ? -SHAKE_PX : SHAKE_PX}px, 0)` : '';

    if (captureRequested) {
      // preserveDrawingBuffer 없이 같은 프레임 안에서 읽는다 (F-12)
      captureRequested = false;
      showResult(renderer.capture(overlay));
      return;
    }

    const q = perf.tick(now); // F-15
    if (q) {
      applyQuality(q);
      if (!q.handsEnabled) screens.toast('손 인식을 껐어. 탭으로 잡아!');
    }
    requestAnimationFrame(loop);
  }

  // 탭 전환 시 일시정지, 복귀 시 카메라 확인 후 재개
  document.addEventListener('visibilitychange', () => {
    if (!running) return;
    if (document.hidden) {
      paused = true;
      game.pause(true);
      return;
    }
    void camera.resume().then(() => {
      paused = false;
      game.pause(false);
      perf.start(performance.now());
    });
  });

  screens.showLanding(() => void start());
}
