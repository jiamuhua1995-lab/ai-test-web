import type {
  CaseItem,
  Dataset,
  ModelInfo,
  RawManifest,
  ResultAsset,
} from '../types';
import { loadImageMeta } from './imageMeta';

const MANIFEST_PATH = 'data/manifest.json';

function joinUrl(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .map((p, i) => (i === 0 ? p.replace(/\/+$/, '') : p.replace(/^\/+|\/+$/g, '')))
    .join('/');
}

/** 读取 public/data/manifest.json 并补齐图片尺寸 */
export async function loadManifestDataset(): Promise<Dataset> {
  const baseUrl = import.meta.env.BASE_URL || './';
  const url = joinUrl(baseUrl, MANIFEST_PATH);

  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`读取 ${MANIFEST_PATH} 失败（HTTP ${res.status}）`);

  const raw = (await res.json()) as RawManifest;
  if (!raw || !Array.isArray(raw.cases)) throw new Error('manifest.json 格式不对：缺少 cases 数组');

  const assetBase = joinUrl(baseUrl, 'data', raw.baseDir ?? '');
  const modelOrder: string[] = [];
  const declared = new Map<string, ModelInfo>();
  (raw.models ?? []).forEach((m) => declared.set(m.id, m));

  const cases: CaseItem[] = [];

  for (const [i, rc] of raw.cases.entries()) {
    const original = await loadImageMeta(joinUrl(assetBase, rc.original));
    const results: Record<string, ResultAsset> = {};

    for (const rr of rc.results ?? []) {
      const meta = await loadImageMeta(joinUrl(assetBase, rr.file));
      results[rr.model] = {
        ...meta,
        modelId: rr.model,
        frame: rr.frame
          ? { x: rr.frame[0], y: rr.frame[1], w: rr.frame[2], h: rr.frame[3] }
          : undefined,
      };
      if (!modelOrder.includes(rr.model)) modelOrder.push(rr.model);
    }

    cases.push({
      id: rc.id ?? `case-${i + 1}`,
      name: rc.name ?? rc.id ?? `用例 ${i + 1}`,
      tags: rc.tags,
      original,
      thumb: rc.thumb ? joinUrl(assetBase, rc.thumb) : undefined,
      results,
    });
  }

  const models: ModelInfo[] = modelOrder.map(
    (id) => declared.get(id) ?? { id, name: id },
  );

  // manifest 里声明但本次没出现的模型也保留，便于固定列顺序
  for (const m of declared.values()) {
    if (!models.some((x) => x.id === m.id)) models.push(m);
  }

  return { models, cases, source: 'manifest' };
}
