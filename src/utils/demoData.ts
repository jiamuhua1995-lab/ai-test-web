import type { CaseItem, Dataset, FrameRect, ModelInfo, ResultAsset } from '../types';

/**
 * 示例数据：全部用 canvas 现场画出来，不依赖任何外部图片。
 * 思路是先画一张"全景"，原图取其中心裁切，于是：
 *   reference 模型 = 全景（等于完美扩图）
 *   其余模型 = 原图 + 不同的劣质填充（拉伸 / 镜像 / 模糊 / 平铺）
 * 这样四种典型扩图瑕疵在界面上一眼可辨。
 */

const DEMO_MODELS: ModelInfo[] = [
  { id: 'reference', name: '参考 · 完美延展', note: '基准，用来校验对齐是否正确' },
  { id: 'edge-stretch', name: '模型 A · 边缘拉伸', note: '典型拉丝瑕疵' },
  { id: 'mirror-pad', name: '模型 B · 镜像填充', note: '对称感明显' },
  { id: 'blur-noise', name: '模型 C · 模糊噪点', note: '细节丢失' },
  { id: 'tile-repeat', name: '模型 D · 纹理重复', note: '元素复制' },
];

type FillKind = 'edge-stretch' | 'mirror-pad' | 'blur-noise' | 'tile-repeat';

function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function ctxOf(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前环境不支持 canvas 2d');
  return ctx;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 画一张完整的"全景"场景 */
function drawWorld(canvas: HTMLCanvasElement, seed: number, palette: number): void {
  const ctx = ctxOf(canvas);
  const { width: w, height: h } = canvas;
  const rnd = mulberry32(seed);

  const skies = [
    ['#1b2a4a', '#4a6fa5', '#d8a07a'],
    ['#2b1b3a', '#7a4a86', '#e8b4a0'],
    ['#0f2a2a', '#2f7a6a', '#cfe8c0'],
  ];
  const sky = skies[palette % skies.length];

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, sky[0]);
  g.addColorStop(0.6, sky[1]);
  g.addColorStop(1, sky[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // 太阳
  const sunX = w * 0.68;
  const sunY = h * 0.3;
  const sunR = Math.min(w, h) * 0.08;
  const sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 3);
  sg.addColorStop(0, 'rgba(255,240,200,0.95)');
  sg.addColorStop(0.3, 'rgba(255,210,150,0.5)');
  sg.addColorStop(1, 'rgba(255,200,140,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(sunX - sunR * 3, sunY - sunR * 3, sunR * 6, sunR * 6);
  ctx.fillStyle = 'rgba(255,245,220,0.95)';
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  // 云
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (let i = 0; i < 9; i += 1) {
    const cx = rnd() * w;
    const cy = h * (0.08 + rnd() * 0.3);
    const cw = w * (0.08 + rnd() * 0.16);
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw, cw * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 远山（两层）
  const ridge = (baseY: number, amp: number, color: string, step: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += step) {
      const y =
        baseY -
        Math.sin((x / w) * Math.PI * 3 + seed) * amp -
        Math.sin((x / w) * Math.PI * 7 + seed * 2) * amp * 0.4;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  };
  ridge(h * 0.68, h * 0.07, 'rgba(30,45,70,0.75)', 6);
  ridge(h * 0.78, h * 0.05, 'rgba(18,28,46,0.9)', 6);

  // 地面
  const gg = ctx.createLinearGradient(0, h * 0.78, 0, h);
  gg.addColorStop(0, '#16202f');
  gg.addColorStop(1, '#0b1119');
  ctx.fillStyle = gg;
  ctx.fillRect(0, h * 0.78, w, h * 0.22);

  // 地面格线，便于判断扩图区的透视是否接得上
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 24; i += 1) {
    const x = (i / 24) * w;
    ctx.beginPath();
    ctx.moveTo(x, h * 0.78);
    ctx.lineTo(w * 0.5 + (x - w * 0.5) * 2.2, h);
    ctx.stroke();
  }
  for (let i = 1; i <= 5; i += 1) {
    const y = h * 0.78 + (h * 0.22 * i ** 1.7) / 5 ** 1.7;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // 树，位置固定，方便观察"元素被复制"这类瑕疵
  const trees = 14;
  for (let i = 0; i < trees; i += 1) {
    const x = ((i + 0.5) / trees) * w + (rnd() - 0.5) * (w / trees) * 0.6;
    const scale = 0.6 + rnd() * 0.8;
    const th = h * 0.13 * scale;
    ctx.fillStyle = 'rgba(10,16,24,0.95)';
    ctx.fillRect(x - 2 * scale, h * 0.78 - th, 4 * scale, th);
    ctx.beginPath();
    ctx.moveTo(x, h * 0.78 - th - th * 0.55);
    ctx.lineTo(x - th * 0.3, h * 0.78 - th * 0.35);
    ctx.lineTo(x + th * 0.3, h * 0.78 - th * 0.35);
    ctx.closePath();
    ctx.fill();
  }
}

function cropCanvas(
  src: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
): HTMLCanvasElement {
  const out = createCanvas(w, h);
  ctxOf(out).drawImage(src, x, y, w, h, 0, 0, w, h);
  return out;
}

function addNoise(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number): void {
  const n = createCanvas(64, 64);
  const nctx = ctxOf(n);
  const data = nctx.createImageData(64, 64);
  const rnd = mulberry32(seed);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 110 + rnd() * 90;
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 46;
  }
  nctx.putImageData(data, 0, 0);
  const pattern = ctx.createPattern(n, 'repeat');
  if (!pattern) return;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
}

/** 先铺一层"假的"扩图内容，再把原图原样贴回中间 */
function synthResult(
  kind: FillKind,
  original: HTMLCanvasElement,
  outW: number,
  outH: number,
  ox: number,
  oy: number,
  seed: number,
): HTMLCanvasElement {
  const out = createCanvas(outW, outH);
  const ctx = ctxOf(out);
  const ow = original.width;
  const oh = original.height;

  if (kind === 'edge-stretch') {
    ctx.drawImage(original, 0, 0, ow, oh, 0, 0, outW, outH);
    ctx.filter = 'blur(1px) saturate(0.9)';
    ctx.drawImage(out, 0, 0);
    ctx.filter = 'none';
  } else if (kind === 'mirror-pad') {
    for (let gx = -1; gx <= 1; gx += 1) {
      for (let gy = -1; gy <= 1; gy += 1) {
        ctx.save();
        ctx.translate(ox + gx * ow, oy + gy * oh);
        if (gx !== 0) {
          ctx.translate(ow, 0);
          ctx.scale(-1, 1);
        }
        if (gy !== 0) {
          ctx.translate(0, oh);
          ctx.scale(1, -1);
        }
        ctx.drawImage(original, 0, 0);
        ctx.restore();
      }
    }
  } else if (kind === 'blur-noise') {
    ctx.filter = 'blur(26px) saturate(0.75)';
    ctx.drawImage(original, 0, 0, ow, oh, -outW * 0.1, -outH * 0.1, outW * 1.2, outH * 1.2);
    ctx.filter = 'none';
    addNoise(ctx, outW, outH, seed);
  } else {
    const tw = Math.round(ow / 3);
    const th = Math.round(oh / 3);
    for (let x = 0; x < outW; x += tw) {
      for (let y = 0; y < outH; y += th) {
        ctx.drawImage(original, 0, 0, ow, oh, x, y, tw, th);
      }
    }
  }

  ctx.drawImage(original, ox, oy);
  return out;
}

interface DemoSpec {
  id: string;
  name: string;
  tags: string[];
  worldW: number;
  worldH: number;
  origW: number;
  origH: number;
  seed: number;
  palette: number;
}

const SPECS: DemoSpec[] = [
  { id: 'demo-01', name: '左右扩 · 日落全景', tags: ['左右扩', '2:1'], worldW: 1024, worldH: 512, origW: 512, origH: 512, seed: 7, palette: 0 },
  { id: 'demo-02', name: '上下扩 · 竖构图', tags: ['上下扩', '1:2'], worldW: 512, worldH: 1024, origW: 512, origH: 512, seed: 21, palette: 1 },
  { id: 'demo-03', name: '四周扩 · 等比放大', tags: ['四周扩', '1.75x'], worldW: 896, worldH: 896, origW: 512, origH: 512, seed: 33, palette: 2 },
];

function toAsset(canvas: HTMLCanvasElement): { src: string; width: number; height: number } {
  return { src: canvas.toDataURL('image/jpeg', 0.86), width: canvas.width, height: canvas.height };
}

export function buildDemoDataset(): Dataset {
  const cases: CaseItem[] = SPECS.map((spec) => {
    const world = createCanvas(spec.worldW, spec.worldH);
    drawWorld(world, spec.seed, spec.palette);

    const ox = Math.round((spec.worldW - spec.origW) / 2);
    const oy = Math.round((spec.worldH - spec.origH) / 2);
    const originalCanvas = cropCanvas(world, ox, oy, spec.origW, spec.origH);

    const frame: FrameRect = {
      x: ox / spec.worldW,
      y: oy / spec.worldH,
      w: spec.origW / spec.worldW,
      h: spec.origH / spec.worldH,
    };

    const results: Record<string, ResultAsset> = {};
    for (const model of DEMO_MODELS) {
      const canvas =
        model.id === 'reference'
          ? world
          : synthResult(
              model.id as FillKind,
              originalCanvas,
              spec.worldW,
              spec.worldH,
              ox,
              oy,
              spec.seed,
            );
      results[model.id] = { ...toAsset(canvas), modelId: model.id, frame };
    }

    return {
      id: spec.id,
      name: spec.name,
      tags: spec.tags,
      original: toAsset(originalCanvas),
      results,
    };
  });

  return { models: DEMO_MODELS, cases, source: 'demo' };
}
