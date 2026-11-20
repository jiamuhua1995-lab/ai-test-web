import type { CaseItem, FrameRect, ImageAsset, ModelInfo } from '../types';

export const ORIGINAL_ID = '__original__';

/** 画面上的一张图：原图或某个模型的结果 */
export interface Layer {
  id: string;
  name: string;
  note?: string;
  asset: ImageAsset;
  frame?: FrameRect;
  isOriginal: boolean;
}

export function originalLayer(item: CaseItem): Layer {
  return {
    id: ORIGINAL_ID,
    name: '原图',
    asset: item.original,
    frame: { x: 0, y: 0, w: 1, h: 1 },
    isOriginal: true,
  };
}

/** 当前用例里实际有结果的模型（保持 models 的顺序） */
export function modelsInCase(item: CaseItem, models: ModelInfo[]): ModelInfo[] {
  return models.filter((m) => Boolean(item.results[m.id]));
}

export function buildLayers(
  item: CaseItem,
  models: ModelInfo[],
  includeOriginal: boolean,
): Layer[] {
  const layers: Layer[] = includeOriginal ? [originalLayer(item)] : [];
  for (const m of models) {
    const r = item.results[m.id];
    if (!r) continue;
    layers.push({
      id: m.id,
      name: m.name,
      note: m.note,
      asset: r,
      frame: r.frame,
      isOriginal: false,
    });
  }
  return layers;
}

export function findLayer(layers: Layer[], id: string | null): Layer | null {
  if (!id) return layers[0] ?? null;
  return layers.find((l) => l.id === id) ?? layers[0] ?? null;
}
