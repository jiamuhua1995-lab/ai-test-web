import type { ImageAsset } from '../types';

const cache = new Map<string, { width: number; height: number }>();

/** 读取图片原始尺寸（带缓存），失败时返回 0×0 */
export async function loadImageMeta(src: string): Promise<ImageAsset> {
  const hit = cache.get(src);
  if (hit) return { src, ...hit };

  const size = await new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = src;
  });

  cache.set(src, size);
  return { src, ...size };
}

export async function loadImageMetas(srcList: string[]): Promise<ImageAsset[]> {
  return Promise.all(srcList.map(loadImageMeta));
}
