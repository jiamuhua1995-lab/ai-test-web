import type { ChangeEvent } from 'react';
import s from './Compare.module.css';
import ui from '../styles/ui.module.css';
import type { CompareState } from '../hooks/useCompareState';

interface EmptyStateProps {
  store: CompareState;
}

export function EmptyState({ store }: EmptyStateProps) {
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) void store.importFiles(files);
    e.target.value = '';
  };

  return (
    <div className={s.empty}>
      <h2>还没有图片</h2>
      <ol>
        <li>
          点 <b>载入示例</b>，先看界面怎么用
        </li>
        <li>
          把装着用例的文件夹 <b>拖进窗口</b>，或点「导入文件夹」
        </li>
        <li>
          图片放到 <code>public/data/cases/</code>，跑 <code>npm run manifest</code> 生成清单，
          再点「重载清单」
        </li>
      </ol>
      <p className={ui.muted}>
        目录约定：<code>用例名/original.jpg</code> + <code>用例名/模型名.jpg</code>
      </p>

      <div className={s.emptyActions}>
        <button type="button" className={`${ui.btn} ${ui.primary}`} onClick={store.loadDemo}>
          载入示例
        </button>
        <label className={ui.btn}>
          导入文件夹
          <input type="file" hidden multiple webkitdirectory="" directory="" onChange={onPick} />
        </label>
      </div>

      {store.error && <p className={ui.error}>{store.error}</p>}
    </div>
  );
}
