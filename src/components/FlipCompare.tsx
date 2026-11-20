import { useEffect, useRef, useState, type PointerEvent } from 'react';
import s from './Compare.module.css';
import { AlignedImage } from './AlignedImage';
import { GestureSurface } from './GestureSurface';
import { PairBar } from './PairBar';
import { useElementSize } from '../hooks/useElementSize';
import type { CompareState } from '../hooks/useCompareState';
import type { CaseItem } from '../types';
import { buildLayers, findLayer } from '../utils/layers';

interface FlipCompareProps {
  store: CompareState;
  item: CaseItem;
}

/**
 * 闪视对比：两张图完全重合，快速切换最容易看出细微差异。
 * 按住空格看 B，松手回 A；也可以点画面锁定在 B。
 */
export function FlipCompare({ store, item }: FlipCompareProps) {
  const [vpRef, size] = useElementSize<HTMLDivElement>();
  const [held, setHeld] = useState(false);
  const [pinned, setPinned] = useState(false);
  const downAt = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setHeld(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setHeld(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const layers = buildLayers(item, store.caseModels, true);
  const a = findLayer(layers, store.layerA);
  const b = findLayer(layers, store.layerB) ?? a;
  if (!a || !b) return null;

  const showB = held !== pinned; // 按住时取反，便于"锁定 B 再按空格看 A"
  const current = showB ? b : a;

  return (
    <>
      <PairBar
        layers={layers}
        labelA="A"
        labelB="B"
        valueA={a.id}
        valueB={b.id}
        onChangeA={store.setLayerA}
        onChangeB={store.setLayerB}
        hint={
          store.align === 'whole'
            ? '闪视建议把对齐方式切到「原图区域」（A 键），否则两图会跳动'
            : pinned
              ? '已锁定 B（点画面取消）'
              : '按住空格或点画面切到 B'
        }
      />
      <GestureSurface store={store}>
        <div
          ref={vpRef}
          className={`${s.vp} ${s.bigVp} ${s[store.backdrop]}`}
          onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
            downAt.current = { x: e.clientX, y: e.clientY };
          }}
          onClick={(e) => {
            // 拖动平移后不要误触发切换
            const d = downAt.current;
            const moved = d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4;
            if (!moved) setPinned((v) => !v);
          }}
        >
          <div className={s.layer} style={{ opacity: showB ? 0 : 1 }}>
            <AlignedImage layer={a} original={item.original} viewport={size} store={store} />
          </div>
          <div className={s.layer} style={{ opacity: showB ? 1 : 0 }}>
            <AlignedImage layer={b} original={item.original} viewport={size} store={store} />
          </div>
          <span className={`${s.cornerTag} ${s.tagLeft}`}>
            {showB ? 'B · ' : 'A · '}
            {current.name}
          </span>
        </div>
      </GestureSurface>
    </>
  );
}
