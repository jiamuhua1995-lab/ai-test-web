import type { CSSProperties } from 'react';
import s from './Compare.module.css';
import sc from './Score.module.css';
import { AlignedImage } from './AlignedImage';
import { ScoreStars } from './ScoreStars';
import { useElementSize } from '../hooks/useElementSize';
import type { CompareState } from '../hooks/useCompareState';
import type { ImageAsset } from '../types';
import type { Layer } from '../utils/layers';

interface CompareTileProps {
  layer: Layer;
  original: ImageAsset;
  caseId: string;
  store: CompareState;
}

export function CompareTile({ layer, original, caseId, store }: CompareTileProps) {
  const [vpRef, size] = useElementSize<HTMLDivElement>();
  const rating = store.ratings.ratings[caseId];
  const isBest = rating?.best === layer.id;

  // 格子画幅取原图比例，夹在 0.45~2.4 之间免得极端长图撑爆布局
  const raw = original.height ? original.width / original.height : 4 / 3;
  const aspect = Math.min(2.4, Math.max(0.45, raw)).toFixed(3);

  return (
    <div className={`${s.tile} ${isBest ? s.best : ''}`}>
      <div className={s.tileHead}>
        <span className={`${s.tileName} ${layer.isOriginal ? s.origin : ''}`} title={layer.note}>
          {layer.name}
        </span>
        <span className={s.tileDim}>
          {layer.asset.width}×{layer.asset.height}
        </span>
      </div>

      <div
        ref={vpRef}
        className={`${s.vp} ${s.tileVp} ${s[store.backdrop]}`}
        style={{ '--tile-aspect': aspect } as CSSProperties}
      >
        <AlignedImage
          layer={layer}
          original={original}
          viewport={size}
          store={store}
          showBadge={false}
        />
      </div>

      {store.showLabel && !layer.isOriginal && (
        <div className={s.tileFoot}>
          <ScoreStars
            small
            value={rating?.scores[layer.id]}
            onPick={(n) => store.ratings.setScore(caseId, layer.id, n)}
          />
          <button
            type="button"
            data-no-pan
            className={`${sc.bestBtn} ${isBest ? sc.on : ''}`}
            onClick={() => store.ratings.setBest(caseId, layer.id)}
          >
            {isBest ? '★ 最佳' : '设为最佳'}
          </button>
        </div>
      )}
    </div>
  );
}
