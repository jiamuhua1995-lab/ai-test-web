/** 归一化矩形：取值 0~1，相对所属图片自身的宽高 */
export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 像素矩形：相对图片原始像素尺寸 */
export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ImageAsset {
  src: string;
  width: number;
  height: number;
}

/** 某个模型的扩图结果 */
export interface ResultAsset extends ImageAsset {
  modelId: string;
  /** 原图在该结果中的位置；缺省时自动推算 */
  frame?: FrameRect;
}

export interface ModelInfo {
  id: string;
  name: string;
  note?: string;
}

export interface CaseItem {
  id: string;
  name: string;
  tags?: string[];
  original: ImageAsset;
  /** 列表小图，缺省时退回原图 */
  thumb?: string;
  /** key = modelId */
  results: Record<string, ResultAsset>;
}

export interface Dataset {
  models: ModelInfo[];
  cases: CaseItem[];
  /** 数据来源，仅用于界面提示 */
  source: 'none' | 'manifest' | 'folder' | 'demo';
}

export type ViewMode = 'grid' | 'slider' | 'flip';
export type AlignMode = 'whole' | 'frame';
export type BackdropMode = 'checker' | 'dark' | 'light';

export interface CaseRating {
  /** modelId -> 1~5 */
  scores: Record<string, number>;
  /** 本用例最佳模型 */
  best?: string;
}

/** caseId -> 评分 */
export type RatingMap = Record<string, CaseRating>;

export interface ModelStat {
  modelId: string;
  name: string;
  avg: number | null;
  rated: number;
  bestCount: number;
}

/* ───────── manifest.json 的生数据结构 ───────── */

export interface RawManifestResult {
  model: string;
  file: string;
  frame?: [number, number, number, number];
}

export interface RawManifestCase {
  id?: string;
  name?: string;
  tags?: string[];
  original: string;
  /** 列表小图，没有就用原图 */
  thumb?: string;
  results: RawManifestResult[];
}

export interface RawManifest {
  models?: ModelInfo[];
  cases: RawManifestCase[];
  /** 相对 manifest 自身的资源前缀，默认同目录 */
  baseDir?: string;
}
