// src/render/gl.ts
// F-07 WebGL2 렌더러: 거울 비디오 + 부기. F-12 capture()도 여기서 제공한다.

import { BiteStore } from './bites';
import { MAX_BITES_UNIFORM } from './config';
import { FRAG_SRC, VERT_SRC } from './shaders';
import type { Bite, BiteEvent, FaceFrame, Quality, Renderer } from './types';

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('createShader 실패');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`셰이더 컴파일 실패: ${log}`);
  }
  return sh;
}

function link(gl: WebGL2RenderingContext): WebGLProgram {
  const prog = gl.createProgram();
  if (!prog) throw new Error('createProgram 실패');
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT_SRC));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`셰이더 링크 실패: ${gl.getProgramInfoLog(prog)}`);
  }
  return prog;
}

function uniform(gl: WebGL2RenderingContext, prog: WebGLProgram, name: string): WebGLUniformLocation {
  const loc = gl.getUniformLocation(prog, name);
  if (!loc) throw new Error(`uniform 없음: ${name}`);
  return loc;
}

/**
 * @param canvas GL 캔버스 (CSS 크기·위치는 호출 쪽에서 지정: fixed, 100vw × 100dvh)
 * @param video  카메라 또는 리플레이 <video>. display:none이면 프레임이 갱신되지 않는다
 */
export function createRenderer(canvas: HTMLCanvasElement, video: HTMLVideoElement): Renderer {
  const ctx = canvas.getContext('webgl2', {
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    antialias: false,
    depth: false,
    stencil: false,
  });
  if (!ctx) throw new Error('WebGL2를 지원하지 않는 브라우저');
  const gl: WebGL2RenderingContext = ctx;

  // GL 자원. 컨텍스트 손실(iOS 백그라운드 전환 등) 후 복구되면 다시 만든다.
  // 부기 저장소는 JS 메모리에 있으므로 손실과 무관하게 유지된다.
  interface GLResources {
    prog: WebGLProgram;
    uVideo: WebGLUniformLocation;
    uBites: WebGLUniformLocation;
    uCount: WebGLUniformLocation;
    uAspect: WebGLUniformLocation;
    uCrop: WebGLUniformLocation;
    vao: WebGLVertexArrayObject; // 속성은 없지만 일부 드라이버가 VAO 바인딩을 요구한다
    tex: WebGLTexture;
  }

  function createResources(): GLResources {
    const prog = link(gl);
    const vao = gl.createVertexArray();
    const tex = gl.createTexture();
    if (!vao || !tex) throw new Error('GL 자원 생성 실패');
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // UNPACK_FLIP_Y_WEBGL은 기본값(false) 유지 — 부록 B
    return {
      prog,
      uVideo: uniform(gl, prog, 'uVideo'),
      uBites: uniform(gl, prog, 'uBites'),
      uCount: uniform(gl, prog, 'uCount'),
      uAspect: uniform(gl, prog, 'uAspect'),
      uCrop: uniform(gl, prog, 'uCrop'),
      vao,
      tex,
    };
  }

  let res: GLResources | null = createResources();

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); // 이걸 해야 restored 이벤트가 온다
    res = null;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    try {
      res = createResources();
    } catch (err) {
      console.error('[render] GL 컨텍스트 복구 실패', err);
    }
  });

  const store = new BiteStore();
  const biteData = new Float32Array(MAX_BITES_UNIFORM * 4);

  // resize 인자를 기억해 두었다가 glScale이 바뀌면 다시 계산한다
  let W = 0;
  let H = 0;
  let vw = 0;
  let vh = 0;
  let dpr = 1;
  let glScale = 1;
  let cropX = 1;
  let cropY = 1;

  function applySize(): void {
    if (W <= 0 || H <= 0) return;
    let pxPerCss = dpr;
    if (vw > 0 && vh > 0) {
      const s = Math.max(W / vw, H / vh); // cover 배율 (mapper와 동일)
      cropX = W / (vw * s);
      cropY = H / (vh * s);
      pxPerCss = Math.min(dpr, 1 / s); // 결정 9: 카메라 해상도 이하
    }
    const cw = Math.max(1, Math.round(W * pxPerCss * glScale));
    const ch = Math.max(1, Math.round(H * pxPerCss * glScale));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
  }

  const renderer: Renderer = {
    resize(viewport, videoSize, devicePixelRatio) {
      W = viewport.w;
      H = viewport.h;
      vw = videoSize.w;
      vh = videoSize.h;
      dpr = devicePixelRatio;
      applySize();
    },

    draw(face: FaceFrame, events: BiteEvent[]) {
      const now = performance.now();
      store.ingest(events, face, now);
      store.animate(now);

      // 비디오 프레임이 아직 없으면 그리지 않는다 (HAVE_CURRENT_DATA = 2)
      if (!res || video.readyState < 2 || W <= 0 || H <= 0 || vw <= 0 || vh <= 0) return;

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(res.prog);
      gl.bindVertexArray(res.vao);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, res.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      gl.uniform1i(res.uVideo, 0);

      const n = face.landmarks.length > 0 ? store.writeUniforms(face, W, H, biteData) : 0;
      gl.uniform4fv(res.uBites, biteData);
      gl.uniform1i(res.uCount, n);
      gl.uniform1f(res.uAspect, W / H);
      gl.uniform2f(res.uCrop, cropX, cropY);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },

    capture(overlay: HTMLCanvasElement) {
      // preserveDrawingBuffer=false라서 draw 직후 같은 프레임 안에서 호출해야 한다
      const out = document.createElement('canvas');
      out.width = overlay.width || canvas.width;
      out.height = overlay.height || canvas.height;
      const c2d = out.getContext('2d');
      if (!c2d) throw new Error('2D 컨텍스트 생성 실패');
      c2d.drawImage(canvas, 0, 0, out.width, out.height);
      c2d.drawImage(overlay, 0, 0, out.width, out.height);
      return out;
    },

    reset() {
      store.reset();
    },

    setQuality(q: Quality) {
      store.setMaxBites(Math.min(q.maxBites, MAX_BITES_UNIFORM));
      if (q.glScale !== glScale) {
        glScale = q.glScale;
        applySize();
      }
    },

    get bites(): ReadonlyArray<Bite> {
      return store.bites;
    },
  };

  return renderer;
}
