// src/game/index.ts
// C의 Game 구현 (spec 5.2). 기존 MosquitoManager(F-04, F-06)와 GameFlow(F-11 HUD·소리)를 main.ts에 연결한다.
// F-08(잡기)·F-10(분열)은 아직 없음 — 들어오면 update 안에서 input.hands / input.taps 로 판정한다.

import type { FrameInput, Game, GameOutput, GameStats, Quality, Vec2 } from "../shared/types";
import { GameFlow } from "../ui/gameFlow";
import { MosquitoManager } from "./mosquitoManager";
import { drawMosquitoSprite } from "./mosquitoSprite";

const EMPTY_OUTPUT: GameOutput = { biteEvents: [], shake: false };

export class GameImpl implements Game {
  readonly manager = new MosquitoManager();
  private readonly flow: GameFlow;
  private faceW = 0;
  private viewport = { w: 0, h: 0 };
  private paused = false;
  private mosquitoCap = Infinity;
  readonly stats: GameStats = { bites: 0, kills: 0, mosquitoCount: 0, startedAt: 0 };

  /**
   * @param hudRoot HUD·하단 버튼을 붙일 요소. 게임 화면에서만 보이도록 main이 hidden을 관리한다
   * @param onStop "그만하기" → main이 결과 화면(S-5)으로 넘긴다
   */
  constructor(hudRoot: HTMLElement, onStop: () => void) {
    this.flow = new GameFlow(hudRoot, onStop);
  }

  /** 시작·다시 하기 버튼 핸들러 안에서 호출 (브라우저 자동재생 제한: 오디오는 클릭 안에서만 켤 수 있다) */
  onUserGesture(): void {
    if (!this.flow.isRunning()) this.flow.start();
  }

  /** 첫 게임 시작과 다시 하기: 모기 1마리가 화면 밖에서 날아온다 (F-11) */
  reset(): void {
    this.manager.mosquitoes.length = 0;
    this.manager.spawnFromEdge(this.viewport.w || innerWidth, this.viewport.h || innerHeight);
    this.flow.resetStats();
    this.stats.bites = 0;
    this.stats.kills = 0;
    this.stats.mosquitoCount = this.manager.mosquitoes.length;
    this.stats.startedAt = performance.now();
  }

  update(input: FrameInput): GameOutput {
    this.viewport = input.viewport;
    if (this.paused) return EMPTY_OUTPUT;
    const face = input.face;
    this.faceW = face.faceW;
    // FaceFrame.landmarks(배열)는 인덱스로 접근하는 Record<number, Vec2>와 호환된다
    const out = this.manager.update(face.landmarks as Record<number, Vec2>, face.faceW, face.visible);
    for (let i = 0; i < out.biteEvents.length; i++) this.flow.onBite();
    this.stats.bites += out.biteEvents.length;
    this.stats.mosquitoCount = this.manager.mosquitoes.length;
    this.flow.tick(this.manager.mosquitoes.length);
    return out;
  }

  drawOverlay(ctx: CanvasRenderingContext2D): void {
    const size = this.manager.mosquitoes[0]?.getSize(this.faceW || 100) ?? 0;
    for (const m of this.manager.mosquitoes) drawMosquitoSprite(ctx, m, size);
  }

  setQuality(q: Quality): void {
    // F-10 분열이 들어오면 이 상한을 넘지 않게 한다
    this.mosquitoCap = q.mosquitoCap;
  }

  get cap(): number {
    return this.mosquitoCap;
  }

  setMuted(m: boolean): void {
    this.flow.setMuted(m);
  }

  pause(p: boolean): void {
    this.paused = p;
    this.flow.setPaused(p);
  }

  /** 결과 화면 표시용 (F-12) */
  get elapsedSec(): number {
    return this.flow.state.elapsedSec;
  }
}
