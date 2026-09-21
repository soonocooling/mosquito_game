// src/platform/screens.ts
// S-1 랜딩 · S-2 안내 · S-3 로딩 · 토스트 (product-spec 3장, F-01, F-14). 지금은 데스크톱 웹캠만 지원.
// S-5 결과 화면은 src/ui/result.ts (C).

export type ErrorKind = 'denied' | 'notfound' | 'model' | 'other';

const ERROR_TEXT: Record<ErrorKind, string> = {
  denied: '카메라 권한이 필요해요.\n브라우저 주소창의 카메라 아이콘이나 설정에서 허용한 뒤 다시 시도해 주세요.',
  notfound: '카메라를 찾을 수 없음\n웹캠이 연결된 컴퓨터에서 열어주세요.',
  model: '인식 모델을 불러오지 못했어요.\n인터넷 연결을 확인하고 다시 시도해 주세요.',
  other: '카메라를 여는 중에 문제가 생겼어요.',
};

const STAGE_LABEL = { wasm: '엔진', face: '얼굴 모델', hand: '손 모델', warmup: '준비' } as const;
const STAGE_ORDER = ['wasm', 'face', 'hand', 'warmup'] as const;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  if (text) e.textContent = text;
  return e;
}

export class Screens {
  private readonly root: HTMLElement;
  private readonly landing: HTMLElement;
  private readonly startBtn: HTMLButtonElement;
  private readonly landingNote: HTMLElement;
  private readonly error: HTMLElement;
  private readonly errorText: HTMLElement;
  private readonly errorActions: HTMLElement;
  private readonly loading: HTMLElement;
  private readonly loadingBar: HTMLElement;
  private readonly loadingText: HTMLElement;
  private readonly toastEl: HTMLElement;
  private toastTimer = 0;

  constructor(root: HTMLElement) {
    this.root = root;

    this.landing = el('section', 'screen landing');
    this.landing.append(
      el('h1', 'landing-title', '모기 피하기 (못 함)'),
      el('p', 'landing-sub', '모기를 피해봐'),
    );
    this.startBtn = el('button', 'btn primary', '시작');
    this.startBtn.type = 'button';
    this.landingNote = el('p', 'landing-note', '영상은 서버로 전송되지 않아요');
    this.landing.append(this.startBtn, this.landingNote);

    this.error = el('section', 'screen error');
    this.errorText = el('p', 'screen-text');
    this.errorActions = el('div', 'screen-actions');
    this.error.append(this.errorText, this.errorActions);

    this.loading = el('section', 'screen loading');
    const bar = el('div', 'progress');
    this.loadingBar = el('div', 'progress-fill');
    bar.append(this.loadingBar);
    this.loadingText = el('p', 'screen-text', '불러오는 중...');
    this.loading.append(this.loadingText, bar);

    this.toastEl = el('div', 'toast');

    this.root.append(this.landing, this.error, this.loading, this.toastEl);
    this.hideAll();
  }

  private hideAll(): void {
    this.landing.hidden = true;
    this.error.hidden = true;
    this.loading.hidden = true;
  }

  /** S-1. unsupported가 있으면 시작 버튼 대신 안내 */
  showLanding(onStart: () => void, unsupported: string | null = null): void {
    this.hideAll();
    this.landing.hidden = false;
    this.startBtn.hidden = unsupported !== null;
    this.startBtn.disabled = false;
    this.startBtn.onclick = () => {
      this.startBtn.disabled = true;
      onStart();
    };
    if (unsupported) this.landingNote.textContent = unsupported;
  }

  /** S-2. 재시도는 같은 시작 핸들러를 다시 실행한다 */
  showError(kind: ErrorKind, onRetry: (() => void) | null, detail = ''): void {
    this.hideAll();
    this.error.hidden = false;
    this.errorText.textContent = ERROR_TEXT[kind] + (detail ? `\n\n${detail}` : '');
    this.errorActions.replaceChildren();
    if (onRetry) {
      const retry = el('button', 'btn primary', '다시 시도');
      retry.type = 'button';
      retry.onclick = onRetry;
      this.errorActions.append(retry);
    }
  }

  /** S-3. 4단계 진행률 */
  showLoading(): void {
    this.hideAll();
    this.loading.hidden = false;
    this.setProgress('wasm', 0);
  }

  setProgress(stage: keyof typeof STAGE_LABEL, ratio: number): void {
    const done = STAGE_ORDER.indexOf(stage) + ratio;
    this.loadingBar.style.width = `${Math.round((done / STAGE_ORDER.length) * 100)}%`;
    this.loadingText.textContent = `${STAGE_LABEL[stage]} 불러오는 중...`;
  }

  hideScreens(): void {
    this.hideAll();
  }

  toast(text: string, ms = 2500, action?: { label: string; onClick: () => void }): void {
    this.toastEl.replaceChildren(el('span', '', text));
    if (action) {
      const b = el('button', 'btn small', action.label);
      b.type = 'button';
      b.onclick = action.onClick;
      this.toastEl.append(b);
    }
    this.toastEl.classList.add('visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('visible'), ms);
  }
}
