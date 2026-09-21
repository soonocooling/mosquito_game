// src/game/swat.ts
// F-08 잡기 판정. 4종 중 하나라도 만족하면 처치: 스윙 · 박수 · 움켜쥐기 · 클릭(탭).
// 스윙은 "직전 손 위치 → 현재 손 위치" 선분 기준이라 빠른 손이 모기를 건너뛰지 않는다.

import type { FrameInput, HandFrame, Vec2 } from "../shared/types";
import {
  CLAP_CLOSE,
  CLAP_HIT,
  CLAP_SHRINK,
  CLAP_WINDOW_MS,
  GRAB_WINDOW_MS,
  GRIP_CLOSED,
  GRIP_OPEN,
  MOSQ_HIT_R,
  SWAT_COOLDOWN_MS,
  SWING_SPEED,
  TAP_R,
} from "./config";
import type { HandHistory } from "./hands";

export type SwatKind = "swing" | "clap" | "grab" | "tap";

export interface Swattable {
  position: Vec2;
  readonly isInvulnerable: boolean;
}

/** 점 p와 선분 ab 사이 거리 */
export function distPointSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let k = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  k = Math.max(0, Math.min(1, k));
  return Math.hypot(px - (ax + dx * k), py - (ay + dy * k));
}

export class Swatter {
  private clapUntil = 0;
  private readonly grabUntil = { Left: 0, Right: 0 };
  /** 한 프레임 안의 중복 처치 방지 (재사용) */
  private readonly killed = new Set<Swattable>();

  reset(): void {
    this.clapUntil = 0;
    this.grabUntil.Left = 0;
    this.grabUntil.Right = 0;
  }

  /**
   * 이번 프레임에 잡힌 모기를 onKill로 알려준다 (여러 마리 동시 가능, 같은 모기는 한 번만).
   * 무적(분열 직후) 모기는 제외, LANDED도 잡힌다.
   */
  judge<T extends Swattable>(
    mosquitoes: ReadonlyArray<T>,
    input: FrameInput,
    history: HandHistory,
    handsEnabled: boolean,
    onKill: (m: T, kind: SwatKind) => void,
  ): void {
    const fw = input.face.faceW || 1;
    const now = input.now;
    const hitR = MOSQ_HIT_R * fw;
    const killed = this.killed;
    killed.clear();
    const kill = (m: T, kind: SwatKind) => {
      if (killed.has(m) || m.isInvulnerable) return;
      killed.add(m);
      onKill(m, kind);
    };

    // 4. 클릭(탭) — 손 인식을 꺼도 항상 동작
    for (const tap of input.taps) {
      for (const m of mosquitoes) {
        if (Math.hypot(m.position.x - tap.x, m.position.y - tap.y) < TAP_R * fw) kill(m, "tap");
      }
    }
    if (!handsEnabled) return;

    for (const h of input.hands) {
      const tr = history.track(h.side);

      // 1. 스윙: 빠른 손의 이동 선분이 모기를 지나가면
      const prev = tr.prev;
      const last = tr.last;
      if (tr.fresh && prev && last && Math.hypot(h.velocity.x, h.velocity.y) / fw > SWING_SPEED) {
        for (const m of mosquitoes) {
          if (distPointSeg(m.position.x, m.position.y, prev.x, prev.y, last.x, last.y) < h.palmR + hitR) kill(m, "swing");
        }
      }

      // 3. 움켜쥐기: 모기가 손바닥 안에 있고 200 ms 안에 편 손 → 주먹
      if (now >= this.grabUntil[h.side] && h.grip < GRIP_CLOSED && tr.maxGripSince(h.t, GRAB_WINDOW_MS) >= GRIP_OPEN) {
        let grabbed = false;
        for (const m of mosquitoes) {
          if (Math.hypot(m.position.x - h.palm.x, m.position.y - h.palm.y) < h.palmR) {
            kill(m, "grab");
            grabbed = true;
          }
        }
        if (grabbed) this.grabUntil[h.side] = now + SWAT_COOLDOWN_MS;
      }
    }

    // 2. 박수: 두 손이 150 ms 안에 절반 이하로 가까워져 0.6 faceW 안으로
    const a = input.hands.find((h) => h.side === "Left");
    const b = input.hands.find((h) => h.side === "Right");
    if (a && b && now >= this.clapUntil && this.isClap(a, b, history, fw)) {
      let clapped = false;
      for (const m of mosquitoes) {
        if (distPointSeg(m.position.x, m.position.y, a.palm.x, a.palm.y, b.palm.x, b.palm.y) < CLAP_HIT * fw) {
          kill(m, "clap");
          clapped = true;
        }
      }
      if (clapped) this.clapUntil = now + SWAT_COOLDOWN_MS;
    }
  }

  private isClap(a: HandFrame, b: HandFrame, history: HandHistory, fw: number): boolean {
    const distNow = Math.hypot(a.palm.x - b.palm.x, a.palm.y - b.palm.y);
    if (distNow >= CLAP_CLOSE * fw) return false;
    const t = Math.max(a.t, b.t);
    const pa = history.left.since(t, CLAP_WINDOW_MS);
    const pb = history.right.since(t, CLAP_WINDOW_MS);
    if (!pa || !pb) return false;
    const distBefore = Math.hypot(pa.x - pb.x, pa.y - pb.y);
    return distBefore > 0 && distNow <= distBefore * CLAP_SHRINK;
  }
}
