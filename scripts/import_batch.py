#!/usr/bin/env python3
"""把一批扩图产出导入 AI test，并合并进 manifest.json。

自动识别两种目录结构：

A）一对一（火山批跑脚本的输出）—— 一个模型一列
    out_20261118_174209/
        01_原图/001_动漫_原图.jpg
        02_扩图结果/001_动漫_扩图.png
        03_对比图/...            ← 用不上，跳过
        result.json              ← 有就读（分类、原名、尺寸都从这儿来）

B）多场景（阿里 wanx2.1 的输出）—— 每个场景目录单独成一列
    扩图测试结果/
        原图/人像/影像杂志02-124.jpg
        A_居中等比/01_A_center_人像_影像杂志02-124.png
        B_上下扩图/01_B_vertical_人像_影像杂志02-124.png
        C_左右扩图/...
        D_非居中扩图/...

用法：
    python3 scripts/import_batch.py --src ~/Desktop/out_20261118_174209 --model 火山
    python3 scripts/import_batch.py --src ~/Desktop/扩图测试结果 \
            --model "阿里 wanx2.1" --model-id wanx2.1

同一张原图在不同批次里会自动合并成同一个用例（按「分类 + 原图文件名」认亲），
所以同图跨模型可以直接并排看。

原图在结果里的位置（frame）按 --align 决定：
    auto     （默认）结果比原图大就按"原始像素居中"算，否则跑像素检测
    detect   一律跑像素检测，重采样过、不居中的都能找准
    centered 只按居中推算
    none     不写，交给前端自动猜 + 手动修正
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import detect_frame as df  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CASES_DIR = ROOT / "public" / "data" / "cases"
MANIFEST_PATH = ROOT / "public" / "data" / "manifest.json"

IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
EXCLUDE_DIR_WORDS = ("对比", "compare", "montage")


# ───────────────────────── 图片落地 ─────────────────────────


def save_image(src: Path, dst_dir: Path, stem: str, encode: str, quality: int) -> Path:
    if encode == "none":
        dst = dst_dir / f"{stem}{src.suffix.lower()}"
        shutil.copy2(src, dst)
        return dst

    try:
        from PIL import Image  # type: ignore
    except ImportError:
        sys.exit("转码需要 Pillow：pip3 install Pillow（或加 --encode none 直接拷贝）")

    dst = dst_dir / f"{stem}{'.webp' if encode == 'webp' else '.jpg'}"
    with Image.open(src) as im:
        im = im.convert("RGB")
        if encode == "webp":
            im.save(dst, "WEBP", quality=quality, method=4)
        else:
            im.save(dst, "JPEG", quality=quality, subsampling=0, optimize=True)
    return dst


def make_thumb(src: Path, dst_dir: Path, width: int = 180) -> Path | None:
    """列表小图。下划线前缀，工具不会把它当成模型结果。"""
    try:
        from PIL import Image  # type: ignore
    except ImportError:
        return None
    dst = dst_dir / "_thumb.webp"
    try:
        with Image.open(src) as im:
            im = im.convert("RGB")
            h = max(1, round(im.height * width / im.width))
            im.resize((width, h), Image.LANCZOS).save(dst, "WEBP", quality=80, method=4)
    except Exception as e:
        print(f"  缩略图失败（{e}）")
        return None
    return dst


def image_size(path: Path) -> tuple[int, int] | None:
    try:
        from PIL import Image  # type: ignore

        with Image.open(path) as im:
            return im.size
    except Exception:
        return None


# ───────────────────────── frame ─────────────────────────


def centered_frame(ow: int, oh: int, rw: int, rh: int) -> list[float] | None:
    """原图按原始像素居中粘贴时，它在结果里的归一化位置"""
    if min(ow, oh, rw, rh) <= 0 or ow > rw or oh > rh:
        return None
    return [
        round((rw - ow) / 2 / rw, 6),
        round((rh - oh) / 2 / rh, 6),
        round(ow / rw, 6),
        round(oh / rh, 6),
    ]


def resolve_frame(
    mode: str,
    orig: Path,
    result: Path,
    ow: int,
    oh: int,
    rw: int,
    rh: int,
) -> tuple[list[float] | None, float | None]:
    if mode == "none":
        return None, None

    if mode in ("auto", "centered"):
        frame = centered_frame(ow, oh, rw, rh)
        if frame or mode == "centered":
            return frame, None

    if not df.available():
        print("  想做像素检测但缺 numpy（pip3 install numpy），退回自动推算")
        return None, None

    out = df.detect_frame(orig, result)
    if not out:
        return None, None
    frame, score = out
    frame = [float(v) for v in frame]
    if score < 0.75:
        print(f"  检测置信度偏低（{score}），这组 frame 请人工确认")
    return [round(v, 6) for v in frame], score


# ───────────────────────── manifest ─────────────────────────


def load_manifest() -> dict:
    if MANIFEST_PATH.is_file():
        try:
            data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
            data.setdefault("models", [])
            data.setdefault("cases", [])
            return data
        except Exception:
            print("已有的 manifest.json 解析失败，将重新生成")
    return {"models": [], "cases": []}


def upsert_model(manifest: dict, model_id: str, name: str, note: str | None) -> None:
    for m in manifest["models"]:
        if m["id"] == model_id:
            m["name"] = name
            if note:
                m["note"] = note
            return
    entry = {"id": model_id, "name": name}
    if note:
        entry["note"] = note
    manifest["models"].append(entry)


def find_case(manifest: dict, case_id: str, category: str, source: str) -> dict | None:
    """同一张原图（分类 + 原图文件名）视为同一个用例"""
    if source:
        for c in manifest["cases"]:
            if c.get("source") == source and c.get("category", category) == category:
                return c
    for c in manifest["cases"]:
        if c["id"] == case_id:
            return c
    return None


def put_result(case: dict, entry: dict) -> None:
    results = [r for r in case.get("results", []) if r["model"] != entry["model"]]
    results.append(entry)
    results.sort(key=lambda r: r["model"])
    case["results"] = results


# ───────────────────────── 目录识别 ─────────────────────────


def list_images(d: Path) -> list[Path]:
    return sorted(
        p
        for p in d.iterdir()
        if p.is_file() and p.suffix.lower() in IMAGE_EXT and not p.name.startswith("_")
    )


def index_prefix(name: str) -> str | None:
    m = re.match(r"^(\d+)", name)
    return m.group(1) if m else None


def detect_layout(src: Path) -> tuple[str, Path, list[Path]]:
    dirs = [p for p in src.iterdir() if p.is_dir() and not p.name.startswith(".")]
    orig_dir = next(
        (p for p in dirs if "原图" in p.name or "original" in p.name.lower()), None
    )
    if not orig_dir:
        sys.exit("找不到原图目录（名字里要带「原图」或 original）")

    result_dirs = [
        p
        for p in dirs
        if p != orig_dir and not any(w in p.name for w in EXCLUDE_DIR_WORDS)
    ]
    if not result_dirs:
        sys.exit("找不到扩图结果目录")

    nested = any(p.is_dir() for p in orig_dir.iterdir())
    layout = "pairs" if (len(result_dirs) == 1 and not nested) else "variants"
    return layout, orig_dir, sorted(result_dirs, key=lambda p: p.name)


# ───────────────────────── 两种布局各自收集任务 ─────────────────────────


class Job:
    """一条导入任务 = 某个用例的某个模型结果"""

    def __init__(
        self,
        case_id: str,
        case_name: str,
        category: str,
        source: str,
        orig: Path,
        model_id: str,
        model_name: str,
        result: Path,
        dims: tuple[int, int, int, int] | None = None,
        tag_extra: str | None = None,
    ):
        self.case_id = case_id
        self.case_name = case_name
        self.category = category
        self.source = source
        self.orig = orig
        self.model_id = model_id
        self.model_name = model_name
        self.result = result
        self.dims = dims
        self.tag_extra = tag_extra


def jobs_pairs(
    src: Path, orig_dir: Path, result_dir: Path, model_id: str, model_name: str
) -> list[Job]:
    originals = {index_prefix(p.name): p for p in list_images(orig_dir)}
    results = {index_prefix(p.name): p for p in list_images(result_dir)}

    records: list[dict] = []
    rj = src / "result.json"
    if rj.is_file():
        try:
            data = json.loads(rj.read_text(encoding="utf-8"))
            records = data.get("records", data) if isinstance(data, dict) else data
        except Exception as e:
            print(f"result.json 读不了（{e}），改用文件名配对")

    jobs: list[Job] = []
    if records:
        for r in records:
            key = f"{int(r.get('idx', 0)):03d}"
            if r.get("status", "OK") != "OK":
                print(f"跳过 {key}：status={r.get('status')} {r.get('error', '')}")
                continue
            o, res = originals.get(key), results.get(key)
            if not o or not res:
                print(f"跳过 {key}：原图或结果缺失")
                continue
            category = r.get("category", "")
            source = Path(r.get("orig_name", o.name)).stem
            dims = (
                r.get("orig_w", 0),
                r.get("orig_h", 0),
                r.get("result_w", 0),
                r.get("result_h", 0),
            )
            jobs.append(
                Job(
                    case_id=f"{key}_{category}" if category else key,
                    case_name=f"{key} {category} · {source}".strip(),
                    category=category,
                    source=source,
                    orig=o,
                    model_id=model_id,
                    model_name=model_name,
                    result=res,
                    dims=dims if all(dims) else None,
                )
            )
    else:
        for key in sorted(set(originals) & set(results)):
            if key is None:
                continue
            o = originals[key]
            jobs.append(
                Job(
                    case_id=key,
                    case_name=f"{key} · {o.stem}",
                    category="",
                    source=o.stem,
                    orig=o,
                    model_id=model_id,
                    model_name=model_name,
                    result=results[key],
                )
            )
    return jobs


def jobs_variants(
    orig_dir: Path, result_dirs: list[Path], model_id: str, model_name: str
) -> list[Job]:
    # 原图索引：(分类, 文件名) -> 路径
    originals: dict[tuple[str, str], Path] = {}
    for p in sorted(orig_dir.rglob("*")):
        if p.is_file() and p.suffix.lower() in IMAGE_EXT and not p.name.startswith("_"):
            category = p.parent.name if p.parent != orig_dir else ""
            originals[(category, p.stem)] = p
    if not originals:
        sys.exit("原图目录里没有图片")

    jobs: list[Job] = []
    for rd in result_dirs:
        # 场景目录名就是列名：A_居中等比 → id 后缀和显示名都用 A居中等比
        # 列名要短，右栏打分和排行榜的名字列放不下长串
        short = rd.name.replace("_", "")
        label = short
        for p in list_images(rd):
            parts = p.stem.split("_")
            if len(parts) < 3:
                print(f"跳过 {p.name}：文件名里认不出分类和原图名")
                continue
            idx = parts[0]
            source = parts[-1]
            category = parts[-2]
            o = originals.get((category, source)) or next(
                (v for (c, s), v in originals.items() if s == source), None
            )
            if not o:
                print(f"跳过 {p.name}：找不到对应原图")
                continue
            jobs.append(
                Job(
                    case_id=f"{idx}_{category}_{source}",
                    case_name=f"{idx} {category} · {source}",
                    category=category,
                    source=source,
                    orig=o,
                    model_id=f"{model_id}-{short}",
                    model_name=f"{model_name} {label}",
                    result=p,
                    tag_extra=label,
                )
            )
    return jobs


# ───────────────────────── 主流程 ─────────────────────────


def main() -> None:
    ap = argparse.ArgumentParser(description="导入一批扩图产出到 AI test")
    ap.add_argument("--src", required=True, help="批跑产出目录")
    ap.add_argument("--model", required=True, help="模型显示名")
    ap.add_argument("--model-id", default=None, help="模型 id，默认同 --model")
    ap.add_argument("--note", default=None, help="模型备注，鼠标悬浮时显示")
    ap.add_argument("--encode", choices=["webp", "jpeg", "none"], default="webp")
    ap.add_argument("--quality", type=int, default=95)
    ap.add_argument(
        "--align", choices=["auto", "detect", "centered", "none"], default="auto"
    )
    ap.add_argument("--layout", choices=["auto", "pairs", "variants"], default="auto")
    ap.add_argument("--limit", type=int, default=0, help="只导前 N 条，用来试水")
    args = ap.parse_args()

    src = Path(args.src).expanduser().resolve()
    if not src.is_dir():
        sys.exit(f"找不到目录：{src}")

    layout, orig_dir, result_dirs = detect_layout(src)
    if args.layout != "auto":
        layout = args.layout
    model_id = args.model_id or args.model

    print(f"目录结构：{'一对一' if layout == 'pairs' else '多场景'}")
    print(f"原图目录：{orig_dir.name}")
    print(f"结果目录：{', '.join(p.name for p in result_dirs)}")

    if layout == "pairs":
        jobs = jobs_pairs(src, orig_dir, result_dirs[0], model_id, args.model)
    else:
        jobs = jobs_variants(orig_dir, result_dirs, model_id, args.model)

    if args.limit:
        jobs = jobs[: args.limit]
    if not jobs:
        sys.exit("没有可导入的内容")

    manifest = load_manifest()
    CASES_DIR.mkdir(parents=True, exist_ok=True)

    seen_models: dict[str, str] = {}
    done = 0
    for job in jobs:
        case = find_case(manifest, job.case_id, job.category, job.source)
        case_id = case["id"] if case else job.case_id
        case_dir = CASES_DIR / case_id
        case_dir.mkdir(parents=True, exist_ok=True)

        # 原图：用例已有就不动，避免影响已入库模型的 frame
        if case and case.get("original") and (CASES_DIR.parent / case["original"]).is_file():
            o_rel = case["original"]
            o_path = CASES_DIR.parent / o_rel
        else:
            o_path = save_image(job.orig, case_dir, "original", "none", args.quality)
            o_rel = f"cases/{case_id}/{o_path.name}"

        r_path = save_image(job.result, case_dir, job.model_id, args.encode, args.quality)

        if job.dims:
            ow, oh, rw, rh = job.dims
        else:
            ow, oh = image_size(o_path) or (0, 0)
            rw, rh = image_size(job.result) or (0, 0)

        frame, score = resolve_frame(args.align, o_path, job.result, ow, oh, rw, rh)

        entry: dict = {"model": job.model_id, "file": f"cases/{case_id}/{r_path.name}"}
        if frame:
            entry["frame"] = frame

        tags = [t for t in [job.category, job.tag_extra] if t]
        if ow and rw:
            tags.append(f"{rw}×{rh} ← {ow}×{oh}")

        if case is None:
            case = {
                "id": case_id,
                "name": job.case_name,
                "category": job.category,
                "source": job.source,
                "tags": tags,
                "original": o_rel,
                "results": [],
            }
            manifest["cases"].append(case)
        else:
            case.setdefault("category", job.category)
            case.setdefault("source", job.source)
            # 多模型共用的用例，标签只保留分类，尺寸标签各列自己带
            case["tags"] = [t for t in (case.get("tags") or [])[:1]] or tags[:1]

        put_result(case, entry)

        thumb = case_dir / "_thumb.webp"
        if not thumb.is_file():
            t = make_thumb(o_path, case_dir)
            if t:
                case["thumb"] = f"cases/{case_id}/{t.name}"
        else:
            case["thumb"] = f"cases/{case_id}/{thumb.name}"

        seen_models[job.model_id] = job.model_name
        done += 1
        extra = f" frame={frame} score={score}" if score is not None else ""
        print(f"[{done}/{len(jobs)}] {case_id} ← {job.model_id} ({r_path.stat().st_size // 1024} KB){extra}")

    for mid, mname in seen_models.items():
        upsert_model(manifest, mid, mname, args.note)

    manifest["cases"].sort(key=lambda c: c["id"])
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    total = sum(len(c["results"]) for c in manifest["cases"])
    print(f"\n本次导入 {done} 条，新增/更新模型 {len(seen_models)} 个")
    print(f"manifest：{MANIFEST_PATH}")
    print(f"现有用例 {len(manifest['cases'])} 个，模型 {len(manifest['models'])} 个，结果图 {total} 张")


if __name__ == "__main__":
    main()
