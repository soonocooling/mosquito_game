// src/game/mosquitoManager.ts
// 여러 마리 모기를 관리 (생성 / 매 프레임 갱신 / 렌더용 목록 제공)

import { Mosquito, split } from "./mosquito";
import type { Vec2, FaceState, GameOutput } from "./types";

export class MosquitoManager {
  mosquitoes: Mosquito[] = [];
  /** F-06: 매 프레임 update가 채워서 반환한다 (배열은 재사용) */
  readonly output: GameOutput = { biteEvents: [], shake: false };
  private prevLandmarkPos: Vec2 | null = null;
  private prevTime = performance.now();

  /** F-11: 시작 시 화면 밖 랜덤 위치에서 모기 1마리 생성 */
  spawnFromEdge(screenW: number, screenH: number) {
    const edge = Math.floor(Math.random() * 4);
    let pos: Vec2;
    switch (edge) {
      case 0: pos = { x: Math.random() * screenW, y: -20 }; break; // 위
      case 1: pos = { x: screenW + 20, y: Math.random() * screenH }; break; // 오른쪽
      case 2: pos = { x: Math.random() * screenW, y: screenH + 20 }; break; // 아래
      default: pos = { x: -20, y: Math.random() * screenH }; break; // 왼쪽
    }
    this.mosquitoes.push(new Mosquito(pos));
  }

  /** F-10(분열) 등에서 특정 위치에 모기를 추가할 때 사용 */
  spawnAt(pos: Vec2, state?: "SPAWNING" | "APPROACH") {
    this.mosquitoes.push(new Mosquito(pos, state));
  }

  removeById(id: number) {
    this.mosquitoes = this.mosquitoes.filter((m) => m.id !== id);
  }

  /** F-10: 잡힌 모기 한 마리를 같은 자리의 새 모기 두 마리로 교체합니다. */
  splitById(id: number, faceWidthPx: number, now: number): boolean {
    const index = this.mosquitoes.findIndex((m) => m.id === id);
    if (index < 0 || this.mosquitoes[index].isInvulnerable) return false;
    const caught = this.mosquitoes[index];
    const children = split(caught.position, faceWidthPx, now);
    this.mosquitoes.splice(index, 1, ...children);
    return true;
  }

  /**
   * 매 프레임 호출.
   * rawLandmarks: perception 모듈에서 받은 이번 프레임 랜드마크 좌표(px)
   * faceWidthPx: perception 모듈에서 받은 얼굴 폭(px)
   * visible: 얼굴이 화면에 보이는지 (F-02, 안 보이면 모기는 대기)
   * 반환: 이번 프레임의 물림 이벤트와 화면 흔들림 여부 (F-06). render(B)의 draw에 biteEvents를 넘긴다
   */
  update(rawLandmarks: Record<number, Vec2>, faceWidthPx: number, visible = true): GameOutput {
    const now = performance.now();
    const dt = Math.min((now - this.prevTime) / 1000, 0.05);
    this.prevTime = now;

    // 얼굴 속도(px/s) 추정: 코끝(1번) 랜드마크 이동량 기준
    let velocity: Vec2 = { x: 0, y: 0 };
    const ref = rawLandmarks[1] ?? Object.values(rawLandmarks)[0];
    if (this.prevLandmarkPos && ref && dt > 0) {
      velocity = {
        x: (ref.x - this.prevLandmarkPos.x) / dt,
        y: (ref.y - this.prevLandmarkPos.y) / dt,
      };
    }
    this.prevLandmarkPos = ref ? { ...ref } : this.prevLandmarkPos;

    const face: FaceState = { landmarks: rawLandmarks, faceWidthPx, velocity, visible };
    const out = this.output;
    out.biteEvents.length = 0;
    for (const m of this.mosquitoes) {
      m.update(dt, face, this.mosquitoes, out.biteEvents);
    }
    out.shake = out.biteEvents.length > 0;
    return out;
  }
}
