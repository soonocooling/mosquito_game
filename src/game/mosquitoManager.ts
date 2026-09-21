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

  /**
   * 모기를 화면 안에 가둔다: 가장자리에서 margin(px) 안쪽으로 밀어 넣고, 바깥으로 향하던 속도는 없앤다.
   * 화면 밖에서 태어난 모기(spawnFromEdge)도 첫 프레임에 가장자리로 들어온다.
   */
  confine(screenW: number, screenH: number, margin: number) {
    const minX = margin;
    const minY = margin;
    const maxX = Math.max(margin, screenW - margin);
    const maxY = Math.max(margin, screenH - margin);
    for (const m of this.mosquitoes) {
      if (m.position.x < minX) {
        m.position.x = minX;
        if (m.velocity.x < 0) m.velocity.x = 0;
      } else if (m.position.x > maxX) {
        m.position.x = maxX;
        if (m.velocity.x > 0) m.velocity.x = 0;
      }
      if (m.position.y < minY) {
        m.position.y = minY;
        if (m.velocity.y < 0) m.velocity.y = 0;
      } else if (m.position.y > maxY) {
        m.position.y = maxY;
        if (m.velocity.y > 0) m.velocity.y = 0;
      }
    }
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
    // 모기 수 상한은 없다 (팀장 결정)
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
