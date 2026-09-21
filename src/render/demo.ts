// src/render/demo.ts
// F-07/F-12 개발용 데모. A(perception)·C(game) 없이 렌더러만 확인한다.
// 접속: npm run dev → http://localhost:5173/src/render/demo.html  (?src=grid 이면 카메라 대신 격자 영상)
//
// - 가짜 얼굴(흰 십자)이 원을 그리며 움직이고 기울어진다. 탭/클릭한 자리에 물림 이벤트가 생긴다.
// - 초록 원 = renderer.bites 로 계산한 부기 중심·반경. 셰이더의 볼록 중심과 겹쳐야 한다(좌표 검증).
// - 키: M 움직임 on/off · R 초기화 · C 캡처 · Q 품질 하향 토글 · B 물림 50회
// 프로덕션 빌드에는 포함되지 않는다(index.html에서 import하지 않음).

import { rotate } from './bites';
import { createRenderer } from './gl';
import type { BiteEvent, FaceFrame, Quality, Vec2 } from './types';

const ANCHOR = 1; // 코끝
const LANDMARK_COUNT = 478;

const video = document.querySelector<HTMLVideoElement>('#video')!;
const glCanvas = document.querySelector<HTMLCanvasElement>('#gl')!;
const overlay = document.querySelector<HTMLCanvasElement>('#overlay')!;
const panel = document.querySelector<HTMLDivElement>('#panel')!;
const shot = document.querySelector<HTMLImageElement>('#shot')!;
const octx = overlay.getContext('2d')!;

const renderer = createRenderer(glCanvas, video);

// ---- 영상 소스 ----
function gridStream(): MediaStream {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 480;
  const g = c.getContext('2d')!;
  const paint = (t: number) => {
    const cell = 40;
    for (let y = 0; y < c.height; y += cell) {
      for (let x = 0; x < c.width; x += cell) {
        g.fillStyle = ((x + y) / cell) % 2 === 0 ? '#ddd' : '#555';
        g.fillRect(x, y, cell, cell);
      }
    }
    g.fillStyle = '#2a6';
    g.font = 'bold 48px sans-serif';
    g.fillText('L', 20, 60); // 좌상단 L이 화면에서 오른쪽 위에 보이면 거울 반전 정상
    g.fillStyle = '#e33';
    g.beginPath();
    g.arc(320 + Math.cos(t / 800) * 100, 240, 16, 0, Math.PI * 2);
    g.fill();
    requestAnimationFrame(paint);
  };
  requestAnimationFrame(paint);
  return c.captureStream(30);
}

async function startVideo(): Promise<string> {
  const wantGrid = new URLSearchParams(location.search).get('src') === 'grid';
  if (!wantGrid) {
    try {
      video.srcObject = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      await video.play();
      return 'camera';
    } catch (e) {
      console.warn('카메라 실패, 격자 영상으로 대체', e);
    }
  }
  video.srcObject = gridStream();
  await video.play();
  return 'grid';
}

// ---- 가짜 얼굴 ----
const landmarks: Vec2[] = Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0, y: 0 }));
const face: FaceFrame = {
  visible: true,
  landmarks,
  faceW: 0,
  rotation: 0,
  velocity: { x: 0, y: 0 },
  t: 0,
};
let moving = true;
const tmp: Vec2 = { x: 0, y: 0 };

function updateFace(now: number): void {
  const W = innerWidth;
  const H = innerHeight;
  const cx = W / 2 + (moving ? Math.cos(now / 1500) * W * 0.15 : 0);
  const cy = H / 2 + (moving ? Math.sin(now / 1500) * H * 0.1 : 0);
  face.faceW = Math.min(W, H) * 0.5;
  face.rotation = moving ? Math.sin(now / 1100) * 0.6 : 0;
  face.t = now;
  for (const p of landmarks) {
    p.x = cx;
    p.y = cy;
  }
  // faceW·rotation 정의(5.1, 5.2)에 맞춰 234/454, 33/263도 배치
  rotate(face.faceW / 2, 0, face.rotation, tmp);
  landmarks[234].x = cx - tmp.x;
  landmarks[234].y = cy - tmp.y;
  landmarks[454].x = cx + tmp.x;
  landmarks[454].y = cy + tmp.y;
}

// ---- 입력 ----
const events: BiteEvent[] = [];
overlay.addEventListener('pointerdown', (e) => {
  events.push({ anchorIdx: ANCHOR, pos: { x: e.clientX, y: e.clientY }, t: performance.now() });
});

const QUALITY_HIGH: Quality = {
  level: 0, handEvery: 1, numHands: 2, detectScale: 1, glScale: 1, maxBites: 32, mosquitoCap: 200, handsEnabled: true,
};
const QUALITY_LOW: Quality = { ...QUALITY_HIGH, level: 5, glScale: 0.5, maxBites: 16 };
let quality = QUALITY_HIGH;
let captureRequested = false;

addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'm') moving = !moving;
  if (k === 'r') renderer.reset();
  if (k === 'c') captureRequested = true;
  if (k === 'q') {
    quality = quality === QUALITY_HIGH ? QUALITY_LOW : QUALITY_HIGH;
    renderer.setQuality(quality);
  }
  if (k === 'b') {
    const now = performance.now();
    for (let i = 0; i < 50; i++) {
      events.push({
        anchorIdx: ANCHOR,
        pos: {
          x: landmarks[ANCHOR].x + (Math.random() - 0.5) * face.faceW,
          y: landmarks[ANCHOR].y + (Math.random() - 0.5) * face.faceW * 1.3,
        },
        t: now,
      });
    }
  }
});

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
video.addEventListener('loadedmetadata', resize);
video.addEventListener('resize', resize); // iOS는 회전 시 videoWidth/Height가 바뀐다

// ---- 루프 ----
let source = '...';
let fps = 0;
let prev = performance.now();

function drawDebug(): void {
  octx.clearRect(0, 0, innerWidth, innerHeight);
  const c = landmarks[ANCHOR];
  octx.strokeStyle = '#fff';
  octx.lineWidth = 2;
  rotate(12, 0, face.rotation, tmp);
  octx.beginPath();
  octx.moveTo(c.x - tmp.x, c.y - tmp.y);
  octx.lineTo(c.x + tmp.x, c.y + tmp.y);
  octx.moveTo(c.x + tmp.y, c.y - tmp.x);
  octx.lineTo(c.x - tmp.y, c.y + tmp.x);
  octx.stroke();

  octx.strokeStyle = '#3f6';
  octx.lineWidth = 1;
  for (const b of renderer.bites) {
    const lm = landmarks[b.anchorIdx];
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

function loop(now: number): void {
  const dt = now - prev;
  prev = now;
  if (dt > 0) fps = fps * 0.95 + (1000 / dt) * 0.05;

  updateFace(now);
  renderer.draw(face, events);
  events.length = 0;
  drawDebug();

  if (captureRequested) {
    captureRequested = false;
    shot.src = renderer.capture(overlay).toDataURL('image/jpeg', 0.9);
    shot.style.display = 'block';
  }

  panel.textContent =
    `src ${source}  video ${video.videoWidth}x${video.videoHeight}\n` +
    `gl ${glCanvas.width}x${glCanvas.height}  fps ${fps.toFixed(0)}\n` +
    `bites ${renderer.bites.length}/${quality.maxBites}  glScale ${quality.glScale}\n` +
    `M move:${moving ? 'on' : 'off'}  R reset  C capture  Q quality  B +50`;

  requestAnimationFrame(loop);
}

startVideo().then((s) => {
  source = s;
  resize();
});
requestAnimationFrame(loop);
