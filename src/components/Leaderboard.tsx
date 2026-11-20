import s from './Score.module.css';
import ui from '../styles/ui.module.css';
import type { CompareState } from '../hooks/useCompareState';
import { exportRatingsCsv, exportRatingsJson } from '../utils/exportData';

interface LeaderboardProps {
  store: CompareState;
}

export function Leaderboard({ store }: LeaderboardProps) {
  const { stats, dataset, ratings } = store;
  const ranked = [...stats].sort((a, b) => {
    if (a.avg === null && b.avg === null) return b.bestCount - a.bestCount;
    if (a.avg === null) return 1;
    if (b.avg === null) return -1;
    return b.avg - a.avg || b.bestCount - a.bestCount;
  });
  const top = ranked.find((r) => r.avg !== null);

  return (
    <section className={ui.panel}>
      <h3 className={ui.panelTitle}>模型排行</h3>

      {ranked.length === 0 ? (
        <p className={ui.muted}>还没有模型</p>
      ) : (
        <table className={s.board}>
          <thead>
            <tr>
              <th>模型</th>
              <th>均分</th>
              <th>最佳</th>
              <th>已评</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r) => (
              <tr key={r.modelId} className={top && r.modelId === top.modelId ? s.lead : ''}>
                <td title={r.name}>{r.name}</td>
                <td>
                  {r.avg === null ? (
                    '—'
                  ) : (
                    <>
                      {r.avg.toFixed(2)}{' '}
                      <span className={s.avgBar}>
                        <i style={{ width: `${(r.avg / 5) * 100}%` }} />
                      </span>
                    </>
                  )}
                </td>
                <td>{r.bestCount || '—'}</td>
                <td>{r.rated || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className={s.panelActions}>
        <button
          type="button"
          className={ui.mini}
          onClick={() => exportRatingsCsv(dataset.cases, dataset.models, ratings.ratings)}
        >
          导出 CSV
        </button>
        <button
          type="button"
          className={ui.mini}
          onClick={() => exportRatingsJson(dataset.cases, dataset.models, ratings.ratings)}
        >
          导出 JSON
        </button>
        <button
          type="button"
          className={`${ui.mini} ${ui.danger}`}
          onClick={() => {
            if (window.confirm('清空所有评分？')) ratings.clearAll();
          }}
        >
          清空
        </button>
      </div>
    </section>
  );
}
