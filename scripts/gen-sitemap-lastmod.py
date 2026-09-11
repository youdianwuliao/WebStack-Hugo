#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""为 sitemap.xml 回填 <lastmod>。

搜索引擎按 lastmod 判断增量抓取，缺这个字段等于每次全量重抓。
日期取 Git 里该文件的最后一次提交时间；无提交记录的退回文件 mtime。

用法：python3 scripts/gen-sitemap-lastmod.py
"""
import datetime as dt
import os
import re
import subprocess
import xml.etree.ElementTree as ET

NS = 'http://www.sitemaps.org/schemas/sitemap/0.9'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITEMAP = os.path.join(ROOT, 'sitemap.xml')
HOST = 'https://www.justgame.top/'


def git_commit_dates():
    """一次遍历仓库历史，拿到每个文件路径的最后提交日期。"""
    try:
        out = subprocess.run(
            ['git', 'log', '--pretty=format:%cI', '--name-only', '--no-renames'],
            cwd=ROOT, capture_output=True, text=True, check=True,
        ).stdout
    except (subprocess.CalledProcessError, FileNotFoundError):
        return {}
    dates = {}
    current = None
    for line in out.splitlines():
        if not line.strip():
            continue
        if re.fullmatch(r'\d{4}-\d{2}-\d{2}T[\d:+]+[-+]\d{2}:\d{2}', line):
            current = line
        elif current and line not in dates:
            # git log 时间倒序，首次出现即最后一次提交
            dates[line] = current
    return dates


def local_path(loc):
    path = loc[len(HOST):].lstrip('/') if loc.startswith(HOST) else loc.lstrip('/')
    path = path.split('#')[0].split('?')[0]
    if not path or path.endswith('/'):
        path += 'index.html'
    return path


def main():
    dates = git_commit_dates()
    ET.register_namespace('', NS)
    tree = ET.parse(SITEMAP)
    root = tree.getroot()
    missing = []
    filled = 0
    for url in root.findall(f'{{{NS}}}url'):
        loc = url.find(f'{{{NS}}}loc')
        if loc is None:
            continue
        old = url.find(f'{{{NS}}}lastmod')
        if old is not None:
            url.remove(old)
        rel = local_path(loc.text or '')
        stamp = dates.get(rel)
        if not stamp:
            full = os.path.join(ROOT, rel)
            if os.path.exists(full):
                stamp = dt.datetime.fromtimestamp(
                    os.path.getmtime(full), dt.timezone.utc
                ).replace(microsecond=0).isoformat().replace('+00:00', '+00:00')
            else:
                missing.append(rel)
                continue
        el = ET.Element(f'{{{NS}}}lastmod')
        el.text = stamp[:10]
        url.insert(list(url).index(loc) + 1, el)
        filled += 1
    tree.write(SITEMAP, encoding='UTF-8', xml_declaration=True)
    print(f'已回填 lastmod: {filled} 条')
    if missing:
        print(f'本地找不到文件，已跳过 {len(missing)} 条:')
        for m in missing[:10]:
            print('  ' + m)


if __name__ == '__main__':
    main()
