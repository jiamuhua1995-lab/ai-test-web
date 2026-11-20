import s from './Sidebar.module.css';
import ui from '../styles/ui.module.css';
import type { CompareState } from '../hooks/useCompareState';

interface CaseListProps {
  store: CompareState;
}

export function CaseList({ store }: CaseListProps) {
  const { dataset, currentCase, goCase, categories, category, setCategory, visibleCases } = store;

  return (
    <section className={ui.panel}>
      <h3 className={ui.panelTitle}>
        用例 <span className={ui.count}>{visibleCases.length}</span>
        {category && <span className={ui.count}>共 {dataset.cases.length}</span>}
      </h3>

      {categories.length > 1 && (
        <div className={s.chips}>
          <button
            type="button"
            className={`${s.chip} ${category === null ? s.on : ''}`}
            onClick={() => setCategory(null)}
          >
            全部
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className={`${s.chip} ${category === c ? s.on : ''}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {dataset.cases.length === 0 ? (
        <p className={ui.muted}>还没有数据</p>
      ) : (
        <div className={s.caseList}>
          {visibleCases.map((c) => {
            const n = Object.keys(c.results).length;
            const index = dataset.cases.findIndex((x) => x.id === c.id);
            return (
              <button
                key={c.id}
                type="button"
                className={`${s.caseItem} ${c.id === currentCase?.id ? s.on : ''}`}
                onClick={() => goCase(index)}
              >
                <img className={s.thumb} src={c.thumb ?? c.original.src} alt="" loading="lazy" />
                <span className={s.caseMeta}>
                  <span className={s.caseName}>{c.name}</span>
                  <span className={s.caseSub}>
                    {c.original.width}×{c.original.height} · {n} 个结果
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {store.error && (
        <p className={ui.error} style={{ marginTop: 8 }}>
          {store.error}
        </p>
      )}
    </section>
  );
}
