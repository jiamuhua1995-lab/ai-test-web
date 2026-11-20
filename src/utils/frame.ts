import type { AlignMode, ImageAsset, PixelRect, ResultAsset } from '../types';

/**
 * 计算"原图区域"在某张图片中的像素矩形。
 *
 * - 原图自身：整张就是原图区域
 * - 扩图结果：优先用 manifest 里显式给的 frame；
 *   否则假设"原图按原始像素居中粘贴进更大画布"（多数扩图管线的行为），
 *   再乘以用户的占比修正系数做微调。
 */
export function originalRectIn(
  image: ImageAsset,
  original: ImageAsset,
  frame: ResultAsset['frame'],
  frameScale = 1,
): PixelRect {
  if (image.width <= 0 || image.height <= 0) {
    return { x: 0, y: 0, w: 1, h: 1 };
  }

  if (frame) {
    return {
      x: frame.x * image.width,
      y: frame.y * image.height,
      w: frame.w * image.width,
      h: frame.h * image.height,
    };
  }

  // 自动推算：原图像素尺寸居中，再按修正系数缩放，并夹在图片范围内
  const guessW = Math.min(image.width, original.width * frameScale || image.width);
  const guessH = Math.min(image.height, original.height * frameScale || image.height);

  return {
    x: (image.width - guessW) / 2,
    y: (image.height - guessH) / 2,
    w: guessW,
    h: guessH,
  };
}

export function wholeRect(image: ImageAsset): PixelRect {
  return { x: 0, y: 0, w: Math.max(1, image.width), h: Math.max(1, image.height) };
}

export function focusRect(
  image: ImageAsset,
  original: ImageAsset,
  frame: ResultAsset['frame'],
  align: AlignMode,
  frameScale: number,
): PixelRect {
  return align === 'frame'
    ? originalRectIn(image, original, frame, frameScale)
    : wholeRect(image);
}

export interface Viewport {
  width: number;
  height: number;
}

export interface Placement {
  left: number;
  top: number;
  width: number;
  height: number;
  /** 图片像素 → 屏幕像素的比例 */
  scale: number;
}

/**
 * 把 focus 矩形铺满视口（contain），再叠加共享的 zoom / pan。
 * 不同尺寸的图片只要 focus 矩形对应同一块内容，就会在屏幕上严格对齐。
 *
 * pan 以 zoom=1 时的屏幕像素计，内部乘以 zoom —— 这样缩放时画面中心的内容不会漂移。
 */
export function placeImage(
  image: ImageAsset,
  focus: PixelRect,
  vp: Viewport,
  zoom: number,
  pan: { x: number; y: number },
): Placement {
  const safeFocusW = Math.max(1, focus.w);
  const safeFocusH = Math.max(1, focus.h);
  const base = Math.min(vp.width / safeFocusW, vp.height / safeFocusH);
  const scale = base * zoom;

  const focusCx = focus.x + focus.w / 2;
  const focusCy = focus.y + focus.h / 2;

  return {
    left: vp.width / 2 + pan.x * zoom - focusCx * scale,
    top: vp.height / 2 + pan.y * zoom - focusCy * scale,
    width: Math.max(1, image.width) * scale,
    height: Math.max(1, image.height) * scale,
    scale,
  };
}

/** 扩图放大了多少（面积比），用于在标签上提示 */
export function expandRatio(result: ImageAsset, original: ImageAsset): number | null {
  if (!result.width || !original.width) return null;
  const a = result.width * result.height;
  const b = original.width * original.height;
  if (!b) return null;
  return a / b;
}
