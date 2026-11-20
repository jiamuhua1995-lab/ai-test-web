import type { ReactNode } from 'react';
import s from './Compare.module.css';
import type { Layer } from '../utils/layers';

interface PairBarProps {
  layers: Layer[];
  labelA: string;
  labelB: string;
  valueA: string;
  valueB: string;
  onChangeA: (id: string) => void;
  onChangeB: (id: string) => void;
  hint?: ReactNode;
}

export function PairBar({
  layers,
  labelA,
  labelB,
  valueA,
  valueB,
  onChangeA,
  onChangeB,
  hint,
}: PairBarProps) {
  const options = layers.map((l) => (
    <option key={l.id} value={l.id}>
      {l.name}
    </option>
  ));

  return (
    <div className={s.pairBar}>
      <label>
        {labelA}
        <select value={valueA} onChange={(e) => onChangeA(e.target.value)}>
          {options}
        </select>
      </label>
      <label>
        {labelB}
        <select value={valueB} onChange={(e) => onChangeB(e.target.value)}>
          {options}
        </select>
      </label>
      {hint && <span className={s.hint}>{hint}</span>}
    </div>
  );
}
