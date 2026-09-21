import type { Mosquito } from "./mosquito";

const spriteImage = new Image();
let sprite: HTMLCanvasElement | null = null;

/**
 * JPG의 바깥 테두리와 연결된 흰색만 투명하게 만듭니다.
 * 눈과 날개 안쪽처럼 선으로 둘러싸인 흰색은 그대로 보존됩니다.
 */
function makeTransparentCutout(image: HTMLImageElement): HTMLCanvasElement {
  const source = document.createElement("canvas");
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;
  const sourceCtx = source.getContext("2d", { willReadFrequently: true })!;
  sourceCtx.drawImage(image, 0, 0);

  const pixels = sourceCtx.getImageData(0, 0, source.width, source.height);
  const { data } = pixels;
  const width = source.width;
  const height = source.height;
  const outside = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const isBackground = (index: number) => {
    const offset = index * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    return min >= 238 && max - min <= 18;
  };

  const enqueue = (index: number) => {
    if (outside[index] || !isBackground(index)) return;
    outside[index] = 1;
    queue[tail++] = index;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let index = 0; index < outside.length; index += 1) {
    if (outside[index]) {
      data[index * 4 + 3] = 0;
      continue;
    }
    const x = index % width;
    const y = Math.floor(index / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  sourceCtx.putImageData(pixels, 0, 0);

  const padding = 4;
  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;
  const cutout = document.createElement("canvas");
  cutout.width = cropWidth + padding * 2;
  cutout.height = cropHeight + padding * 2;
  cutout.getContext("2d")!.drawImage(
    source,
    minX,
    minY,
    cropWidth,
    cropHeight,
    padding,
    padding,
    cropWidth,
    cropHeight,
  );
  return cutout;
}

spriteImage.addEventListener("load", () => {
  sprite = makeTransparentCutout(spriteImage);
});
spriteImage.src = "/mosquito.jpg";

export function drawMosquitoSprite(
  ctx: CanvasRenderingContext2D,
  mosquito: Mosquito,
  size: number,
) {
  if (!sprite) {
    // 이미지가 준비되는 첫 프레임에만 기존 표시를 사용합니다.
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.ellipse(mosquito.position.x, mosquito.position.y, size, size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const drawWidth = size * 4;
  const drawHeight = drawWidth * (sprite.height / sprite.width);

  ctx.save();
  ctx.translate(mosquito.position.x, mosquito.position.y);
  // 원본은 머리가 왼쪽을 향하므로, 오른쪽 이동 시에만 수평 반전합니다.
  ctx.scale(mosquito.facingX === 1 ? -1 : 1, 1);
  ctx.drawImage(sprite, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
}
