#!/usr/bin/env python3
"""检测原图在扩图结果中的真实位置（缩放 + 位移）。

有些扩图服务不是把原图按原始像素贴进大画布，而是整体重采样过，
甚至不居中（阿里 wanx2.1 的「非居中扩图」就是这样）。
这种情况下没法靠尺寸推算 frame，只能从像素里找。

做法是多尺度归一化互相关（NCC）：
  1. 粗搜：结果图缩到宽 128，原图按一串候选缩放比做模板，用 FFT 算全图 NCC，取最优
  2. 精搜：结果图缩到宽 512，在粗搜结果附近细化缩放比，同样用 FFT 全图搜位移
返回归一化的 [x, y, w, h] 和匹配得分（1.0 为完全一致）。

单独跑可以验证某一对图：
    python3 scripts/detect_frame.py 原图.jpg 结果.png
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    import numpy as np
except ImportError:  # pragma: no cover
    np = None  # type: ignore

COARSE_WIDTH = 128
FINE_WIDTH = 512
COARSE_RANGE = (0.20, 1.0)
COARSE_STEP = 0.01
FINE_SPAN = 0.025
FINE_STEP = 0.002


def available() -> bool:
    return np is not None


def _gray(path: Path, width: int):
    from PIL import Image

    with Image.open(path) as im:
        im = im.convert("L")
        h = max(1, round(im.height * width / im.width))
        arr = np.asarray(im.resize((width, h), Image.BILINEAR), dtype=np.float32)
    return arr


def _resize_gray(arr, tw: int, th: int):
    from PIL import Image

    im = Image.fromarray(arr.astype(np.uint8))
    return np.asarray(im.resize((tw, th), Image.BILINEAR), dtype=np.float32)


def _box_sums(arr, th: int, tw: int):
    """窗口和与窗口平方和，用积分图算，O(1) 每个位置"""
    pad = np.zeros((arr.shape[0] + 1, arr.shape[1] + 1), dtype=np.float64)
    pad[1:, 1:] = np.cumsum(np.cumsum(arr, axis=0), axis=1)
    s = (
        pad[th:, tw:]
        - pad[:-th, tw:]
        - pad[th:, :-tw]
        + pad[:-th, :-tw]
    )
    return s


# 局部对比度低于这个值（0~255 灰度）的窗口直接判无效：
# 纯黑/纯白的填充区算出来的相关系数全是噪声
MIN_LOCAL_STD = 1.0


def _ncc_map(R, T):
    """R 中所有合法位置上与模板 T 的归一化互相关，取值 [-1, 1]"""
    H, W = R.shape
    th, tw = T.shape
    if th > H or tw > W:
        return None

    n = th * tw
    t_std = float(T.std())
    if t_std < MIN_LOCAL_STD:
        return None

    # 模板先去均值：这样分子就是互相关本身，不用再做两个 1e9 量级的大数相减，
    # 否则 FFT 的浮点误差会在平坦区域被极小的分母放大成离谱的得分
    Tc = (T - T.mean()).astype(np.float64)
    R0 = (R - R.mean()).astype(np.float64)

    Tpad = np.zeros_like(R0)
    Tpad[:th, :tw] = Tc
    corr = np.fft.irfft2(np.fft.rfft2(R0) * np.conj(np.fft.rfft2(Tpad)), s=R0.shape)
    num = corr[: H - th + 1, : W - tw + 1]

    s1 = _box_sums(R0, th, tw)
    s2 = _box_sums(R0 * R0, th, tw)
    mean = s1 / n
    var = np.maximum(s2 / n - mean * mean, 0.0)
    std = np.sqrt(var)

    out = np.full(num.shape, -1.0, dtype=np.float64)
    ok = std > MIN_LOCAL_STD
    out[ok] = num[ok] / (n * std[ok] * t_std)
    return np.clip(out, -1.0, 1.0)


def _search(R, O_small, aspect: float, scales):
    """在给定缩放比候选里找最优 (score, f, x, y)，坐标是 R 上的像素"""
    H, W = R.shape
    best = (-2.0, 0.0, 0, 0)
    for f in scales:
        tw = int(round(W * f))
        th = int(round(tw * aspect))
        if tw < 8 or th < 8 or tw > W or th > H:
            continue
        T = _resize_gray(O_small, tw, th)
        m = _ncc_map(R, T)
        if m is None or m.size == 0:
            continue
        idx = int(np.argmax(m))
        y, x = divmod(idx, m.shape[1])
        score = float(m[y, x])
        if score > best[0]:
            best = (score, f, x, y)
    return best


def detect_frame(original: Path, result: Path) -> tuple[list[float], float] | None:
    """返回 ([x, y, w, h] 归一化, 匹配得分)；失败返回 None"""
    if np is None:
        return None

    from PIL import Image

    with Image.open(original) as im:
        ow, oh = im.size
    if not ow or not oh:
        return None
    aspect = oh / ow

    # 原图只需要一个够用的小副本当模板源
    O_small = _gray(original, 256)

    R_coarse = _gray(result, COARSE_WIDTH)
    coarse_scales = np.arange(COARSE_RANGE[0], COARSE_RANGE[1] + 1e-9, COARSE_STEP)
    c_score, c_f, _, _ = _search(R_coarse, O_small, aspect, coarse_scales)
    if c_score < -1:
        return None

    R_fine = _gray(result, FINE_WIDTH)
    fine_scales = np.arange(
        max(0.05, c_f - FINE_SPAN), min(1.0, c_f + FINE_SPAN) + 1e-9, FINE_STEP
    )
    f_score, f_f, f_x, f_y = _search(R_fine, O_small, aspect, fine_scales)
    if f_score < -1:
        return None

    Hf, Wf = R_fine.shape
    w = Wf * f_f
    h = w * aspect
    frame = [
        round(f_x / Wf, 6),
        round(f_y / Hf, 6),
        round(w / Wf, 6),
        round(h / Hf, 6),
    ]
    # 夹到 0~1，避免模型把原图截掉一点导致越界
    frame[0] = min(max(frame[0], 0.0), 1.0)
    frame[1] = min(max(frame[1], 0.0), 1.0)
    frame[2] = min(frame[2], 1.0 - frame[0])
    frame[3] = min(frame[3], 1.0 - frame[1])
    return frame, round(f_score, 4)


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    if np is None:
        sys.exit("需要 numpy：pip3 install numpy")
    out = detect_frame(Path(sys.argv[1]), Path(sys.argv[2]))
    if not out:
        sys.exit("检测失败")
    frame, score = out
    print(f"frame = {frame}")
    print(f"score = {score}")


if __name__ == "__main__":
    main()
