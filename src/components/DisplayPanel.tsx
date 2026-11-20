import s from './Sidebar.module.css';
import ui from '../styles/ui.module.css';
import type { CompareState } from '../hooks/useCompareState';
import type { AlignMode, BackdropMode } from '../types';

const ALIGNS: { id: AlignMode; label: string; tip: string }[] = [
  { id: 'whole', label: '整图', tip: '每张图完整铺满格子' },
  { id: 'frame', label: '原图区域', tip: '按原图在扩图结果中的位置对齐，细节逐像素可比' },
];

const COLS = [0, 1, 2, 3, 4];

const BACKDROPS: { id: BackdropMode; label: string }[] = [
  { id: 'checker', label: '棋盘' },
  { id: 'dark', label: '深色' },
  { id: 'light', label: '浅色' },
];

interface DisplayPanelProps {
  store: CompareState;
}

export function DisplayPanel({ store }: DisplayPanelProps) {
  return (
    <section className={ui.panel}>
      <h3 className={ui.panelTitle}>显示</h3>

      <div className={ui.field}>
        <div className={ui.fieldLabel}>
          <span>对齐方式</span>
          <span className={ui.value}>A 键切换</span>
        </div>
        <div className={ui.seg}>
          {ALIGNS.map((a) => (
            <button
              key={a.id}
              type="button"
              title={a.tip}
              className={store.align === a.id ? ui.on : ''}
              onClick={() => store.setAlign(a.id)}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {store.view === 'grid' && (
        <div className={ui.field}>
          <div className={ui.fieldLabel}>
            <span>列数</span>
            <span className={ui.value}>1–4 键</span>
          </div>
          <div className={ui.seg}>
            {COLS.map((n) => (
              <button
                key={n}
                type="button"
                className={store.cols === n ? ui.on : ''}
                onClick={() => store.setCols(n)}
              >
                {n === 0 ? '自动' : n}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className={ui.check}>
        <input
          type="checkbox"
          checked={store.showFrame}
          onChange={(e) => store.setShowFrame(e.target.checked)}
        />
        标出原图边界
      </label>
      <label className={ui.check}>
        <input
          type="checkbox"
          checked={store.showLabel}
          onChange={(e) => store.setShowLabel(e.target.checked)}
        />
        显示标签
      </label>
      <label className={ui.check}>
        <input
          type="checkbox"
          checked={store.includeOriginal}
          onChange={(e) => store.setIncludeOriginal(e.target.checked)}
        />
        画面中包含原图
      </label>

      <div className={ui.field} style={{ marginTop: 10 }}>
        <div className={ui.fieldLabel}>
          <span>原图占比修正</span>
          <span className={ui.value}>{Math.round(store.frameScale * 100)}%</span>
        </div>
        <input
          type="range"
          min={40}
          max={160}
          step={1}
          value={Math.round(store.frameScale * 100)}
          onChange={(e) => store.setFrameScale(Number(e.target.value) / 100)}
        />
        <p className={ui.muted} style={{ fontSize: 11 }}>
          仅在清单未给出 frame 时生效：用来校正原图在结果里的实际大小
        </p>
      </div>

      <div className={ui.field}>
        <div className={ui.fieldLabel}>
          <span>背景</span>
        </div>
        <div className={ui.seg}>
          {BACKDROPS.map((b) => (
            <button
              key={b.id}
              type="button"
              className={store.backdrop === b.id ? ui.on : ''}
              onClick={() => store.setBackdrop(b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className={ui.field}>
        <div className={ui.fieldLabel}>
          <span>缩放</span>
          <span className={ui.value}>{Math.round(store.zoom * 100)}%</span>
        </div>
        <div className={s.zoomRow}>
          <button type="button" className={ui.mini} onClick={() => store.zoomBy(1 / 1.25)}>
            −
          </button>
          <button type="button" className={ui.mini} onClick={() => store.zoomBy(1.25)}>
            ＋
          </button>
          <button type="button" className={ui.mini} onClick={store.resetView}>
            复位
          </button>
        </div>
      </div>
    </section>
  );
}
