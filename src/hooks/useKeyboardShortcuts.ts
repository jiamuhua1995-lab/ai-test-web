import { useEffect } from 'react';
import type { CompareState } from './useCompareState';

interface Options {
  enabled: boolean;
}

/** 全局快捷键，详见帮助弹窗 */
export function useKeyboardShortcuts(store: CompareState, { enabled }: Options): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case 'ArrowLeft':
          store.stepCase(-1);
          break;
        case 'ArrowRight':
          store.stepCase(1);
          break;
        case '1':
        case '2':
        case '3':
        case '4':
          store.setCols(Number(e.key));
          break;
        case '`':
        case '0':
          store.resetView();
          break;
        case '=':
        case '+':
          store.zoomBy(1.25);
          break;
        case '-':
        case '_':
          store.zoomBy(1 / 1.25);
          break;
        case 'g':
        case 'G':
          store.setView('grid');
          break;
        case 's':
        case 'S':
          store.setView('slider');
          break;
        case 'x':
        case 'X':
          store.setView('flip');
          break;
        case 'a':
        case 'A':
          store.setAlign(store.align === 'whole' ? 'frame' : 'whole');
          break;
        case 'f':
        case 'F':
          store.setShowFrame(!store.showFrame);
          break;
        default:
          return;
      }
      e.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, store]);
}
