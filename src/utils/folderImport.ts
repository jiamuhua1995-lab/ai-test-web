import type { CaseItem, Dataset, ModelInfo, ResultAsset } from '../types';
import { loadImageMeta } from './imageMeta';

const IMAGE_RE = /\.(png|jpe?g|webp|bmp|gif|avif)$/i;
const ORIGINAL_NAMES = ['original', 'origin', 'src', 'source', 'input', 'raw', '原图', '原始', '输入'];
/** 下划线开头的文件是工具自己生成的（缩略图等），不当成模型结果 */
const INTERNAL_RE = /^_/;

function stem(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

function isOriginal(fileName: string): boolean {
  const s = stem(fileName).toLowerCase();
  return ORIGINAL_NAMES.some((n) => s === n || s.startsWith(`${n}_`) || s.startsWith(`${n}-`));
}

interface Entry {
  /** 用例名（父目录名；文件直接位于根目录时为 '未分组'） */
  caseName: string;
  fileName: string;
  file: File;
}

function toEntries(files: File[]): Entry[] {
  const out: Entry[] = [];
  for (const file of files) {
    if (!IMAGE_RE.test(file.name) || INTERNAL_RE.test(file.name)) continue;
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const parts = rel.split('/').filter(Boolean);
    const fileName = parts.pop() as string;
    const caseName = parts.length ? parts[parts.length - 1] : '未分组';
    out.push({ caseName, fileName, file });
  }
  return out;
}

/** 由 input[webkitdirectory] 或拖拽得到的文件列表构建数据集 */
export async function buildDatasetFromFiles(files: File[]): Promise<Dataset> {
  const entries = toEntries(files);
  if (!entries.length) throw new Error('没有找到图片文件');

  const grouped = new Map<string, Entry[]>();
  for (const e of entries) {
    const list = grouped.get(e.caseName) ?? [];
    list.push(e);
    grouped.set(e.caseName, list);
  }

  const modelOrder: string[] = [];
  const cases: CaseItem[] = [];

  for (const [caseName, list] of [...grouped.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], 'zh-Hans-CN'),
  )) {
    const originalEntry = list.find((e) => isOriginal(e.fileName));
    if (!originalEntry) continue; // 没有原图的目录跳过

    const original = await loadImageMeta(URL.createObjectURL(originalEntry.file));
    const results: Record<string, ResultAsset> = {};

    for (const e of list.sort((a, b) => a.fileName.localeCompare(b.fileName, 'zh-Hans-CN'))) {
      if (e === originalEntry) continue;
      const modelId = stem(e.fileName);
      const meta = await loadImageMeta(URL.createObjectURL(e.file));
      results[modelId] = { ...meta, modelId };
      if (!modelOrder.includes(modelId)) modelOrder.push(modelId);
    }

    cases.push({ id: caseName, name: caseName, original, results });
  }

  if (!cases.length) {
    throw new Error('每个用例目录里需要有一张名为 original（或 原图 / input）的图片');
  }

  const models: ModelInfo[] = modelOrder.map((id) => ({ id, name: id }));
  return { models, cases, source: 'folder' };
}

/* ───────── 拖拽目录支持 ───────── */

function readEntryFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file((f) => {
      // 保留目录信息，后续分组要用
      Object.defineProperty(f, 'webkitRelativePath', {
        value: entry.fullPath.replace(/^\//, ''),
        configurable: true,
      });
      resolve(f);
    }, reject);
  });
}

function readDir(entry: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = entry.createReader();
  const all: FileSystemEntry[] = [];
  return new Promise((resolve, reject) => {
    const step = () => {
      reader.readEntries((batch) => {
        if (!batch.length) {
          resolve(all);
          return;
        }
        all.push(...batch);
        step();
      }, reject);
    };
    step();
  });
}

async function walk(entry: FileSystemEntry, out: File[]): Promise<void> {
  if (entry.isFile) {
    try {
      out.push(await readEntryFile(entry as FileSystemFileEntry));
    } catch {
      /* 跳过读不到的文件 */
    }
    return;
  }
  if (entry.isDirectory) {
    const children = await readDir(entry as FileSystemDirectoryEntry);
    for (const c of children) await walk(c, out);
  }
}

/** 从拖拽事件里取出全部图片文件（递归子目录） */
export async function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const items = Array.from(dt.items ?? []);
  const entries = items
    .map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null))
    .filter((e): e is FileSystemEntry => e !== null);

  if (!entries.length) return Array.from(dt.files ?? []);

  const out: File[] = [];
  for (const e of entries) await walk(e, out);
  return out;
}
