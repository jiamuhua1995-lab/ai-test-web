import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import s from './Compare.module.css';
import type { CompareState } from '../hooks/useCompareState';

interface GestureSurfaceProps {
  store: CompareState;
  children: ReactNode;
  className?: string;
}

/**
 * 滚轮缩放 + 拖拽平移，变换量写回 store，所有图片共享同一套 zoom/pan。
 * 带 data-no-pan 的子元素（按钮、滑块手柄等）不触发平移。
 */
export function GestureSurface({ store, children, className }: GestureSurfaceProps) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const { zoomBy, panBy, zoom } = store;

  // wheel 必须用原生监听，React 的 onWheel 是 passive，拦不住页面滚动
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(Math.exp(-e.deltaY / 400));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-no-pan]')) return;
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    panBy((e.clientX - d.x) / zoom, (e.clientY - d.y) / zoom);
    drag.current = { ...d, x: e.clientX, y: e.clientY };
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
  };

  return (
    <div
      ref={ref}
      className={`${s.surface} ${dragging ? s.dragging : ''} ${className ?? ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {children}
    </div>
  );
}
