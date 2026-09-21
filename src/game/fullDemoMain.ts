// public/full-test.html 전용 엔트리.
// F-01(웹캠·화면구성) + F-02(얼굴추적) + F-03(손추적) + F-04(모기 비행) + F-11(HUD·흐름)을
// 실제 웹캠으로 한 번에 테스트하기 위한 통합 데모. index.html/main.ts(공용 파일)는 건드리지 않는다.
import "./camera.css";
import { Camera, type DistanceHint } from "./camera";
import { FaceTracker } from "./faceTracking";
import { HandTracker, type HandTrackResult } from "./handTracking";
import { MosquitoManager } from "./mosquitoManager";
import { GameFlow } from "../ui/gameFlow";
import type { Vec2 } from "./types";

const app = document.getElementById("app") as HTMLDivElement;
const startBtn = document.getElementById("start-btn") as HTMLButtonElement;
const debugEl = document.getElementById("debug") as HTMLDivElement;

const stage = document.createElement("div");
stage.className = "camera-stage";
const video = document.createElement("video");
const canvas = document.createElement("canvas");
stage.appendChild(video);
stage.appendChild(canvas);
app.appendChild(stage);

const orientationBlock = document.createElement("div");
orientationBlock.className = "orientation-block";
orientationBlock.textContent = "화면을 세로로 돌려주세요 📱";
app.appendChild(orientationBlock);

const distanceHintEl = document.createElement("div");
distanceHintEl.className = "distance-hint";
app.appendChild(distanceHintEl);

const statusEl = document.createElement("div");
statusEl.className = "status-message";
app.appendChild(statusEl);

function showStatus(text: string) {
  statusEl.textContent = text;
  statusEl.classList.add("visible");
}
function hideStatus() {
  statusEl.classList.remove("visible");
}

const ctx = canvas.getContext("2d")!;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

const camera = new Camera(video, {
  onPermissionDenied: () => {
    showStatus("카메라 권한이 필요해요.\n브라우저 설정에서 허용한 뒤 다시 시작해주세요.");
    startBtn.style.display = "block";
    startBtn.textContent = "다시 시도";
    startBtn.disabled = false;
  },
  onNoCamera: () => {
    showStatus("카메라를 찾을 수 없음");
  },
  onOrientationBlocked: (blocked) => {
    orientationBlock.classList.toggle("visible", blocked);
    if (blocked) flow?.stop();
  },
  onDistanceHint: (hint: DistanceHint) => {
    if (hint === "closer") {
      distanceHintEl.textContent = "좀 더 가까이";
      distanceHintEl.classList.add("visible");
    } else if (hint === "farther") {
      distanceHintEl.textContent = "폰을 조금 멀리 — 손이 보이게";
      distanceHintEl.classList.add("visible");
    } else {
      distanceHintEl.classList.remove("visible");
    }
  },
});

const faceTracker = new FaceTracker();
const handTracker = new HandTracker();
const manager = new MosquitoManager();

let flow: GameFlow | null = null;
let running = false;
let faceLostToastUntil = 0;

function spawnInitial() {
  manager.spawnFromEdge(window.innerWidth, window.innerHeight);
}

function drawHand(h: HandTrackResult, screenW: number, screenH: number) {
  const center = camera.mapPoint(h.palmCenter, screenW, screenH);
  const r = camera.mapLength(h.palmR, screenW, screenH);
  ctx.strokeStyle = h.grip < 0.55 ? "#ffcc33" : "#33ccff"; // 오므릴수록 노란색 (F-08 판정 참고용)
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function loop() {
  if (!running) return;
  const now = performance.now();
  const screenW = canvas.width;
  const screenH = canvas.height;

  const faceResult = faceTracker.detect(video, now);
  const handResults = handTracker.detect(video, now);

  const screenLandmarks: Record<number, Vec2> = {};
  for (const idx of Object.keys(faceResult.landmarks)) {
    const i = Number(idx);
    screenLandmarks[i] = camera.mapPoint(faceResult.landmarks[i], screenW, screenH);
  }
  const faceWidthScreenPx = camera.mapLength(faceResult.faceW, screenW, screenH);

  manager.update(screenLandmarks, faceWidthScreenPx, faceResult.visible);
  camera.checkDistanceHint(faceWidthScreenPx, screenW);

  if (faceResult.justLost) {
    faceLostToastUntil = now + 1200;
  }

  ctx.clearRect(0, 0, screenW, screenH);

  for (const m of manager.mosquitoes) {
    const size = m.getSize(faceWidthScreenPx || 60);
    ctx.fillStyle = m.wingFrame === 0 ? "#333" : "#555";
    ctx.beginPath();
    ctx.ellipse(m.position.x, m.position.y, size, size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const h of handResults) {
    drawHand(h, screenW, screenH);
  }

  if (now < faceLostToastUntil) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(screenW / 2 - 90, 16, 180, 30);
    ctx.fillStyle = "#fff";
    ctx.font = "14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("얼굴 어디 갔어?", screenW / 2, 37);
  }

  const handDebug = handResults
    .map((h) => `${h.handedness}: v=${Math.hypot(h.velocity.x, h.velocity.y).toFixed(0)}px/s grip=${h.grip.toFixed(2)}`)
    .join("\n");
  const track = (video.srcObject as MediaStream | null)?.getVideoTracks()[0];
  const videoDebug =
    `video: ${video.videoWidth}x${video.videoHeight} readyState=${video.readyState} paused=${video.paused}\n` +
    `track: ${track ? `${track.readyState} muted=${track.muted} label=${track.label}` : "없음"}`;
  debugEl.textContent = `${videoDebug}\nface: ${faceResult.visible ? "visible" : "lost"} faceW=${faceWidthScreenPx.toFixed(0)}px\n${handDebug}`;

  flow?.tick(manager.mosquitoes.length);
  requestAnimationFrame(loop);
}

startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;
  startBtn.textContent = "카메라 준비 중...";
  hideStatus();

  const ok = await camera.start();
  if (!ok) {
    startBtn.disabled = false;
    return;
  }

  startBtn.textContent = "인식 모델 불러오는 중...";
  try {
    await Promise.all([faceTracker.init(), handTracker.init()]);
  } catch (err) {
    // 모델(wasm/.task 파일)을 CDN에서 못 받아오면 여기서 걸린다.
    // 보통 네트워크 차단(학교/회사 와이파이, 방화벽)이거나 방금 npm install을 안 한 경우다.
    console.error("[모기게임] 얼굴/손 인식 모델 로딩 실패:", err);
    showStatus(
      "인식 모델을 불러오지 못했어요.\n" +
        "인터넷 연결을 확인하거나(학교·회사 와이파이는 막혀있을 수 있어요),\n" +
        "브라우저 개발자 도구(F12) → Console 탭의 에러 메시지를 확인해주세요.",
    );
    startBtn.style.display = "block";
    startBtn.textContent = "다시 시도";
    startBtn.disabled = false;
    return;
  }

  startBtn.style.display = "none";
  spawnInitial();
  flow = new GameFlow(app, () => {
    running = false;
  });
  flow.start();
  running = true;
  requestAnimationFrame(loop);
});
