#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把下载到的《心史》原书扫描转成站点用图。

输入：~/xinshi-scans/vol1/*.jpg、vol2/*.jpg
      由 scripts/fetch_xinshi_scans.py 下载的国立公文書館 3000px 双叶展开图
输出：xinshi/scans/v{1,2}-NNN.webp        1600px 宽，q84，阅读用（约 230KB/叶）
      xinshi/scans/thumb/v{1,2}-NNN.webp   256px 宽，q72，目录缩略图（约 5.9KB/叶）
      （缩略图 256px 对应栅格单元 104–117px，2× 视网膜仍有余量；原 320px 首屏 63 张
        要 532KB，降到 256px 后约 372KB。）

用法：
    python3 scripts/prep_xinshi_scans.py
    # 已转好的会自动跳过；改了尺寸/质量想重来，先删掉 xinshi/scans 下对应文件
    # 母本（~/xinshi-scans）若已删除，缩略图也可直接从 xinshi/scans/*.webp 重新缩：
    #   magick xinshi/scans/v1-060.webp -resize 256x -strip -quality 72 缩略图.webp

依赖 ImageMagick（magick 命令）。
"""

import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = Path.home() / "xinshi-scans"
OUT = ROOT / "xinshi" / "scans"
MAIN_WIDTH, MAIN_Q = 1600, 84       # 阅读用主图
THUMB_WIDTH, THUMB_Q = 256, 72      # 目录缩略图
WORKERS = 6
MIN_BYTES = 800           # 卷末近空白页的缩略图只有 1.2KB 左右，阈值须低于此以免误判失败

# 与 fetch_xinshi_scans.py 的 VIEWERS 对应：(源目录, 文件名前缀, 叶数)
VOLUMES = [
    ("vol1", "v1", 122),
    ("vol2", "v2", 125),
]


def convert(src, dest, width, quality):
    if dest.exists() and dest.stat().st_size > MIN_BYTES:
        return True
    subprocess.run(["magick", str(src), "-resize", f"{width}x", "-strip",
                    "-quality", str(quality), "-define", "webp:method=6", str(dest)],
                   capture_output=True, text=True)
    return dest.exists() and dest.stat().st_size > MIN_BYTES


def main():
    (OUT / "thumb").mkdir(parents=True, exist_ok=True)
    tasks = []
    for srcdir, prefix, count in VOLUMES:
        for n in range(1, count + 1):
            src = SRC / srcdir / f"{n:04d}.jpg"
            if not src.exists():
                print(f"缺少源文件: {src}（先跑 fetch_xinshi_scans.py）", file=sys.stderr)
                continue
            tasks.append((src, OUT / f"{prefix}-{n:03d}.webp",
                          OUT / "thumb" / f"{prefix}-{n:03d}.webp"))

    if not tasks:
        print("没有任何可转换的源文件，先跑 scripts/fetch_xinshi_scans.py", file=sys.stderr)
        return 1
    print(f"待转换 {len(tasks)} 叶")

    def work(t):
        src, big, thumb = t
        return (convert(src, big, MAIN_WIDTH, MAIN_Q)
                and convert(src, thumb, THUMB_WIDTH, THUMB_Q))

    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        results = list(ex.map(work, tasks))

    ok = sum(results)
    big = sum(f.stat().st_size for f in OUT.glob("*.webp"))
    th = sum(f.stat().st_size for f in (OUT / "thumb").glob("*.webp"))
    print(f"完成 {ok}/{len(tasks)}")
    print(f"阅读图 {big / 1024 / 1024:.1f} MB，缩略图 {th / 1024 / 1024:.1f} MB")
    return 0 if ok == len(tasks) else 1


if __name__ == "__main__":
    sys.exit(main())
