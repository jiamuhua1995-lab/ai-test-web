import s from './Compare.module.css';
import ui from '../styles/ui.module.css';
import { CompareTile } from './CompareTile';
import { GestureSurface } from './GestureSurface';
import type { CompareState } from '../hooks/useCompareState';
import type { CaseItem } from '../types';
import { buildLayers } from '../utils/layers';

interface GridCompareProps {
  store: CompareState;
  item: CaseItem;
}

export function GridCompare({ store, item }: GridCompareProps) {
  const layers = buildLayers(item, store.visibleModels, store.includeOriginal);

  const gridTemplateColumns =
    store.cols > 0
      ? `repeat(${store.cols}, minmax(0, 1fr))`
      : `repeat(auto-fit, minmax(${layers.length > 2 ? 280 : 420}px, 1fr))`;

  if (!layers.length) {
    return (
      <div className={s.empty}>
        <p className={ui.muted}>左栏把模型勾上，或打开「画面中包含原图」</p>
      </div>
    );
  }

  return (
    <GestureSurface store={store}>
      <div className={s.grid} style={{ gridTemplateColumns }}>
        {layers.map((layer) => (
          <CompareTile
            key={layer.id}
            layer={layer}
            original={item.original}
            caseId={item.id}
            store={store}
          />
        ))}
      </div>
    </GestureSurface>
  );
}
