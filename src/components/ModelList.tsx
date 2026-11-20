import s from './Sidebar.module.css';
import ui from '../styles/ui.module.css';
import type { CompareState } from '../hooks/useCompareState';
import { expandRatio } from '../utils/frame';

interface ModelListProps {
  store: CompareState;
}

export function ModelList({ store }: ModelListProps) {
  const { caseModels, currentCase, dataset, isModelVisible, toggleModel, setAllModels } = store;
  // 各批次跑的原图不一样，这张图没有结果的模型要讲清楚，否则容易以为是没导入
  const absent = dataset.models.filter((m) => !caseModels.some((c) => c.id === m.id));

  return (
    <section className={ui.panel}>
      <h3 className={ui.panelTitle}>
        模型{' '}
        <span className={ui.count}>
          {caseModels.length}
          {dataset.models.length > caseModels.length ? ` / ${dataset.models.length}` : ''}
        </span>
        <span className={ui.titleActions}>
          <button type="button" className={ui.mini} onClick={() => setAllModels(true)}>
            全选
          </button>
          <button type="button" className={ui.mini} onClick={() => setAllModels(false)}>
            清空
          </button>
        </span>
      </h3>

      {caseModels.length === 0 ? (
        <p className={ui.muted}>当前用例没有模型结果</p>
      ) : (
        <div className={s.modelList}>
          {caseModels.map((m) => {
            const result = currentCase?.results[m.id];
            const ratio = result && currentCase ? expandRatio(result, currentCase.original) : null;
            const on = isModelVisible(m.id);
            return (
              <label key={m.id} className={s.modelRow} title={m.note ?? m.name}>
                <input type="checkbox" checked={on} onChange={() => toggleModel(m.id)} />
                <span className={`${s.modelName} ${on ? '' : s.off}`}>{m.name}</span>
                <span className={s.dim}>
                  {result ? `${result.width}×${result.height}` : '—'}
                  {ratio ? ` · ${ratio.toFixed(1)}x` : ''}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {absent.length > 0 && (
        <p className={ui.muted} style={{ marginTop: 8, fontSize: 11 }}>
          没跑这张图：{absent.map((m) => m.name).join('、')}
        </p>
      )}
    </section>
  );
}
