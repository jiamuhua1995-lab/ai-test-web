import type { ChangeEvent } from 'react';
import s from './TopBar.module.css';
import ui from '../styles/ui.module.css';
import type { CompareState } from '../hooks/useCompareState';
import type { ViewMode } from '../types';

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'grid', label: '网格对比' },
  { id: 'slider', label: '滑块对比' },
  { id: 'flip', label: '闪视对比' },
];

const SOURCE_TEXT: Record<CompareState['dataset']['source'], string> = {
  none: '未加载',
  manifest: '来源：清单',
  folder: '来源：本地文件夹',
  demo: '来源：示例数据',
};

interface TopBarProps {
  store: CompareState;
  onHelp: () => void;
}

export function TopBar({ store, onHelp }: TopBarProps) {
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) void store.importFiles(files);
    e.target.value = '';
  };

  return (
    <header className={s.bar}>
      <div className={s.brand}>
        <span className={s.logo}>AI</span>
        <span className={s.brandText}>
          <strong>AI test</strong>
          <small>扩图效果对比</small>
        </span>
      </div>

      <div className={s.tabs} role="tablist">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={store.view === v.id}
            className={`${s.tab} ${store.view === v.id ? s.on : ''}`}
            onClick={() => store.setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className={s.spacer} />

      <span className={s.source}>
        {store.loading ? '加载中…' : SOURCE_TEXT[store.dataset.source]}
      </span>

      <div className={s.actions}>
        <label className={`${ui.btn} ${s.fileLabel}`} title="选择一个装着用例子目录的文件夹">
          导入文件夹
          <input type="file" hidden multiple webkitdirectory="" directory="" onChange={onPick} />
        </label>
        <button
          type="button"
          className={ui.btn}
          onClick={() => void store.loadManifest()}
          title="重新读取 public/data/manifest.json"
        >
          重载清单
        </button>
        <button type="button" className={ui.btn} onClick={store.loadDemo} title="生成内置示例图片">
          载入示例
        </button>
        <button type="button" className={`${ui.btn} ${s.round}`} onClick={onHelp} title="快捷键与用法">
          ?
        </button>
      </div>
    </header>
  );
}
