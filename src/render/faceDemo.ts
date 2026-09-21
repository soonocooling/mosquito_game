// src/render/faceDemo.ts
// F-07 실얼굴 데모: A의 Camera + FaceTracker(F-01, F-02)에 부기 렌더러를 연결한다.
// C의 물기(F-06)가 아직 없으므로 탭 또는 "자동 물기"로 BiteEvent를 만든다.
// 접속: npm run dev → http://localhost:5173/src/render/face-demo.html
//
// 확인할 것 (F-07 완료 조건)
// - 탭한 자리가 1초 안에 붉고 볼록해진다
// - 물린 뒤 고개를 45° 돌리거나 움직여도 부기가 같은 피부 자리에 붙어 있다
// - 초록 원(renderer.bites로 계산한 중심)과 셰이더 볼록 중심이 겹친다
// - 손으로 얼굴을 가렸다 떼도 부기가 사라지지 않는다

import { Camera } from '../game/camera';
import { FaceTracker, type FaceTrackResult } from '../game/faceTracking';
import { rotate } from './bites';
import { FaceFrameAdapter } from './faceAdapter';
import { createRenderer } from './gl';
import type { BiteEvent, Vec2 } from '../shared/types';

// 물기 앵커 후보 (5.4). 탭 위치에서 가장 가까운 것에 붙인다
const ANCHORS = [10, 1, 152, 50, 280, 105, 334, 0];
const AUTO_BITE_MS = 1500;
const AUTO_JITTER = 0.05; // faceW

const video = document.querySelector<HTMLVideoElement>('#video')!;
const glCanvas = document.querySelector<HTMLCanvasElement>('#gl')!;
const overlay = document.querySelector<HTMLCanvasElement>('#overlay')!;
const panel = document.querySelector<HTMLDivElement>('#panel')!;
const bar = document.querySelector<HTMLDivElement>('#bar')!;
const startBtn = document.querySelector<HTMLButtonElement>('#start')!;
const autoBtn = document.querySelector<HTMLButtonElement>('#auto')!;
const dbgBtn = document.querySelector<HTMLButtonElement>('#dbg')!;
const capBtn = document.querySelector<HTMLButtonElement>('#cap')!;
const resetBtn = document.querySelector<HTMLButtonElement>('#reset')!;
const shot = document.querySelector<HTMLImageElement>('#shot')!;
const octx = overlay.getContext('2d')!;

const renderer = createRenderer(glCanvas, video);
const adapter = new FaceFrameAdapter();
const tracker = new FaceTracker();
const camera = new Camera(video, {
  onPermissionDenied: () => fail('카메라 권한이 거부됐어요. 브라우저 설정에서 허용 후 새로고침하세요.'),
  onNoCamera: () => fail('카메라를 찾을 수 없어요.'),
});

function fail(msg: string): void {
  panel.textContent = msg;
  startBtn.hidden = false;
  startBtn.disabled = false;
  startBtn.textContent = '다시 시도';
}

// ---- 크기 ----
function resize(): void {
  const dpr = devicePixelRatio || 1;
  const odpr = Math.min(dpr, 2);
  overlay.width = Math.round(innerWidth * odpr);
  overlay.height = Math.round(innerHeight * odpr);
  octx.setTransform(odpr, 0, 0, odpr, 0, 0);
  renderer.resize({ w: innerWidth, h: innerHeight }, { w: video.videoWidth, h: video.videoHeight }, dpr);
}
addEventListener('resize', resize);
addEventListener('orientationchange', resize);
video.addEventListener('loadedmetadata', resize);
video.addEventListener('resize', resize);

// ---- 물림 입력 ----
const events: BiteEvent[] = [];
let autoBite = false;
let showDebug = true;
let nextAutoAt = 0;
let captureRequested = false;

function nearestAnchor(p: Vec2): number {
  const lms = adapter.frame.landmarks;
  let best = ANCHORS[0];
  let bestD = Infinity;
  for (const idx of ANCHORS) {
    const lm = lms[idx];
    if (!lm) continue;
    const d = Math.hypot(lm.x - p.x, lm.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = idx;
    }
  }
  return best;
}

overlay.addEventListener('pointerdown', (e) => {
  if (adapter.frame.landmarks.length === 0) return;
  const pos = { x: e.clientX, y: e.clientY };
  events.push({ anchorIdx: nearestAnchor(pos), pos, t: performance.now() });
});

function toggle(btn: HTMLButtonElement, on: boolean): boolean {
  btn.setAttribute('aria-pressed', String(on));
  return on;
}
autoBtn.addEventListener('click', () => {
  autoBite = toggle(autoBtn, !autoBite);
});
dbgBtn.addEventListener('click', () => {
  showDebug = toggle(dbgBtn, !showDebug);
});
capBtn.addEventListener('click', () => {
  captureRequested = true;
});
resetBtn.addEventListener('click', () => {
  renderer.reset();
  shot.hidden = true;
});

function maybeAutoBite(now: number): void {
  const face = adapter.frame;
  if (!autoBite || !face.visible || face.landmarks.length === 0 || now < nextAutoAt) return;
  nextAutoAt = now + AUTO_BITE_MS;
  const idx = ANCHORS[Math.floor(Math.random() * ANCHORS.length)];
  const lm = face.landmarks[idx];
  const j = AUTO_JITTER * face.faceW;
  events.push({
    anchorIdx: idx,
    pos: { x: lm.x + (Math.random() - 0.5) * 2 * j, y: lm.y + (Math.random() - 0.5) * 2 * j },
    t: now,
  });
}

// ---- 디버그 ----
const tmp: Vec2 = { x: 0, y: 0 };

function drawDebug(): void {
  octx.clearRect(0, 0, innerWidth, innerHeight);
  if (!showDebug) return;
  const face = adapter.frame;
  if (face.landmarks.length === 0) return;

  octx.fillStyle = face.visible ? '#ffcc33' : '#888';
  for (const idx of ANCHORS) {
    const p = face.landmarks[idx];
    octx.beginPath();
    octx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    octx.fill();
  }

  octx.strokeStyle = '#3f6';
  octx.lineWidth = 1.5;
  for (const b of renderer.bites) {
    const lm = face.landmarks[b.anchorIdx];
    rotate(b.localOffset.x * face.faceW, b.localOffset.y * face.faceW, face.rotation, tmp);
    const x = lm.x + tmp.x;
    const y = lm.y + tmp.y;
    octx.beginPath();
    octx.arc(x, y, b.radius * face.faceW, 0, Math.PI * 2);
    octx.moveTo(x + 3, y);
    octx.arc(x, y, 3, 0, Math.PI * 2);
    octx.stroke();
  }
}

// ---- 루프 ----
let lastVideoTime = -1;
let lastResult: FaceTrackResult = { landmarks: {}, faceW: 0, visible: false, justLost: false };
let fps = 0;
let detectPerSec = 0;
let detectCount = 0;
let detectWindowStart = 0;
let prev = 0;

function loop(now: number): void {
  const dt = now - prev;
  prev = now;
  if (dt > 0) fps = fps * 0.95 + (1000 / dt) * 0.05;

  // 새 비디오 프레임일 때만 인식 (5.3)
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    lastResult = tracker.detect(video, now);
    detectCount++;
  }
  if (now - detectWindowStart >= 1000) {
    detectPerSec = (detectCount * 1000) / (now - detectWindowStart);
    detectCount = 0;
    detectWindowStart = now;
  }

  const face = adapter.update(lastResult, video.videoWidth, video.videoHeight, innerWidth, innerHeight, now);
  maybeAutoBite(now);
  renderer.draw(face, events);
  events.length = 0;
  drawDebug();

  if (captureRequested) {
    captureRequested = false;
    shot.src = renderer.capture(overlay).toDataURL('image/jpeg', 0.9);
    shot.hidden = false;
  }

  panel.textContent =
    `fps ${fps.toFixed(0)}  인식 ${detectPerSec.toFixed(0)}/s\n` +
    `video ${video.videoWidth}x${video.videoHeight}  gl ${glCanvas.width}x${glCanvas.height}\n` +
    `face ${face.visible ? 'visible' : 'lost'}  faceW ${face.faceW.toFixed(0)}px  rot ${((face.rotation * 180) / Math.PI).toFixed(0)}°\n` +
    `bites ${renderer.bites.length}  (얼굴을 탭하면 물림)`;

  requestAnimationFrame(loop);
}

// iOS: getUserMedia·video.play는 사용자 제스처 안에서
startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  startBtn.textContent = '카메라 준비 중...';
  if (!(await camera.start())) return;
  resize();

  startBtn.textContent = '인식 모델 불러오는 중...';
  try {
    await tracker.init();
  } catch (err) {
    console.error('[render demo] 얼굴 인식 모델 로딩 실패', err);
    fail('인식 모델을 불러오지 못했어요. 네트워크를 확인하세요.');
    return;
  }

  startBtn.hidden = true;
  bar.hidden = false;
  requestAnimationFrame(loop);
});
