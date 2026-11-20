import s from './Compare.module.css';
import ui from '../styles/ui.module.css';
import { EmptyState } from './EmptyState';
import { FlipCompare } from './FlipCompare';
import { GridCompare } from './GridCompare';
import { SliderCompare } from './SliderCompare';
import type { CompareState } from '../hooks/useCompareState';

interface StageAreaProps {
  store: CompareState;
}

export function StageArea({ store }: StageAreaProps) {
  const item = store.currentCase;

  if (!item) {
    return (
      <section className={s.stage}>
        <EmptyState store={store} />
      </section>
    );
  }

  return (
    <section className={s.stage}>
      <div className={s.stageHead}>
        <span className={s.caseTitle}>{item.name}</span>
        {item.tags && item.tags.length > 0 && (
          <span className={s.tags}>
            {item.tags.map((t) => (
              <span key={t} className={s.tagChip}>
                {t}
              </span>
            ))}
          </span>
        )}
        <span className={s.nav}>
          <button type="button" className={ui.mini} onClick={() => store.stepCase(-1)}>
            ← 上一个
          </button>
          <span className={s.pager}>
            {store.visibleCases.findIndex((c) => c.id === item.id) + 1} / {store.visibleCases.length}
          </span>
          <button type="button" className={ui.mini} onClick={() => store.stepCase(1)}>
            下一个 →
          </button>
        </span>
      </div>

      {store.view === 'grid' && <GridCompare store={store} item={item} />}
      {store.view === 'slider' && <SliderCompare store={store} item={item} />}
      {store.view === 'flip' && <FlipCompare store={store} item={item} />}
    </section>
  );
}
