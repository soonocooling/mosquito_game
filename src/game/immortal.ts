// src/game/immortal.ts
// F-10 분열 추가 규칙: 분열로 생긴 모기 중 절반은 평생 무적 (팀장 결정 — 모기가 너무 쉽게 죽어서 재미가 없음).
// 겉모습은 같다. 어느 쪽이 무적인지 플레이어는 모른다 (?debug=1에서만 "무적" 표시).
//
// 분열 코드에서 새로 만든 모기들을 넘기면 된다:
//   const children = split(pos, faceW, now);
//   makeHalfImmortal(children);

import { SPLIT_IMMORTAL_RATIO } from "./config";

export interface CanBeImmortal {
  immortal: boolean;
}

/** children 중 SPLIT_IMMORTAL_RATIO 비율(반올림)을 무작위로 골라 평생 무적으로 만든다 */
export function makeHalfImmortal(children: ReadonlyArray<CanBeImmortal>, random: () => number = Math.random): void {
  const count = Math.round(children.length * SPLIT_IMMORTAL_RATIO);
  const picks = children.map((_, i) => i);
  for (let i = 0; i < count; i++) {
    // 남은 후보 중 하나를 무작위로 골라 앞으로 옮긴다 (Fisher–Yates 일부)
    const j = i + Math.floor(random() * (picks.length - i));
    [picks[i], picks[j]] = [picks[j], picks[i]];
    children[picks[i]].immortal = true;
  }
}
