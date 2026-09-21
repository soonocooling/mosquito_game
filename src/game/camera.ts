// F-01 웹캠 입력과 상반신 화면 구성 (세로 모바일 우선)
import type { Vec2 } from "./types";

const CLOSE_RATIO = 0.25; // 얼굴 폭이 화면 폭의 25% 미만 → "좀 더 가까이"
const FAR_RATIO = 0.6; // 얼굴 폭이 화면 폭의 60% 초과 → "폰을 조금 멀리"

// 노트북에는 시선추적 소프트웨어 등이 설치한 "가상 카메라"가 진짜 웹캠과 함께 잡히는 경우가 있다.
// 실제 화면이 안 나오므로 자동 선택에서는 피해준다.
const VIRTUAL_CAMERA_HINT = /virtual|mirametrix|obs|snap camera|iriun|droidcam/i;

export type DistanceHint = "closer" | "farther" | null;

export interface CameraCallbacks {
  onPermissionDenied?: () => void;
  onNoCamera?: () => void;
  onOrientationBlocked?: (blocked: boolean) => void;
  onDistanceHint?: (hint: DistanceHint) => void;
}

interface ScreenMapping {
  videoWidthPx: number;
  videoHeightPx: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export class Camera {
  readonly video: HTMLVideoElement;
  private callbacks: CameraCallbacks;
  private stream: MediaStream | null = null;
  private wakeLock: { release: () => Promise<void> } | null = null;
  private orientationQuery: MediaQueryList | null = null;
  // 회전 감지(가로로 돌리면 게임 정지)는 실제로 손으로 돌릴 수 있는 기기에서만 의미가 있다.
  // 노트북·데스크톱은 원래부터 가로라서 이 기능을 적용하면 안 된다 [결정].
  private readonly isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  private orientationHandler = () => {
    const blocked = this.isMobile && (this.orientationQuery?.matches ?? false);
    this.callbacks.onOrientationBlocked?.(blocked);
  };
  private visibilityHandler = () => {
    void this.handleVisibilityChange();
  };

  constructor(video: HTMLVideoElement, callbacks: CameraCallbacks = {}) {
    this.video = video;
    this.callbacks = callbacks;
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.autoplay = true;
  }

  private buildConstraints(deviceId?: string): MediaStreamConstraints {
    const base = this.isMobile
      ? { width: { ideal: 720 }, height: { ideal: 1280 }, aspectRatio: { ideal: 9 / 16 } }
      : { width: { ideal: 1280 }, height: { ideal: 720 } };

    if (deviceId) {
      return { video: { ...base, deviceId: { exact: deviceId } } };
    }
    return { video: { ...base, facingMode: "user" } };
  }

  async start(deviceId?: string): Promise<boolean> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia(this.buildConstraints(deviceId));
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        this.callbacks.onNoCamera?.();
      } else {
        this.callbacks.onPermissionDenied?.();
      }
      return false;
    }

    await this.attachStream();

    // 가상 카메라(시선추적 SW 등)가 자동으로 골라졌으면, 다른 진짜 카메라가 있는지 확인해서 바꿔치기한다.
    if (!deviceId) {
      await this.avoidVirtualCameraIfPossible();
    }

    if (!this.orientationQuery) {
      this.orientationQuery = window.matchMedia("(orientation: landscape)");
      this.orientationQuery.addEventListener("change", this.orientationHandler);
      document.addEventListener("visibilitychange", this.visibilityHandler);
    }
    this.orientationHandler();

    await this.requestWakeLock();
    return true;
  }

  private async attachStream() {
    this.video.srcObject = this.stream;
    await this.video.play().catch(() => {
      /* 자동재생 차단 시 무시 — 사용자 제스처(시작 버튼)로 이미 호출되었으므로 보통 통과 */
    });
  }

  private async avoidVirtualCameraIfPossible() {
    const currentLabel = this.stream?.getVideoTracks()[0]?.label ?? "";
    if (!VIRTUAL_CAMERA_HINT.test(currentLabel)) return;

    const cameras = await this.listCameras();
    const currentId = this.activeDeviceId;
    const alternative = cameras.find(
      (d) => d.deviceId !== currentId && !VIRTUAL_CAMERA_HINT.test(d.label),
    );
    if (alternative) {
      await this.switchDevice(alternative.deviceId);
    }
  }

  // 연결된 모든 카메라 장치 목록 (라벨은 권한을 이미 얻은 뒤에만 보임)
  async listCameras(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === "videoinput");
    } catch {
      return [];
    }
  }

  // 사용자가 직접(또는 자동으로) 다른 카메라 장치로 바꿀 때 사용
  async switchDevice(deviceId: string): Promise<boolean> {
    const oldStream = this.stream;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia(this.buildConstraints(deviceId));
    } catch (err) {
      console.error("[Camera] 카메라 전환 실패:", err);
      return false;
    }
    oldStream?.getTracks().forEach((t) => t.stop());
    await this.attachStream();
    return true;
  }

  get activeDeviceId(): string | undefined {
    return this.stream?.getVideoTracks()[0]?.getSettings().deviceId;
  }

  get activeDeviceLabel(): string {
    return this.stream?.getVideoTracks()[0]?.label ?? "";
  }

  private async requestWakeLock() {
    try {
      const nav = navigator as unknown as { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } };
      if (nav.wakeLock) {
        this.wakeLock = await nav.wakeLock.request("screen");
      }
    } catch {
      // 미지원 기기·거부된 경우 조용히 무시 [명시된 비기능 요구사항]
    }
  }

  private async handleVisibilityChange() {
    if (document.hidden) {
      this.video.pause();
      return;
    }
    const track = this.stream?.getVideoTracks()[0];
    if (!track || track.readyState === "ended") {
      await this.start(this.activeDeviceId);
    } else {
      await this.video.play().catch(() => {});
      await this.requestWakeLock();
    }
  }

  // 화면 폭 대비 얼굴 폭 비율로 거리 안내 [결정]
  checkDistanceHint(faceWidthScreenPx: number, screenWidthPx: number) {
    if (screenWidthPx <= 0) return;
    const ratio = faceWidthScreenPx / screenWidthPx;
    if (ratio < CLOSE_RATIO) {
      this.callbacks.onDistanceHint?.("closer");
    } else if (ratio > FAR_RATIO) {
      this.callbacks.onDistanceHint?.("farther");
    } else {
      this.callbacks.onDistanceHint?.(null);
    }
  }

  // object-fit: cover 기준으로 비디오 픽셀 좌표계를 화면 좌표계에 매핑하기 위한 스케일/오프셋 계산
  private getMapping(screenW: number, screenH: number): ScreenMapping {
    const vw = this.video.videoWidth || screenW;
    const vh = this.video.videoHeight || screenH;
    const videoAspect = vw / vh;
    const screenAspect = screenW / screenH;

    let scale: number;
    let offsetX = 0;
    let offsetY = 0;
    if (videoAspect > screenAspect) {
      scale = screenH / vh;
      offsetX = (vw * scale - screenW) / 2;
    } else {
      scale = screenW / vw;
      offsetY = (vh * scale - screenH) / 2;
    }
    return { videoWidthPx: vw, videoHeightPx: vh, scale, offsetX, offsetY };
  }

  // 비디오-픽셀 좌표(이미 좌우 반전 보정됨) → 실제 화면(canvas) 좌표
  mapPoint(videoPx: Vec2, screenW: number, screenH: number): Vec2 {
    const { scale, offsetX, offsetY } = this.getMapping(screenW, screenH);
    return { x: videoPx.x * scale - offsetX, y: videoPx.y * scale - offsetY };
  }

  // 길이·속도처럼 오프셋이 필요 없는 값(스칼라 배율만 적용)
  mapLength(videoPxLength: number, screenW: number, screenH: number): number {
    const { scale } = this.getMapping(screenW, screenH);
    return videoPxLength * scale;
  }

  get videoWidthPx() {
    return this.video.videoWidth;
  }

  get videoHeightPx() {
    return this.video.videoHeight;
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    if (this.orientationQuery) {
      this.orientationQuery.removeEventListener("change", this.orientationHandler);
      this.orientationQuery = null;
    }
    document.removeEventListener("visibilitychange", this.visibilityHandler);
    void this.wakeLock?.release().catch(() => {});
    this.wakeLock = null;
  }
}
