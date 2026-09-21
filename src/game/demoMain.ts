// src/game/demoMain.ts
// F-04 + F-11 동작 확인용 임시 테스트 진입점입니다.
// perception(F-01~F-03) 담당자의 실제 얼굴 인식 코드가 준비되면
// "임시: 마우스를 얼굴처럼 사용" 부분만 실제 랜드마크 데이터로 바꾸면 됩니다.
// main.ts는 건드리지 않았고, /mosquito-test.html 로 접속해야 이 파일이 실행됩니다.

import { MosquitoManager } from "./mosquitoManager";
import { GameFlow } from "../ui/gameFlow";
import { ANCHOR_IDS } from "./config";
import type { MosquitoState, Vec2 } from "./types";

// F-06 상태 확인용 색 (LANDED = 빨강: 곧 문다)
const STATE_COLOR: Record<MosquitoState, string> = {
  SPAWNING: "#88f",
  APPROACH: "#333",
  LANDED: "#e33",
  BITE: "#f00",
  FLY_OFF: "#fa0",
  COOLDOWN: "#777",
};
const SHAKE_MS = 80;
const SHAKE_PX = 3;
let shakeUntil = 0;

const app = document.querySelector<HTMLDivElement>("#app")!;

const canvas = document.createElement("canvas");
canvas.id = "game-canvas";
app.appendChild(canvas);
const ctx = canvas.getContext("2d")!;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

const startBtn = document.createElement("button");
startBtn.id = "start-btn";
startBtn.textContent = "시작";
document.body.appendChild(startBtn);

const manager = new MosquitoManager();
const flow = new GameFlow(app, () => {
  // F-11: "그만하기" -> S-5 결과 화면으로 넘기는 자리.
  // 지금은 데모라 알림만 띄웁니다.
  alert(
    `종료!\n물린 횟수: ${flow.state.bites}\n잡은 모기: ${flow.state.caught}\n` +
      `모기 수: ${flow.state.mosquitoCount}\n경과 시간: ${Math.floor(flow.state.elapsedSec)}초`
  );
});

// ---- 임시: 마우스(터치)를 얼굴 랜드마크처럼 사용 ----
let pointer: Vec2 = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
window.addEventListener("mousemove", (e) => {
  pointer = { x: e.clientX, y: e.clientY };
});
window.addEventListener(
  "touchmove",
  (e) => {
    const t = e.touches[0];
    if (t) pointer = { x: t.clientX, y: t.clientY };
  },
  { passive: true }
);
const FAKE_FACE_WIDTH = 140; // px, 임시 값

startBtn.addEventListener("click", () => {
  flow.start();
  manager.spawnFromEdge(canvas.width, canvas.height);
  startBtn.style.display = "none";
});

// 모기를 직접 클릭하면 잡힌 것처럼 없애서 F-11 onCaught 연동도 확인 가능
canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const clickPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  for (const m of manager.mosquitoes) {
    const size = m.getSize(FAKE_FACE_WIDTH);
    if (Math.hypot(m.position.x - clickPos.x, m.position.y - clickPos.y) < size) {
      manager.removeById(m.id);
      flow.onCaught();
      manager.spawnFromEdge(canvas.width, canvas.height); // 테스트용으로 하나 다시 보충
      break;
    }
  }
});

function loop() {
  if (flow.isRunning()) {
    const fakeLandmarks: Record<number, Vec2> = {};
    for (const idx of ANCHOR_IDS) {
      fakeLandmarks[idx] = pointer;
    }
    const out = manager.update(fakeLandmarks, FAKE_FACE_WIDTH, true);
    for (let i = 0; i < out.biteEvents.length; i++) flow.onBite();
    if (out.shake) shakeUntil = performance.now() + SHAKE_MS;
    flow.tick(manager.mosquitoes.length);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const m of manager.mosquitoes) {
    const size = m.getSize(FAKE_FACE_WIDTH);
    ctx.fillStyle = STATE_COLOR[m.state];
    ctx.globalAlpha = m.wingFrame === 0 ? 1 : 0.8;
    ctx.beginPath();
    ctx.ellipse(m.position.x, m.position.y, size, size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // F-06: 물린 순간 화면 흔들림 80ms
  canvas.style.transform =
    performance.now() < shakeUntil ? `translate(${Math.random() < 0.5 ? -SHAKE_PX : SHAKE_PX}px, 0)` : "";

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
