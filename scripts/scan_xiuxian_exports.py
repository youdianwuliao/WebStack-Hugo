#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""第一遍扫描：把 xiuxian/ 下导出压缩包解出的 PNG 整幅 OCR，挑出含「者也」的篇目。

依赖：rapidocr-onnxruntime（pip 装在独立 venv 里，系统 Python 是 externally-managed）。
    python3 -m venv <workdir>/venv && <workdir>/venv/bin/pip install rapidocr-onnxruntime
    <workdir>/venv/bin/python scripts/scan_xiuxian_exports.py

输入：<workdir>/all/*.png（xiuxian/ 下各 export_*.zip 解压去重后的图片）
输出：<workdir>/ocr/all.jsonl（文件名 -> 全文）、<workdir>/ocr/skipped_sport.txt（按题意跳过的赛事类篇目）

workdir 取脚本里的 SRC/OUT 常量，默认 /home/zhaosl/tmp_xiuxian。

注：2026-09-24 成书后，xiuxian/ 源压缩包与临时工作区已按用户要求删除，
只保留了成书所需的中间产物（scripts/data/buzaisanjiezhong/）。若要重跑本脚本，
需先把 xiuxian/ 的导出压缩包放回并解压到 workdir/all。
"""
import glob
import json
import os
import sys
import time
from multiprocessing import Pool

SRC = '/home/zhaosl/tmp_xiuxian/all'
OUT = '/home/zhaosl/tmp_xiuxian/ocr'
SLICE = 2400        # 送识别的纵向切片高度
OVERLAP = 120
TILE = 256          # 彩色检测小块高度
COLOR_THR = 999.0

import numpy as np


def colorfulness(tile):
    r = tile[:, :, 0].astype(np.int16)
    g = tile[:, :, 1].astype(np.int16)
    b = tile[:, :, 2].astype(np.int16)
    return (np.abs(r - g).mean() + np.abs(g - b).mean() + np.abs(r - b).mean()) / 3.0


def prepare(arr):
    """把彩色块涂白，返回处理后的数组。"""
    h = arr.shape[0]
    out = arr.copy()
    colorful = 0
    total = 0
    for y in range(0, h, TILE):
        y2 = min(y + TILE, h)
        tile = arr[y:y2]
        total += 1
        if colorfulness(tile) > COLOR_THR:
            out[y:y2] = 255
            colorful += 1
    return out, colorful, total


def ocr_one(path):
    from PIL import Image
    from rapidocr_onnxruntime import RapidOCR

    Image.MAX_IMAGE_PIXELS = None
    engine = RapidOCR(intra_op_num_threads=1, **{'Rec.rec_batch_num': 32})
    t0 = time.time()
    img = Image.open(path).convert('RGB')
    arr_full = np.array(img)
    del img
    h, w = arr_full.shape[:2]
    lines = []
    y = 0
    while y < h:
        y2 = min(y + SLICE, h)
        prep, colorful, total = prepare(arr_full[y:y2])
        res, _ = engine(prep[:, :, ::-1])
        if res:
            for box, text, _score in res:
                ys = min(p[1] for p in box)
                lines.append((y + ys, text))
        if y2 >= h:
            break
        y = y2 - OVERLAP
    lines.sort(key=lambda t: t[0])
    out = []
    for _, t in lines:
        if out and t in out[-3:]:
            continue
        out.append(t)
    return os.path.basename(path), '\n'.join(out), time.time() - t0


def main():
    files = sorted(glob.glob(os.path.join(SRC, '*.png')))
    if len(sys.argv) > 1:
        files = [f for f in files if os.path.basename(f).startswith(sys.argv[1])]
    os.makedirs(OUT, exist_ok=True)
    outpath = os.path.join(OUT, 'all.jsonl')
    done = set()
    if os.path.exists(outpath):
        with open(outpath, encoding='utf-8') as f:
            for line in f:
                try:
                    done.add(json.loads(line)['file'])
                except Exception:
                    pass
    todo = [f for f in files if os.path.basename(f) not in done]
    # 赛事竞猜类属于公众号自撰内容，与知乎截图无关，整批跳过（用户 2026-09-24 确认「其他的可以忽略」）
    SPORT = ('世界杯', '竞彩', '预测', '战报', '前瞻', '平局', '淘汰', '葡萄牙', '法国', '西班牙',
             '阿根廷', '挪威', '巴西', '摩洛哥', '英格兰', '刚果', '荷兰', '德国', '意大利',
             '哥伦比亚', '乌兹别克', '约旦', '阿尔及利亚', '奥地利', '伊拉克', '比利时', '埃及')
    skipped = [f for f in todo if any(k in os.path.basename(f) for k in SPORT)]
    todo = [f for f in todo if f not in skipped]
    with open(os.path.join(OUT, 'skipped_sport.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(sorted(os.path.basename(f) for f in skipped)))
    todo.sort(key=lambda f: os.path.basename(f))
    print(f'total={len(files)} todo={len(todo)} skipped={len(skipped)}', flush=True)
    with open(outpath, 'a', encoding='utf-8') as fout, Pool(4) as pool:
        for i, (name, text, secs) in enumerate(pool.imap_unordered(ocr_one, todo), 1):
            fout.write(json.dumps({'file': name, 'text': text}, ensure_ascii=False) + '\n')
            fout.flush()
            print(f'[{i}/{len(todo)}] {secs:5.1f}s {name} ({len(text)}字)', flush=True)


if __name__ == '__main__':
    main()
