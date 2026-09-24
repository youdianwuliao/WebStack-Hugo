#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把《不在三界中》各篇的原始截图转成 WebP 存入 buzaisanjiezhong/scans/，并生成清单。

- 单张高度 > 15000px 的（WebP 上限 16383）按 12000px 切片、留 200px 重叠，命名 bzsjNN-1/2。
- 输出清单 ocr/scans_manifest.json：{源文件名: [稿件相对路径, ...]}，供 build 脚本挂「查看原图」链接。

用法：python3 scripts/prep_buzaisanjiezhong_scans.py
"""
import json
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = '/home/zhaosl/tmp_xiuxian'
SRC = os.path.join(WORK, 'all')
TITLES = os.path.join(WORK, 'ocr', 'chapter_titles.json')
MANIFEST = os.path.join(WORK, 'ocr', 'scans_manifest.json')
OUTDIR = os.path.join(ROOT, 'buzaisanjiezhong', 'scans')

PART = 12000
OVERLAP = 200
QUALITY = 88


def main():
    titles = json.load(open(TITLES, encoding='utf-8'))
    ordered = sorted(titles, key=lambda f: int(f.rsplit('_', 1)[1].split('.')[0]))
    os.makedirs(OUTDIR, exist_ok=True)
    manifest = {}
    for idx, f in enumerate(ordered, 1):
        src = os.path.join(SRC, f)
        h = int(subprocess.run(['magick', 'identify', '-format', '%h', src],
                               capture_output=True, text=True).stdout)
        parts = []
        if h <= 15000:
            out = 'bzsj{:02d}.webp'.format(idx)
            subprocess.run(['magick', src, '-quality', str(QUALITY),
                            '-define', 'webp:method=6', os.path.join(OUTDIR, out)], check=True)
            parts.append(out)
        else:
            y, n = 0, 1
            while y < h:
                y2 = min(y + PART, h)
                out = 'bzsj{:02d}-{}.webp'.format(idx, n)
                subprocess.run(['magick', src, '-crop', '1280x{}+0+{}'.format(y2 - y, y),
                                '+repage', '-quality', str(QUALITY),
                                '-define', 'webp:method=6', os.path.join(OUTDIR, out)], check=True)
                parts.append(out)
                if y2 >= h:
                    break
                y = y2 - OVERLAP
                n += 1
        manifest[f] = parts
        size = sum(os.path.getsize(os.path.join(OUTDIR, p)) for p in parts)
        print('{:02d} {} {:.1f}MB -> {}'.format(idx, f, size / 1048576, ' '.join(parts)), flush=True)
    json.dump(manifest, open(MANIFEST, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    total = sum(os.path.getsize(os.path.join(OUTDIR, p))
                for ps in manifest.values() for p in ps)
    print('共 {} 个文件 {:.0f}MB，清单写入 {}'.format(
        sum(len(v) for v in manifest.values()), total / 1048576, MANIFEST))


if __name__ == '__main__':
    main()
