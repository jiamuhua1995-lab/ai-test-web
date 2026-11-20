#!/usr/bin/env python3
"""扫描 public/data/cases/ 生成 manifest.json。

目录约定：
    public/data/cases/
        001-人像左右扩/
            original.jpg      ← 原图（也认 原图 / input / src / source / raw）
            seedream.jpg      ← 文件名即模型名
            nano-banana.jpg
        002-风景上下扩/
            ...

用法：
    python3 scripts/gen_manifest.py                  # 默认扫 public/data/cases
    python3 scripts/gen_manifest.py --dir 别的目录
    python3 scripts/gen_manifest.py --frame auto     # 顺便写入 frame（需要 Pillow）

frame 说明：
    原图在扩图结果中的位置，写成 [x, y, w, h]（0~1 比例）。
    --frame auto 会假设"原图按原始像素居中粘贴"来计算，这对大多数扩图管线成立；
    不装 Pillow 或不加这个参数就不写，前端会自动推算并提供手动修正。
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".avif"}
ORIGINAL_STEMS = {"original", "origin", "src", "source", "input", "raw", "原图", "原始", "输入"}

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CASES_DIR = ROOT / "public" / "data" / "cases"
MANIFEST_PATH = ROOT / "public" / "data" / "manifest.json"


def image_size(path: Path):
    """读图片尺寸，没装 Pillow 就返回 None。"""
    try:
        from PIL import Image  # type: ignore
    except ImportError:
        return None
    try:
        with Image.open(path) as im:
            return im.size
    except Exception:
        return None


def centered_frame(original: Path, result: Path):
    """按"原图像素居中"推算 frame，失败返回 None。"""
    o = image_size(original)
    r = image_size(result)
    if not o or not r:
        return None
    ow, oh = o
    rw, rh = r
    if rw <= 0 or rh <= 0 or ow > rw or oh > rh:
        return None
    return [
        round((rw - ow) / 2 / rw, 6),
        round((rh - oh) / 2 / rh, 6),
        round(ow / rw, 6),
        round(oh / rh, 6),
    ]


def make_thumb(src: Path, width: int = 180) -> Path | None:
    """生成列表小图 _thumb.webp；下划线前缀的文件不会被当成模型结果。"""
    try:
        from PIL import Image  # type: ignore
    except ImportError:
        return None
    dst = src.parent / "_thumb.webp"
    try:
        with Image.open(src) as im:
            im = im.convert("RGB")
            h = max(1, round(im.height * width / im.width))
            im.resize((width, h), Image.LANCZOS).save(dst, "WEBP", quality=80, method=4)
    except Exception:
        return None
    return dst


def build(cases_dir: Path, with_frame: bool, with_thumb: bool = True) -> dict:
    if not cases_dir.is_dir():
        sys.exit(f"找不到目录：{cases_dir}")

    cases = []
    model_ids: list[str] = []

    for case_dir in sorted(p for p in cases_dir.iterdir() if p.is_dir()):
        images = sorted(
            p
            for p in case_dir.iterdir()
            if p.is_file() and p.suffix.lower() in IMAGE_EXT and not p.name.startswith("_")
        )
        if not images:
            continue

        original = next((p for p in images if p.stem.lower() in ORIGINAL_STEMS), None)
        if original is None:
            print(f"跳过 {case_dir.name}：没找到 original 命名的原图")
            continue

        rel_root = cases_dir.name  # manifest 里的路径相对 public/data/
        results = []
        for img in images:
            if img == original:
                continue
            model_id = img.stem
            entry = {
                "model": model_id,
                "file": f"{rel_root}/{case_dir.name}/{img.name}",
            }
            if with_frame:
                frame = centered_frame(original, img)
                if frame:
                    entry["frame"] = frame
            results.append(entry)
            if model_id not in model_ids:
                model_ids.append(model_id)

        if not results:
            print(f"跳过 {case_dir.name}：只有原图，没有模型结果")
            continue

        case: dict = {
            "id": case_dir.name,
            "name": case_dir.name,
            "original": f"{rel_root}/{case_dir.name}/{original.name}",
            "results": results,
        }
        thumb = make_thumb(original) if with_thumb else None
        if thumb:
            case["thumb"] = f"{rel_root}/{case_dir.name}/{thumb.name}"
        cases.append(case)

    return {
        "models": [{"id": m, "name": m} for m in model_ids],
        "cases": cases,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="生成 AI test 的图片对比清单")
    ap.add_argument("--dir", default=str(DEFAULT_CASES_DIR), help="用例根目录")
    ap.add_argument("--out", default=str(MANIFEST_PATH), help="输出的 manifest.json 路径")
    ap.add_argument(
        "--frame",
        choices=["none", "auto"],
        default="none",
        help="是否按原图像素居中推算 frame（需要 Pillow）",
    )
    ap.add_argument("--no-thumbs", action="store_true", help="不生成列表小图")
    args = ap.parse_args()

    manifest = build(Path(args.dir), args.frame == "auto", not args.no_thumbs)
    if not manifest["cases"]:
        sys.exit("没有生成任何用例，检查一下目录结构")

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    total = sum(len(c["results"]) for c in manifest["cases"])
    print(f"写入 {out}")
    print(f"用例 {len(manifest['cases'])} 个，模型 {len(manifest['models'])} 个，结果图 {total} 张")


if __name__ == "__main__":
    main()
