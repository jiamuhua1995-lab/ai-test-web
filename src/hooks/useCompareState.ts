import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AlignMode,
  BackdropMode,
  CaseItem,
  Dataset,
  ModelInfo,
  ModelStat,
  ViewMode,
} from '../types';
import { buildDemoDataset } from '../utils/demoData';
import { buildDatasetFromFiles } from '../utils/folderImport';
import { loadManifestDataset } from '../utils/manifest';
import { modelsInCase, ORIGINAL_ID } from '../utils/layers';
import { useRatings, type RatingsApi } from './useRatings';

const EMPTY_DATASET: Dataset = { models: [], cases: [], source: 'none' };
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 12;

/** 支持用 URL 参数预设打开方式：?demo=1&view=slider&align=frame */
function urlParam(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(key);
}

function initialView(): ViewMode {
  const v = urlParam('view');
  return v === 'slider' || v === 'flip' ? v : 'grid';
}

function initialAlign(): AlignMode {
  return urlParam('align') === 'frame' ? 'frame' : 'whole';
}

export interface CompareState {
  dataset: Dataset;
  loading: boolean;
  error: string | null;

  /* 数据加载 */
  loadManifest: () => Promise<void>;
  loadDemo: () => void;
  importFiles: (files: File[]) => Promise<void>;

  /* 用例 */
  caseIndex: number;
  currentCase: CaseItem | null;
  goCase: (index: number) => void;
  stepCase: (delta: number) => void;
  /** 按分类（用例第一个标签）筛选 */
  categories: string[];
  category: string | null;
  setCategory: (c: string | null) => void;
  /** 筛选后的用例，←/→ 和页码都只在这个范围里走 */
  visibleCases: CaseItem[];

  /* 模型显隐 */
  caseModels: ModelInfo[];
  visibleModels: ModelInfo[];
  isModelVisible: (id: string) => boolean;
  toggleModel: (id: string) => void;
  setAllModels: (visible: boolean) => void;

  /* 显示设置 */
  view: ViewMode;
  setView: (v: ViewMode) => void;
  align: AlignMode;
  setAlign: (a: AlignMode) => void;
  cols: number;
  setCols: (n: number) => void;
  showFrame: boolean;
  setShowFrame: (v: boolean) => void;
  showLabel: boolean;
  setShowLabel: (v: boolean) => void;
  includeOriginal: boolean;
  setIncludeOriginal: (v: boolean) => void;
  frameScale: number;
  setFrameScale: (v: number) => void;
  backdrop: BackdropMode;
  setBackdrop: (v: BackdropMode) => void;

  /* 视图变换 */
  zoom: number;
  pan: { x: number; y: number };
  zoomBy: (factor: number) => void;
  panBy: (dx: number, dy: number) => void;
  resetView: () => void;

  /* 两两对比 */
  layerA: string;
  layerB: string;
  setLayerA: (id: string) => void;
  setLayerB: (id: string) => void;
  sliderPos: number;
  setSliderPos: (v: number) => void;

  /* 评分 */
  ratings: RatingsApi;
  stats: ModelStat[];
}

export function useCompareState(): CompareState {
  const [dataset, setDataset] = useState<Dataset>(EMPTY_DATASET);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [caseIndex, setCaseIndex] = useState(0);
  const [category, setCategoryRaw] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  const [view, setView] = useState<ViewMode>(initialView);
  const [align, setAlignRaw] = useState<AlignMode>(initialAlign);
  const [cols, setCols] = useState(0);
  const [showFrame, setShowFrame] = useState(true);
  const [showLabel, setShowLabel] = useState(true);
  const [includeOriginal, setIncludeOriginal] = useState(true);
  const [frameScale, setFrameScale] = useState(1);
  const [backdrop, setBackdrop] = useState<BackdropMode>('checker');

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const [layerA, setLayerA] = useState<string>(ORIGINAL_ID);
  const [layerB, setLayerB] = useState<string>('');
  const [sliderPos, setSliderPos] = useState(50);

  const ratings = useRatings();

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const applyDataset = useCallback(
    (next: Dataset) => {
      setDataset(next);
      // ?case=<用例 id 或原图文件名> 可以直接定位到某一组
      const want = urlParam('case');
      const at = want
        ? next.cases.findIndex((c) => c.id === want || c.name.includes(want))
        : -1;
      setCaseIndex(at >= 0 ? at : 0);
      setCategoryRaw(null);
      setHidden({});
      setLayerA(ORIGINAL_ID);
      setLayerB(next.models[0]?.id ?? '');
      setError(null);
      resetView();
    },
    [resetView],
  );

  const loadManifest = useCallback(async () => {
    setLoading(true);
    try {
      applyDataset(await loadManifestDataset());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [applyDataset]);

  const loadDemo = useCallback(() => {
    setLoading(true);
    try {
      applyDataset(buildDemoDataset());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [applyDataset]);

  const importFiles = useCallback(
    async (files: File[]) => {
      setLoading(true);
      try {
        applyDataset(await buildDatasetFromFiles(files));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [applyDataset],
  );

  // 首次进入：?demo=1 直接上示例，否则试着读清单，没有就静默留在空状态
  useEffect(() => {
    let alive = true;
    if (urlParam('demo') === '1') {
      applyDataset(buildDemoDataset());
      return undefined;
    }
    (async () => {
      try {
        const ds = await loadManifestDataset();
        if (alive && ds.cases.length) applyDataset(ds);
      } catch {
        /* 没有清单是正常情况 */
      }
    })();
    return () => {
      alive = false;
    };
  }, [applyDataset]);

  const currentCase = dataset.cases[caseIndex] ?? null;

  const goCase = useCallback(
    (index: number) => {
      setCaseIndex(index);
      setPan({ x: 0, y: 0 });
    },
    [],
  );

  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const c of dataset.cases) {
      const tag = c.tags?.[0];
      if (tag && !seen.includes(tag)) seen.push(tag);
    }
    return seen;
  }, [dataset.cases]);

  const visibleCases = useMemo(
    () => (category ? dataset.cases.filter((c) => c.tags?.[0] === category) : dataset.cases),
    [category, dataset.cases],
  );

  const stepCase = useCallback(
    (delta: number) => {
      const list = visibleCases;
      if (!list.length) return;
      const current = dataset.cases[caseIndex];
      const at = current ? list.findIndex((c) => c.id === current.id) : -1;
      const next = list[(((at < 0 ? 0 : at) + delta) % list.length + list.length) % list.length];
      const target = dataset.cases.findIndex((c) => c.id === next.id);
      if (target >= 0) setCaseIndex(target);
      setPan({ x: 0, y: 0 });
    },
    [caseIndex, dataset.cases, visibleCases],
  );

  const setCategory = useCallback(
    (next: string | null) => {
      setCategoryRaw(next);
      const current = dataset.cases[caseIndex];
      if (next && current?.tags?.[0] !== next) {
        const first = dataset.cases.findIndex((c) => c.tags?.[0] === next);
        if (first >= 0) setCaseIndex(first);
      }
      setPan({ x: 0, y: 0 });
    },
    [caseIndex, dataset.cases],
  );

  const setAlign = useCallback(
    (a: AlignMode) => {
      setAlignRaw(a);
      resetView();
    },
    [resetView],
  );

  const caseModels = useMemo(
    () => (currentCase ? modelsInCase(currentCase, dataset.models) : []),
    [currentCase, dataset.models],
  );

  const isModelVisible = useCallback((id: string) => !hidden[id], [hidden]);

  const visibleModels = useMemo(
    () => caseModels.filter((m) => !hidden[m.id]),
    [caseModels, hidden],
  );

  const toggleModel = useCallback((id: string) => {
    setHidden((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const setAllModels = useCallback(
    (visible: boolean) => {
      if (visible) {
        setHidden({});
        return;
      }
      const next: Record<string, boolean> = {};
      for (const m of dataset.models) next[m.id] = true;
      setHidden(next);
    },
    [dataset.models],
  );

  const zoomBy = useCallback((factor: number) => {
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * factor)));
  }, []);

  const panBy = useCallback((dx: number, dy: number) => {
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  const stats = useMemo<ModelStat[]>(() => {
    return dataset.models.map((m) => {
      let sum = 0;
      let rated = 0;
      let bestCount = 0;
      for (const c of dataset.cases) {
        const r = ratings.ratings[c.id];
        if (!r) continue;
        const s = r.scores[m.id];
        if (typeof s === 'number') {
          sum += s;
          rated += 1;
        }
        if (r.best === m.id) bestCount += 1;
      }
      return {
        modelId: m.id,
        name: m.name,
        avg: rated ? sum / rated : null,
        rated,
        bestCount,
      };
    });
  }, [dataset.cases, dataset.models, ratings.ratings]);

  return {
    dataset,
    loading,
    error,
    loadManifest,
    loadDemo,
    importFiles,
    caseIndex,
    currentCase,
    goCase,
    stepCase,
    categories,
    category,
    setCategory,
    visibleCases,
    caseModels,
    visibleModels,
    isModelVisible,
    toggleModel,
    setAllModels,
    view,
    setView,
    align,
    setAlign,
    cols,
    setCols,
    showFrame,
    setShowFrame,
    showLabel,
    setShowLabel,
    includeOriginal,
    setIncludeOriginal,
    frameScale,
    setFrameScale,
    backdrop,
    setBackdrop,
    zoom,
    pan,
    zoomBy,
    panBy,
    resetView,
    layerA,
    layerB,
    setLayerA,
    setLayerB,
    sliderPos,
    setSliderPos,
    ratings,
    stats,
  };
}
