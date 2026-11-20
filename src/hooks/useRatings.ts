import { useCallback, useEffect, useState } from 'react';
import type { RatingMap } from '../types';

const STORAGE_KEY = 'aitest.ratings.v1';

function read(): RatingMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RatingMap) : {};
  } catch {
    return {};
  }
}

export interface RatingsApi {
  ratings: RatingMap;
  setScore: (caseId: string, modelId: string, score: number) => void;
  setBest: (caseId: string, modelId: string) => void;
  clearAll: () => void;
}

/** 评分存在 localStorage，刷新不丢 */
export function useRatings(): RatingsApi {
  const [ratings, setRatings] = useState<RatingMap>(read);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings));
    } catch {
      /* 隐私模式下写不进去就算了 */
    }
  }, [ratings]);

  const setScore = useCallback((caseId: string, modelId: string, score: number) => {
    setRatings((prev) => {
      const cur = prev[caseId] ?? { scores: {} };
      const scores = { ...cur.scores };
      if (scores[modelId] === score) delete scores[modelId];
      else scores[modelId] = score;
      return { ...prev, [caseId]: { ...cur, scores } };
    });
  }, []);

  const setBest = useCallback((caseId: string, modelId: string) => {
    setRatings((prev) => {
      const cur = prev[caseId] ?? { scores: {} };
      return {
        ...prev,
        [caseId]: { ...cur, best: cur.best === modelId ? undefined : modelId },
      };
    });
  }, []);

  const clearAll = useCallback(() => setRatings({}), []);

  return { ratings, setScore, setBest, clearAll };
}
