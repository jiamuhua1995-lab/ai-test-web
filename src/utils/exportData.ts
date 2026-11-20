import type { CaseItem, ModelInfo, RatingMap } from '../types';

function download(fileName: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportRatingsCsv(
  cases: CaseItem[],
  models: ModelInfo[],
  ratings: RatingMap,
): void {
  const header = ['用例', ...models.map((m) => m.name), '最佳模型'];
  const rows = cases.map((c) => {
    const r = ratings[c.id];
    const best = r?.best ? models.find((m) => m.id === r.best)?.name ?? r.best : '';
    return [c.name, ...models.map((m) => r?.scores[m.id] ?? ''), best];
  });

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
  // 加 BOM，Excel 打开中文不乱码
  download(`AItest-评分-${stamp()}.csv`, `\uFEFF${csv}`, 'text/csv');
}

export function exportRatingsJson(
  cases: CaseItem[],
  models: ModelInfo[],
  ratings: RatingMap,
): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    models,
    cases: cases.map((c) => ({
      id: c.id,
      name: c.name,
      scores: ratings[c.id]?.scores ?? {},
      best: ratings[c.id]?.best ?? null,
    })),
  };
  download(`AItest-评分-${stamp()}.json`, JSON.stringify(payload, null, 2), 'application/json');
}
