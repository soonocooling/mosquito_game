// src/platform/debug.ts
// F-16 ?debug=1 (데스크톱은 D 키로 토글): 좌상단 패널 + 오버레이에 랜드마크·손바닥·모기 상태·부기 중심.
// 쿼리가 없으면 아무 것도 그리지 않는다.

import type { Bite, FrameInput, Quality, Vec2 } from '../shared/types';
import type { PerfMonitor } from '../perception/perf';

export interface DebugMosquito {
  position: Vec2;
  state: string;
}

const tmp: Vec2 = { x: 0, y: 0 };

export class DebugPanel {
  enabled: boolean;
  /** 게임 화면(S-4)에서만 보인다 */
  private active = false;
  private readonly panel: HTMLDivElement;
  private readonly text: HTMLPreElement;
  private lastTextAt = 0;

  constructor(root: HTMLElement, enabled: boolean, onLevel: (delta: number) => void) {
    this.enabled = enabled;
    this.panel = document.createElement('div');
    this.panel.className = 'debug-panel';
    this.text = document.createElement('pre');
    const down = document.createElement('button');
    down.type = 'button';
    down.textContent = '품질 −';
    down.onclick = () => onLevel(+1);
    const up = document.createElement('button');
    up.type = 'button';
    up.textContent = '품질 +';
    up.onclick = () => onLevel(-1);
    this.panel.append(this.text, down, up);
    this.panel.hidden = true;
    root.append(this.panel);

    addEventListener('keydown', (e) => {
      if (e.key === 'd' || e.key === 'D') {
        this.enabled = !this.enabled;
        this.panel.hidden = !(this.enabled && this.active);
      }
    });
  }

  setActive(active: boolean): void {
    this.active = active;
    this.panel.hidden = !(this.enabled && this.active);
  }

  draw(
    ctx: CanvasRenderingContext2D,
    input: FrameInput,
    bites: ReadonlyArray<Bite>,
    perf: PerfMonitor,
    quality: Quality,
    delegate: string,
    mosquitoes: ReadonlyArray<DebugMosquito>,
  ): void {
    if (!this.enabled) return;
    const face = input.face;
    const fw = face.faceW || 1;

    // 478점
    ctx.fillStyle = face.visible ? 'rgba(0,255,160,0.7)' : 'rgba(160,160,160,0.6)';
    for (const p of face.landmarks) ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    const nose = face.landmarks[1];
    if (nose) {
      ctx.fillStyle = '#ff0';
      ctx.beginPath();
      ctx.arc(nose.x, nose.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 손바닥 원 (쥐면 노랑)
    ctx.lineWidth = 2;
    for (const h of input.hands) {
      ctx.strokeStyle = h.grip < 1.1 ? '#fc3' : '#3cf';
      ctx.beginPath();
      ctx.arc(h.palm.x, h.palm.y, h.palmR, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 부기 중심·반경 (render와 같은 식으로 계산 → 셰이더 볼록 중심과 겹쳐야 한다)
    ctx.strokeStyle = '#f3a';
    ctx.lineWidth = 1;
    for (const b of bites) {
      const lm = face.landmarks[b.anchorIdx];
      if (!lm) continue;
      const c = Math.cos(face.rotation);
      const s = Math.sin(face.rotation);
      const lx = b.localOffset.x * fw;
      const ly = b.localOffset.y * fw;
      tmp.x = lm.x + lx * c - ly * s;
      tmp.y = lm.y + lx * s + ly * c;
      ctx.beginPath();
      ctx.arc(tmp.x, tmp.y, b.radius * fw, 0, Math.PI * 2);
      ctx.moveTo(tmp.x + 3, tmp.y);
      ctx.arc(tmp.x, tmp.y, 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 모기 상태 문자
    ctx.fillStyle = '#fff';
    ctx.font = '10px ui-monospace, monospace';
    for (const m of mosquitoes) ctx.fillText(m.state.slice(0, 3), m.position.x + 8, m.position.y - 8);

    // 패널 텍스트는 4번/초만 갱신 (DOM 부담)
    if (input.now - this.lastTextAt < 250) return;
    this.lastTextAt = input.now;
    const hands = input.hands
      .map((h) => `${h.side}: v=${(Math.hypot(h.velocity.x, h.velocity.y) / fw).toFixed(2)} fW/s grip=${h.grip.toFixed(2)}`)
      .join('\n');
    this.text.textContent =
      `fps ${perf.fps.toFixed(0)}  인식 ${perf.detectsPerSec.toFixed(0)}/s  ${delegate}\n` +
      `face ${perf.faceMs.toFixed(1)}ms  hand ${perf.handMs.toFixed(1)}ms\n` +
      `품질 단계 ${quality.level}  glScale ${quality.glScale}  maxBites ${quality.maxBites}  hands ${quality.handsEnabled ? 'on' : 'off'}\n` +
      `face ${face.visible ? 'visible' : 'lost'}  faceW ${face.faceW.toFixed(0)}px  rot ${((face.rotation * 180) / Math.PI).toFixed(0)}°\n` +
      `bites ${bites.length}  모기 ${mosquitoes.length}` +
      (hands ? `\n${hands}` : '');
  }
}
