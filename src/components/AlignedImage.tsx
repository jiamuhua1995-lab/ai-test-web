import s from './Compare.module.css';
import type { Size } from '../hooks/useElementSize';
import type { CompareState } from '../hooks/useCompareState';
import type { ImageAsset } from '../types';
import { expandRatio, focusRect, originalRectIn, placeImage } from '../utils/frame';
import type { Layer } from '../utils/layers';

interface AlignedImageProps {
  layer: Layer;
  original: ImageAsset;
  viewport: Size;
  store: CompareState;
  /** 右下角是否显示尺寸/倍数角标 */
  showBadge?: boolean;
}

/**
 * 按共享的 zoom/pan 摆放一张图片。
 * 对齐模式为"原图区域"时，不同尺寸的结果图会把原图那块内容对到屏幕同一位置，
 * 于是扩图部分之外的像素差异可以直接叠看。
 */
export function AlignedImage({
  layer,
  original,
  viewport,
  store,
  showBadge = true,
}: AlignedImageProps) {
  if (viewport.width < 2 || viewport.height < 2 || !layer.asset.width) return null;

  const { align, frameScale, zoom, pan, showFrame } = store;
  const focus = focusRect(layer.asset, original, layer.frame, align, frameScale);
  const place = placeImage(layer.asset, focus, viewport, zoom, pan);
  const rect = originalRectIn(layer.asset, original, layer.frame, frameScale);
  const ratio = expandRatio(layer.asset, original);

  return (
    <>
      <img
        className={s.img}
        src={layer.asset.src}
        alt={layer.name}
        draggable={false}
        style={{
          left: `${place.left}px`,
          top: `${place.top}px`,
          width: `${place.width}px`,
          height: `${place.height}px`,
        }}
      />

      {showFrame && !layer.isOriginal && (
        <div
          className={s.frameBox}
          style={{
            left: `${place.left + rect.x * place.scale}px`,
            top: `${place.top + rect.y * place.scale}px`,
            width: `${rect.w * place.scale}px`,
            height: `${rect.h * place.scale}px`,
          }}
        >
          <span className={s.frameTag}>原图</span>
        </div>
      )}

      {showBadge && (
        <span className={s.badge}>
          {layer.asset.width}×{layer.asset.height}
          {!layer.isOriginal && ratio ? ` · ${ratio.toFixed(2)}x` : ''}
        </span>
      )}
    </>
  );
}
