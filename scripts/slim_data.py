#!/usr/bin/env python3
"""把 public/data 里的图片压一遍，给要上线的版本瘦身。

只动原图（上游给的多是 2MB 左右的 JPEG/PNG），转成同尺寸的 WebP，
像素尺寸一个不变，体积大约降到 1/5。结果图导入时已经是 WebP，默认跳过。

    python3 scripts/slim_data.py --dry-run     # 先看能省多少，不动文件
    python3 scripts/slim_data.py               # 真的压，并改写 manifest 里的路径

原图被重新编码后就不再是上游的原始字节了（视觉上 q90 看不出差别，但严格来说是二次压缩）。
想还原就重新导入一次批次目录即可：
    python3 scripts/import_batch.py --src <批次目录> --model <模型名>
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public" / "data"
MANIFEST = DATA / "manifest.json"


def mb(n: float) -> str:
    return f"{n / 1024 / 1024:.1f}MB"


def main() -> None:
    ap = argparse.ArgumentParser(description="压缩 public/data 里的图片")
    ap.add_argument("--quality", type=int, default=90)
    ap.add_argument("--max-side", type=int, default=0, help="限制长边像素，0 表示不缩放")
    ap.add_argument("--results", action="store_true", help="连结果图一起重压（默认只压原图）")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not MANIFEST.is_file():
        raise SystemExit(f"找不到 {MANIFEST}")

    from PIL import Image

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    before = after = 0
    changed = 0

    targets: list[tuple[dict, str]] = []
    for case in manifest["cases"]:
        targets.append((case, "original"))
        if args.results:
            for r in case["results"]:
                targets.append((r, "file"))

    for holder, key in targets:
        rel = holder[key]
        src = DATA / rel
        if not src.is_file():
            print(f"跳过（文件不在）：{rel}")
            continue

        size_before = src.stat().st_size
        before += size_before

        with Image.open(src) as im:
            im = im.convert("RGB")
            w, h = im.size
            if args.max_side and max(w, h) > args.max_side:
                scale = args.max_side / max(w, h)
                im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
            dst = src.with_suffix(".webp")
            if args.dry_run:
                import io

                buf = io.BytesIO()
                im.save(buf, "WEBP", quality=args.quality, method=4)
                after += len(buf.getvalue())
                continue
            im.save(dst, "WEBP", quality=args.quality, method=4)

        after += dst.stat().st_size
        if dst != src:
            src.unlink()
        holder[key] = str(dst.relative_to(DATA))
        changed += 1
        print(f"{rel} → {holder[key]}  {size_before // 1024}KB → {dst.stat().st_size // 1024}KB")

    if args.dry_run:
        print(f"\n[预演] {len(targets)} 张：{mb(before)} → {mb(after)}（{after / max(before, 1) * 100:.0f}%）")
        return

    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n压了 {changed} 张：{mb(before)} → {mb(after)}（{after / max(before, 1) * 100:.0f}%）")
    print("manifest 里的路径已同步改写")


if __name__ == "__main__":
    main()
