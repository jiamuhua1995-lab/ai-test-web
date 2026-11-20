import { useRef, type PointerEvent } from 'react';
import s from './Compare.module.css';
import { AlignedImage } from './AlignedImage';
import { GestureSurface } from './GestureSurface';
import { PairBar } from './PairBar';
import { useElementSize } from '../hooks/useElementSize';
import type { CompareState } from '../hooks/useCompareState';
import type { CaseItem } from '../types';
import { buildLayers, findLayer } from '../utils/layers';

interface SliderCompareProps {
  store: CompareState;
  item: CaseItem;
}

/** 左右拉幕对比：两张图在同一位置叠放，用竖线切开 */
export function SliderCompare({ store, item }: SliderCompareProps) {
  const [vpRef, size] = useElementSize<HTMLDivElement>();
  const dragging = useRef(false);

  const layers = buildLayers(item, store.caseModels, true);
  const a = findLayer(layers, store.layerA);
  const b = findLayer(layers, store.layerB) ?? a;
  const pos = store.sliderPos;

  const moveTo = (clientX: number) => {
    const el = vpRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = ((clientX - rect.left) / Math.max(1, rect.width)) * 100;
    store.setSliderPos(Math.min(100, Math.max(0, next)));
  };

  const onHandleDown = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    moveTo(e.clientX);
  };

  const onHandleMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) moveTo(e.clientX);
  };

  const onHandleUp = () => {
    dragging.current = false;
  };

  if (!a || !b) return null;

  return (
    <>
      <PairBar
        layers={layers}
        labelA="左"
        labelB="右"
        valueA={a.id}
        valueB={b.id}
        onChangeA={store.setLayerA}
        onChangeB={store.setLayerB}
        hint={
          store.align === 'whole'
            ? '两张图尺寸不同，建议把对齐方式切到「原图区域」（A 键）'
            : '拖中间竖线切换，空白处拖动平移，滚轮缩放'
        }
      />
      <GestureSurface store={store}>
        <div ref={vpRef} className={`${s.vp} ${s.bigVp} ${s[store.backdrop]}`}>
          <div className={s.layer}>
            <AlignedImage layer={a} original={item.original} viewport={size} store={store} />
          </div>
          <div className={s.layer} style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
            <AlignedImage layer={b} original={item.original} viewport={size} store={store} />
          </div>

          <span className={`${s.cornerTag} ${s.tagLeft}`}>{a.name}</span>
          <span className={`${s.cornerTag} ${s.tagRight}`}>{b.name}</span>

          <div
            data-no-pan
            className={s.handle}
            style={{ left: `${pos}%` }}
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleUp}
          >
            <span className={s.handleKnob}>⇔</span>
          </div>
        </div>
      </GestureSurface>
    </>
  );
}
