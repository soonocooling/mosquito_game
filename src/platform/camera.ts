// src/platform/camera.ts
// F-01 웹캠 입력 (지금은 데스크톱 웹캠만 지원). 화면 표시는 GL 캔버스(render)가 하므로 <video>는 숨겨 둔다.

// 노트북에는 시선추적 소프트웨어 등이 설치한 "가상 카메라"가 진짜 웹캠과 함께 잡히는 경우가 있다.
// 실제 화면이 안 나오므로 자동 선택에서는 피해준다.
const VIRTUAL_CAMERA_HINT = /virtual|mirametrix|obs|snap camera|iriun|droidcam/i;

export type CameraError = 'denied' | 'notfound' | 'other';

export class Camera {
  readonly video: HTMLVideoElement;
  private stream: MediaStream | null = null;
  lastErrorMessage = '';

  constructor(video: HTMLVideoElement) {
    this.video = video;
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.autoplay = true;
  }

  get mediaStream(): MediaStream | null {
    return this.stream;
  }

  private constraints(deviceId?: string, withIdeal = true): MediaStreamConstraints {
    const size = withIdeal ? { width: { ideal: 1280 }, height: { ideal: 720 } } : {};
    const pick = deviceId ? { deviceId: { exact: deviceId } } : {};
    return { video: { ...size, ...pick }, audio: false };
  }

  /** 시작 버튼 핸들러 안에서 호출. 실패하면 오류 종류 */
  async start(deviceId?: string): Promise<CameraError | null> {
    try {
      this.stream = await this.open(deviceId);
    } catch (err) {
      const name = (err as DOMException)?.name;
      this.lastErrorMessage = String((err as Error)?.message ?? err);
      if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'notfound';
      return 'other';
    }
    await this.attach();
    if (!deviceId) await this.avoidVirtualCamera();
    return null;
  }

  private async open(deviceId?: string): Promise<MediaStream> {
    try {
      return await navigator.mediaDevices.getUserMedia(this.constraints(deviceId));
    } catch (err) {
      // 해상도 조건을 못 맞추는 기기: ideal 없이 한 번 더
      if ((err as DOMException)?.name === 'OverconstrainedError') {
        return navigator.mediaDevices.getUserMedia(this.constraints(deviceId, false));
      }
      throw err;
    }
  }

  private async attach(): Promise<void> {
    this.video.srcObject = this.stream;
    await this.video.play().catch(() => {
      /* 자동재생 차단 — 시작 버튼 제스처 안이면 보통 통과 */
    });
  }

  private async avoidVirtualCamera(): Promise<void> {
    const label = this.stream?.getVideoTracks()[0]?.label ?? '';
    if (!VIRTUAL_CAMERA_HINT.test(label)) return;
    const cameras = await this.listCameras();
    const current = this.activeDeviceId;
    const alt = cameras.find((d) => d.deviceId !== current && !VIRTUAL_CAMERA_HINT.test(d.label));
    if (alt) await this.switchDevice(alt.deviceId);
  }

  async listCameras(): Promise<MediaDeviceInfo[]> {
    try {
      return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    } catch {
      return [];
    }
  }

  async switchDevice(deviceId: string): Promise<boolean> {
    const old = this.stream;
    try {
      this.stream = await this.open(deviceId);
    } catch (err) {
      console.error('[camera] 전환 실패', err);
      return false;
    }
    old?.getTracks().forEach((t) => t.stop());
    await this.attach();
    return true;
  }

  get activeDeviceId(): string | undefined {
    return this.stream?.getVideoTracks()[0]?.getSettings().deviceId;
  }

  /** 탭 복귀 시: 트랙이 끝났으면 다시 열고, 아니면 재생을 이어간다 */
  async resume(): Promise<void> {
    const track = this.stream?.getVideoTracks()[0];
    if (!track || track.readyState === 'ended') {
      this.stream = await this.open(this.activeDeviceId).catch(() => null);
      await this.attach();
    } else {
      await this.video.play().catch(() => {});
    }
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
