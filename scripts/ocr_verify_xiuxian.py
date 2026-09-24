#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""第三遍校验：对命中篇目换一套检测参数（2 倍放大 + det_limit_side_len=1472）重跑，
与第二遍逐行 difflib 比对，只把「分歧块」挑出来人工核对——两遍一致即高置信。

输入：<workdir>/all/*.png、<workdir>/ocr/paras.jsonl
输出：<workdir>/ocr/verify.jsonl（file / lines / diff）

注：源图与临时工作区已于 2026-09-24 删除，重跑需先还原 workdir。
"""
import difflib
import json
import re
import os
from multiprocessing import Pool

import numpy as np

SRC = '/home/zhaosl/tmp_xiuxian/all'
OUT = '/home/zhaosl/tmp_xiuxian/ocr'
SLICE = 2400          # 原图切片高度（放大前）
OVERLAP = 160


def ocr_one(path):
    import cv2
    from PIL import Image
    from rapidocr_onnxruntime import RapidOCR

    Image.MAX_IMAGE_PIXELS = None
    engine = RapidOCR(intra_op_num_threads=1, det_limit_side_len=1472)
    arr = np.array(Image.open(path).convert('RGB'))
    h = arr.shape[0]
    lines = []
    y = 0
    while y < h:
        y2 = min(y + SLICE, h)
        big = cv2.resize(arr[y:y2], None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
        res, _ = engine(big[:, :, ::-1])
        if res:
            for box, text, _s in res:
                ys = [p[1] / 2 for p in box]
                y0 = y + min(ys)
                if y > 0 and y0 < y + OVERLAP:
                    continue
                lines.append((y0, text.strip()))
        if y2 >= h:
            break
        y = y2 - OVERLAP
    lines.sort(key=lambda t: t[0])
    return os.path.basename(path), [t for _, t in lines if t]


def main():
    names = json.load(open(os.path.join(OUT, 'hits.json'), encoding='utf-8'))
    files = [os.path.join(SRC, n) for n in names]
    # 第二遍结果（按文件汇总所有行）
    base = {}
    for line in open(os.path.join(OUT, 'paras.jsonl'), encoding='utf-8'):
        d = json.loads(line)
        texts = []
        for it in d['items']:
            if it['q']:
                texts.append(it['q'])
            for p in it['paras']:
                texts.extend(p if len(p) > 1 else [p[0]])
        base[d['file']] = texts

    outpath = os.path.join(OUT, 'verify.jsonl')
    if os.path.exists(outpath):
        os.remove(outpath)
    with open(outpath, 'a', encoding='utf-8') as fout, Pool(4) as pool:
        for i, (name, lines) in enumerate(pool.imap_unordered(ocr_one, files), 1):
            a = [re.sub(r'\s+', '', x) for x in base.get(name, [])]
            b = [re.sub(r'\s+', '', x) for x in lines]
            diff = []
            sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
            for tag, i1, i2, j1, j2 in sm.get_opcodes():
                if tag == 'equal':
                    continue
                diff.append({'a': a[i1:i2], 'b': b[j1:j2]})
            fout.write(json.dumps({'file': name, 'lines': lines, 'diff': diff},
                                  ensure_ascii=False) + '\n')
            fout.flush()
            print(f'[{i}/{len(files)}] {name} 差异块 {len(diff)}', flush=True)


if __name__ == '__main__':
    main()
