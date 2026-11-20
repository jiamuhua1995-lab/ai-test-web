import s from './Score.module.css';

interface ScoreStarsProps {
  value?: number;
  onPick: (score: number) => void;
  small?: boolean;
}

const LEVELS = [1, 2, 3, 4, 5];

/** 1~5 星打分，点已选中的星可取消 */
export function ScoreStars({ value, onPick, small = false }: ScoreStarsProps) {
  return (
    <span className={`${s.stars} ${small ? s.sm : ''}`} data-no-pan>
      {LEVELS.map((n) => (
        <button
          key={n}
          type="button"
          className={`${s.star} ${value && n <= value ? s.on : ''}`}
          title={`${n} 分`}
          onClick={() => onPick(n)}
        >
          {value && n <= value ? '★' : '☆'}
        </button>
      ))}
    </span>
  );
}
