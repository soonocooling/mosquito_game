// src/ui/hud.ts
// F-11: HUD (물린 횟수 / 잡은 모기 / 현재 모기 수 / 경과 시간)

import "./hud.css";

export interface HudState {
  bites: number;
  caught: number;
  mosquitoCount: number;
  elapsedSec: number;
}

export class Hud {
  private root: HTMLDivElement;
  private bitesEl: HTMLSpanElement;
  private caughtEl: HTMLSpanElement;
  private countEl: HTMLSpanElement;
  private timeEl: HTMLSpanElement;

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "hud-top";
    this.root.innerHTML = `
      <span>물린 <span data-el="bites">0</span></span>
      <span>잡음 <span data-el="caught">0</span></span>
      <span>모기 <span data-el="count">0</span></span>
      <span data-el="time">00:00</span>
    `;
    container.appendChild(this.root);

    this.bitesEl = this.root.querySelector('[data-el="bites"]')!;
    this.caughtEl = this.root.querySelector('[data-el="caught"]')!;
    this.countEl = this.root.querySelector('[data-el="count"]')!;
    this.timeEl = this.root.querySelector('[data-el="time"]')!;
  }

  update(state: HudState) {
    this.bitesEl.textContent = String(state.bites);
    this.caughtEl.textContent = String(state.caught);
    this.countEl.textContent = String(state.mosquitoCount);
    const m = Math.floor(state.elapsedSec / 60).toString().padStart(2, "0");
    const s = Math.floor(state.elapsedSec % 60).toString().padStart(2, "0");
    this.timeEl.textContent = `${m}:${s}`;
  }

  destroy() {
    this.root.remove();
  }
}
