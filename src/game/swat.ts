// F-08 손 스윙 잡기 판정. 빠른 손이 모기를 건너뛰어도 잡히도록 점이 아닌 선분으로 검사합니다.

import { SWING_MIN_SPEED_FACEW } from "./config";
import type { Mosquito } from "./mosquito";
import type { HandState, Vec2 } from "./types";

interface PalmSample {
  pos: Vec2;
  t: number;
}

function distPointSeg(point: Vec2, start: Vec2, end: Vec2): number {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSq = segmentX * segmentX + segmentY * segmentY;
  if (lengthSq === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const projection = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / lengthSq),
  );
  const nearestX = start.x + segmentX * projection;
  const nearestY = start.y + segmentY * projection;
  return Math.hypot(point.x - nearestX, point.y - nearestY);
}

export class SwatDetector {
  private previous = new Map<HandState["handedness"], PalmSample>();

  detect(hands: HandState[], mosquitoes: readonly Mosquito[], faceWidthPx: number): number[] {
    const caughtIds = new Set<number>();
    const visibleSides = new Set<HandState["handedness"]>();
    const safeFaceWidth = Math.max(faceWidthPx, 1);

    for (const hand of hands) {
      visibleSides.add(hand.handedness);
      const prev = this.previous.get(hand.handedness);
      if (prev?.t === hand.t) continue;
      this.previous.set(hand.handedness, { pos: { ...hand.palmCenter }, t: hand.t });
      if (!prev) continue;

      const speedFaceW = Math.hypot(hand.velocity.x, hand.velocity.y) / safeFaceWidth;
      if (speedFaceW <= SWING_MIN_SPEED_FACEW) continue;

      for (const mosquito of mosquitoes) {
        if (mosquito.isInvulnerable || caughtIds.has(mosquito.id)) continue;
        const mosquitoR = mosquito.getSize(safeFaceWidth);
        if (distPointSeg(mosquito.position, prev.pos, hand.palmCenter) < hand.palmR + mosquitoR) {
          caughtIds.add(mosquito.id);
        }
      }
    }

    for (const side of this.previous.keys()) {
      if (!visibleSides.has(side)) this.previous.delete(side);
    }
    return [...caughtIds];
  }

  reset() {
    this.previous.clear();
  }
}
