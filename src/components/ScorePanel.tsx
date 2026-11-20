import s from './Score.module.css';
import ui from '../styles/ui.module.css';
import { ScoreStars } from './ScoreStars';
import type { CompareState } from '../hooks/useCompareState';

interface ScorePanelProps {
  store: CompareState;
}

export function ScorePanel({ store }: ScorePanelProps) {
  const item = store.currentCase;
  const rating = item ? store.ratings.ratings[item.id] : undefined;

  return (
    <section className={ui.panel}>
      <h3 className={ui.panelTitle}>本用例打分</h3>

      {!item || store.caseModels.length === 0 ? (
        <p className={ui.muted}>加载数据后在这里打分，结果存在本地浏览器</p>
      ) : (
        <div className={s.scoreRows}>
          {store.caseModels.map((m) => {
            const isBest = rating?.best === m.id;
            return (
              <div key={m.id} className={s.scoreRow}>
                <span className={s.scoreName} title={m.note ?? m.name}>
                  {m.name}
                </span>
                <ScoreStars
                  value={rating?.scores[m.id]}
                  onPick={(n) => store.ratings.setScore(item.id, m.id, n)}
                />
                <button
                  type="button"
                  className={`${s.bestBtn} ${isBest ? s.on : ''}`}
                  onClick={() => store.ratings.setBest(item.id, m.id)}
                >
                  {isBest ? '★ 最佳' : '最佳'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
