#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成《檄文》阅读模块（xiwen/）。

数据源：/tmp/xu_data.json（三篇讨胡檄文，存繁体原文）。
页面结构参考 chuci/：目录页（3 篇平铺）+ 每篇独立正文页，复用 ../gushi/gushi.css 与 ../gushi/gushi.js。

正文默认以**简体**呈现（数据原文为繁体，构建时繁→简），
并在元素上用 data-t2t 保留繁体，可一键切回（见 zh_toggle.py）。

用法：python3 scripts/build_xiwen.py
"""

import json
import re
import sys
from html import escape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from zh_toggle import TOGGLE_BTN, TOGGLE_CSS, TOGGLE_JS, s, zh_attrs  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DATA = Path("/tmp/xu_data.json")
OUT = ROOT / "xiwen"
SITE = "https://www.justgame.top"
BOOK = "檄文"
DOMAIN_PATH = "/xiwen"
# 繁体源文本；输出统一经 s() 转简体，繁体由 zh_attrs() 保留供切换
DESC = "歷代討胡檄文三篇：朱元璋《諭中原檄》（1367）驅元、楊秀清與蕭朝貴奉天王洪秀全命頒《奉天討胡檄布四方諭》（1852）反清、孫中山《奉天討滿檄文》（1911）革命，皆以「驅逐異族、恢復中華」為幟。"

HEAD_ICON = (
    '<svg fill="none" height="30" stroke="currentColor" stroke-linecap="round" '
    'stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="30" '
    'xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>'
    '<path d="M14 2v6h6"></path><path d="M8 13h8"></path><path d="M8 17h8"></path>'
    '<path d="M8 9h2"></path></svg>'
)

# 目录页主题配色：毛选朱红 → 檄文 朱砂/描金（军政檄文意象）
COLOR_MAP = [
    ("#b91c1c", "#9b2226"),
    ("rgba(185,28,28,", "rgba(155,34,38,"),
    ("#e08a2e", "#b8893f"),
    ("#f8f0f0", "#f7eef0"),
    ("#f3e7e7", "#f3e7e7"),
    ("#f0f4f8", "#f6f1ea"),
    ("rgba(250,242,242", "rgba(247,238,240"),
]

EXTRA_CSS = """
        .section-block { margin-top: 16px; }
        .section-head {
            display: flex; align-items: baseline; gap: 10px;
            padding: 0 0 8px 2px; border-bottom: 1px dashed rgba(155,34,38,0.22);
            margin-bottom: 10px;
        }
        .section-title { font-size: 15px; font-weight: 700; color: #9b2226; }
        .section-count { font-size: 11.5px; color: #8a9a90; }
        .chapter-meta { font-size: 11.5px; color: #a08a55; margin-left: auto; }
        @media (prefers-color-scheme: dark) {
            .section-title { color: #c9a227; }
            .section-count { color: #94a3b8; }
            .chapter-meta { color: #b8893f; }
            .section-head { border-color: rgba(148,163,184,0.3); }
        }
"""


def split_paras(body):
    """将连续正文按句读切分为若干段落（每约两句一段）。"""
    if not body:
        return []
    parts = re.split(r"(?<=[。！？!?])", body)
    parts = [p.strip() for p in parts if p.strip()]
    paras = []
    buf = []
    for p in parts:
        buf.append(p)
        if len(buf) >= 2:
            paras.append("".join(buf))
            buf = []
    if buf:
        paras.append("".join(buf))
    return paras


def load_index_style():
    src = (ROOT / "maoxuan" / "index.html").read_text(encoding="utf-8")
    css = src[src.find("<style>") + 7: src.find("</style>")]
    for old, new in COLOR_MAP:
        css = css.replace(old, new)
    return css + EXTRA_CSS


def build_index(data):
    arts = data["articles"]
    total = len(arts)
    links = "".join(
        '<a class="chapter-item" href="{slug}.html" title="{tt}">'
        '<span class="ch-num">第{no}篇</span>'
        '<span class="ch-title"{t_att}>{title}</span>'
        '<span class="chapter-meta"{a_att}>{author} · {year}</span></a>'.format(
            slug=a["slug"], tt=escape(s(a["title"])),
            no=i + 1, title=escape(s(a["title"])),
            author=escape(s(a["author"])), year=a["year"],
            t_att=zh_attrs(a["title"]),
            a_att=zh_attrs("{} · {}".format(a["author"], a["year"])),
        )
        for i, a in enumerate(arts)
    )
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{escape(s('檄文 · 歷代討胡檄文 全文在線閱讀'))}</title>
<meta name="description" content="{escape(s('《檄文》集歷代討胡三檄：朱元璋《諭中原檄》、楊秀清與蕭朝貴《奉天討胡檄布四方諭》、孫中山《奉天討滿檄文》，全文在線閱讀。'))}">
<meta name="keywords" content="{escape(s('檄文,諭中原檄,奉天討胡檄,奉天討胡檄布四方諭,奉天討滿檄文,朱元璋,洪秀全,楊秀清,蕭朝貴,孫中山,集思阁'))}">
<meta property="og:title" content="{escape(s('檄文 · 歷代討胡檄文'))}">
<meta property="og:description" content="{escape(s('集歷代討胡三檄，全文在線閱讀。'))}">
<meta property="og:type" content="website">
<meta property="og:url" content="{SITE}{DOMAIN_PATH}/">
<meta property="og:image" content="{SITE}/assets/images/og-cover.png">
<meta property="og:site_name" content="集思阁">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#9b2226">
<link rel="canonical" href="{SITE}{DOMAIN_PATH}/">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "Book",
  "name": "檄文",
  "url": "{SITE}{DOMAIN_PATH}/",
  "inLanguage": "zh-Hans",
  "author": {{ "@type": "Person", "name": "朱元璋 等" }},
  "isPartOf": {{ "@type": "WebSite", "name": "集思阁", "url": "{SITE}/" }},
  "numberOfPages": {total}
}}
</script>
<style>{load_index_style()}{TOGGLE_CSS}</style>
</head>
<body>
<div class="container">
<div class="header-section">
<div class="page-header">
<div class="header-title">
{HEAD_ICON}
檄文
</div>
<a class="back-link" href="../index.html">← 返回首页</a>
{TOGGLE_BTN}
</div>
<div class="header-subtitle">{escape(s('歷代討胡檄文'))} · 共 {total} 篇</div>
</div>
<div class="vol-block">
<div class="vol-desc"{zh_attrs(DESC)}>{escape(s(DESC))}</div>
<div class="section-block">
<div class="section-head"><span class="section-title">檄文</span>
<span class="section-count">{total} 篇</span></div>
<div class="chapter-grid">{links}</div>
</div>
</div>
<div class="footer-count">檄文 · 集思阁 · 共 {total} 篇</div>
</div>
<button class="top-btn" id="topBtn" onclick="window.scrollTo({{top:0,behavior:'smooth'}})" title="返回顶部">↑</button>
<script src="../gushi/gushi.js"></script>
{TOGGLE_JS}</body>
</html>
"""


def build_article(a, prev_a, next_a, meta):
    paras = a.get("paras") or split_paras(a.get("body"))
    body = "".join(
        '<p{p_att}>{text}</p>'.format(p_att=zh_attrs(p), text=escape(s(p)))
        for p in paras
    )
    prev_link = (
        f'<a href="{prev_a["slug"]}.html" class="prev">← 上一篇</a>'
        if prev_a else '<a class="prev empty" href="#">← 上一篇</a>'
    )
    next_link = (
        f'<a href="{next_a["slug"]}.html" class="next">下一篇 →</a>'
        if next_a else '<a class="next empty" href="#">下一篇 →</a>'
    )
    meta_trad = f'{a["author"]} · {a["year"]}'
    meta_line = escape(s(meta_trad))
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{escape(s(a['title']))} - 檄文</title>
<meta name="description" content="{escape(s(a['title']))}：{escape(s(''.join(paras)[:76]))}">
<meta name="keywords" content="{escape(s('檄文,' + a['title'] + ',' + a['author'] + ',集思阁'))}">
<meta property="og:title" content="{escape(s(a['title']))}">
<meta property="og:description" content="{escape(s(''.join(paras)[:76]))}">
<meta property="og:type" content="article">
<meta property="og:url" content="{SITE}{DOMAIN_PATH}/{a['slug']}.html">
<meta property="og:image" content="{SITE}/assets/images/og-cover.png">
<meta property="og:site_name" content="集思阁">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#9b2226">
<link rel="canonical" href="{SITE}{DOMAIN_PATH}/{a['slug']}.html">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../gushi/gushi.css">
<style>{TOGGLE_CSS}</style>
</head>
<body>
<div class="container">
  <div class="article">
    <div class="top-bar">
      <a href="./" class="back-link">← 返回檄文</a>
      <span class="meta">檄文</span>
      {TOGGLE_BTN}
    </div>
    <h1{zh_attrs(a['title'])}>{escape(s(a['title']))}</h1>
    <div class="meta"{zh_attrs(meta_trad + ' · 集思阁')}>{meta_line} · 集思阁</div>
    <div class="article-body">
{body}
    </div>
    <div class="pager">
      {prev_link}
      {next_link}
    </div>
  </div>
</div>
<button class="top-btn" id="topBtn" onclick="window.scrollTo({{top:0,behavior:'smooth'}})" title="返回顶部">↑</button>
<script src="../gushi/gushi.js"></script>
{TOGGLE_JS}</body>
</html>
"""


def main():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    OUT.mkdir(exist_ok=True)
    arts = data["articles"]
    missing = [a["slug"] for a in arts if not a.get("body")]
    (OUT / "index.html").write_text(build_index(data), encoding="utf-8")
    for idx, a in enumerate(arts):
        if not a.get("body"):
            print(f"跳过（正文缺失）：{a['slug']}.html")
            continue
        prev_a = arts[idx - 1] if idx > 0 else None
        next_a = arts[idx + 1] if idx < len(arts) - 1 else None
        (OUT / f"{a['slug']}.html").write_text(
            build_article(a, prev_a, next_a, "檄文"), encoding="utf-8"
        )
    done = [a["slug"] for a in arts if a.get("body")]
    print(f"生成完成：{len(done)} 篇 + 目录页 → {OUT}" + (f"（缺失：{missing}）" if missing else ""))


if __name__ == "__main__":
    main()
