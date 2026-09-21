// src/ui/buzzAudio.ts
// F-11: 모기 윙윙 소리 (모기 수에 비례해 음량 증가), 음소거 버튼
// Web Audio 오실레이터로 합성 - 음원 파일 불필요

export class BuzzAudio {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private muted = false;

  /** 반드시 "시작" 버튼 클릭 핸들러 안에서 호출해야 함 (자동재생 제한 우회) */
  init() {
    if (this.ctx) return;
    // iOS 무음 모드 등에서 AudioContext 생성이 실패할 수 있으므로 방어
    try {
      this.ctx = new AudioContext();
    } catch {
      return;
    }
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = 0;
    this.gainNode.connect(this.ctx.destination);

    for (const freq of [180, 210, 240]) {
      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      osc.connect(this.gainNode);
      osc.start();
      this.oscillators.push(osc);
    }
  }

  /** 모기 수에 비례해 음량 조절 */
  setMosquitoCount(count: number) {
    if (!this.ctx || !this.gainNode || this.muted) return;
    const volume = Math.min(count * 0.02, 0.6);
    this.gainNode.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.1);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setTargetAtTime(
        this.muted ? 0 : this.gainNode.gain.value,
        this.ctx.currentTime,
        0.05
      );
    }
    return this.muted;
  }

  stop() {
    this.oscillators.forEach((o) => o.stop());
    this.oscillators = [];
    this.ctx?.close();
    this.ctx = null;
  }
}
