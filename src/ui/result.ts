// src/ui/result.ts
// F-12 S-5 결과 화면: 부어오른 얼굴 마지막 프레임 + 통계, 저장·다시 하기. 서버 전송 없음.

export interface ResultStats {
  bites: number;
  kills: number;
  mosquitoCount: number;
  elapsedSec: number;
}

const JPEG_QUALITY = 0.9;

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export class ResultScreen {
  private readonly root: HTMLElement;
  private readonly img: HTMLImageElement;
  private readonly stats: HTMLParagraphElement;
  private readonly save: HTMLAnchorElement;
  private readonly again: HTMLButtonElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("section");
    this.root.className = "screen result";
    this.img = document.createElement("img");
    this.img.className = "result-image";
    this.img.alt = "퉁퉁 부은 얼굴";
    this.stats = document.createElement("p");
    this.stats.className = "result-stats";
    const actions = document.createElement("div");
    actions.className = "screen-actions";
    this.save = document.createElement("a");
    this.save.className = "btn";
    this.save.textContent = "저장";
    this.save.download = "mosquito.jpg";
    this.again = document.createElement("button");
    this.again.type = "button";
    this.again.className = "btn primary";
    this.again.textContent = "다시 하기";
    actions.append(this.save, this.again);
    this.root.append(this.img, this.stats, actions);
    this.root.hidden = true;
    parent.append(this.root);
  }

  show(image: HTMLCanvasElement, s: ResultStats, onAgain: () => void): void {
    const url = image.toDataURL("image/jpeg", JPEG_QUALITY);
    this.img.src = url;
    this.save.href = url;
    this.stats.textContent = `물림 ${s.bites} · 잡음 ${s.kills} · 모기 ${s.mosquitoCount} · ${formatTime(s.elapsedSec)}`;
    this.again.onclick = () => {
      this.hide();
      onAgain();
    };
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
