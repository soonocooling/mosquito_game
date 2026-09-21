// src/ui/gameFlow.ts
// F-11: 게임 흐름 (시작 -> 진행 -> 그만하기 -> S-5)

import { Hud, type HudState } from "./hud";
import { BuzzAudio } from "./buzzAudio";

export class GameFlow {
  private hud: Hud;
  private buzz = new BuzzAudio();
  private bottomBar: HTMLDivElement;
  private startTime = 0;
  private running = false;
  private onStop: () => void;
  state: HudState = { bites: 0, caught: 0, mosquitoCount: 0, elapsedSec: 0 };

  /**
   * @param container HUD를 붙일 화면 요소 (보통 #app)
   * @param onStop "그만하기"를 눌렀을 때 실행할 콜백 (S-5 결과 화면으로 넘기는 자리)
   */
  constructor(container: HTMLElement, onStop: () => void) {
    this.onStop = onStop;
    this.hud = new Hud(container);
    this.bottomBar = document.createElement("div");
    this.bottomBar.className = "hud-bottom";
    this.bottomBar.innerHTML = `
      <button type="button" data-el="mute">음소거</button>
      <button type="button" data-el="stop">그만하기</button>
    `;
    container.appendChild(this.bottomBar);

    this.bottomBar.querySelector('[data-el="mute"]')!
      .addEventListener("click", () => this.buzz.toggleMute());
    this.bottomBar.querySelector('[data-el="stop"]')!
      .addEventListener("click", () => this.stop());
  }

  /** "시작" 버튼 클릭 핸들러 안에서 호출 (오디오 자동재생 제한 우회용) */
  start() {
    this.buzz.init();
    this.startTime = performance.now();
    this.running = true;
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.buzz.stop();
    this.onStop();
  }

  isRunning() {
    return this.running;
  }

  /** F-06 담당자가 물릴 때 호출 */
  onBite() {
    this.state.bites++;
  }

  /** F-08 담당자가 모기를 잡았을 때 호출 */
  onCaught() {
    this.state.caught++;
  }

  /** 매 프레임 호출 */
  tick(mosquitoCount: number) {
    if (!this.running) return;
    this.state.mosquitoCount = mosquitoCount;
    this.state.elapsedSec = (performance.now() - this.startTime) / 1000;
    this.buzz.setMosquitoCount(mosquitoCount);
    this.hud.update(this.state);
  }

  destroy() {
    this.hud.destroy();
    this.bottomBar.remove();
  }
}
