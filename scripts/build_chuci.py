#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成《楚辞》阅读模块（chuci/）。

数据源：/tmp/chuci_data.json（由 /tmp/crawl_gushiwen.py 抓取 古诗文网 得到，简→繁）。
页面结构参考 maoxuan/ 与 shijing/：目录页（17 篇平铺）+ 每篇独立正文页，复用 ../gushi/gushi.css 与 ../gushi/gushi.js。
目录页样式取自 maoxuan/index.html 的 <style>，配色改为「绛紫 + 金」（楚辞浪漫意象）。

用法：python3 scripts/build_chuci.py
"""

import json
import sys
from html import escape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from zh_toggle import TOGGLE_BTN, TOGGLE_CSS, TOGGLE_JS, s, zh_attrs  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DATA = Path("/tmp/chuci_data.json")
OUT = ROOT / "chuci"
SITE = "https://www.justgame.top"
BOOK = "楚辞"
DOMAIN_PATH = "/chuci"
DESC = "战国时期楚地诗歌总集，西汉刘向辑。以屈原《离骚》为代表，开浪漫主义的「楚辞体」，与《诗经》并称风骚。"

HEAD_ICON = (
    '<svg fill="none" height="30" stroke="currentColor" stroke-linecap="round" '
    'stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="30" '
    'xmlns="http://www.w3.org/2000/svg"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>'
    '<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>'
)

# 目录页主题配色：maoxuan 朱红 → 楚辞 绛紫/金
COLOR_MAP = [
    ("#b91c1c", "#6d2840"),
    ("rgba(185,28,28,", "rgba(109,40,64,"),
    ("#e08a2e", "#c9a227"),
    ("#f8f0f0", "#f6eef0"),
    ("#f3e7e7", "#efe2e7"),
    ("#f0f4f8", "#f4eef1"),
    ("rgba(250,242,242", "rgba(246,238,240"),
]

EXTRA_CSS = """
        .section-block { margin-top: 16px; }
        .section-head {
            display: flex; align-items: baseline; gap: 10px;
            padding: 0 0 8px 2px; border-bottom: 1px dashed rgba(109,40,64,0.22);
            margin-bottom: 10px;
        }
        .section-title { font-size: 15px; font-weight: 700; color: #6d2840; }
        .section-count { font-size: 11.5px; color: #8a9a90; }
        @media (prefers-color-scheme: dark) {
            .section-title { color: #c9a227; }
            .section-count { color: #94a3b8; }
            .section-head { border-color: rgba(148,163,184,0.3); }
        }
"""


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
        '<span class="ch-title"{t_att}>{title}</span></a>'.format(
            slug=a["slug"], tt=escape(s(a["title"])),
            no=i + 1, title=escape(s(a["title"])),
            t_att=zh_attrs(a["title"]),
        )
        for i, a in enumerate(arts)
    )
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>楚辞 · 战国楚地诗歌总集 全文在线阅读</title>
<meta name="description" content="《楚辞》西汉刘向辑，以屈原《离骚》为代表的楚地诗歌总集，十七篇全文在线阅读，含离骚、九歌、天问、九章、招魂等。">
<meta name="keywords" content="楚辞,离骚,九歌,天问,九章,屈原,楚辞体,诗经,集思阁">
<meta property="og:title" content="楚辞 · 十七篇">
<meta property="og:description" content="战国楚地诗歌总集，西汉刘向辑，十七篇全文在线阅读。">
<meta property="og:type" content="website">
<meta property="og:url" content="{SITE}{DOMAIN_PATH}/">
<meta property="og:image" content="{SITE}/assets/images/og-cover.png">
<meta property="og:site_name" content="集思阁">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#6d2840">
<link rel="canonical" href="{SITE}{DOMAIN_PATH}/">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "Book",
  "name": "楚辞",
  "url": "{SITE}{DOMAIN_PATH}/",
  "inLanguage": "zh-Hans",
  "author": {{ "@type": "Person", "name": "屈原 等（西汉刘向辑）" }},
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
楚辞
</div>
<a class="back-link" href="../index.html">← 返回首页</a>
{TOGGLE_BTN}
</div>
<div class="header-subtitle">西汉刘向辑 · 战国楚地诗歌总集 · 共 {total} 篇</div>
</div>
<div class="vol-block">
<div class="vol-desc"{zh_attrs(DESC)}>{escape(s(DESC))}</div>
<div class="section-block">
<div class="section-head"><span class="section-title">楚辞</span>
<span class="section-count">{total} 篇</span></div>
<div class="chapter-grid">{links}</div>
</div>
</div>
<div class="footer-count">楚辞 · 集思阁 · 共 {total} 篇</div>
</div>
<button class="top-btn" id="topBtn" onclick="window.scrollTo({{top:0,behavior:'smooth'}})" title="返回顶部">↑</button>
<script src="../gushi/gushi.js"></script>
{TOGGLE_JS}</body>
</html>
"""


def build_article(a, prev_a, next_a, meta):
    body = "".join(
        '<p{p_att}>{text}</p>'.format(p_att=zh_attrs(p), text=escape(s(p)))
        for p in a["paras"]
    )
    prev_link = (
        f'<a href="{prev_a["slug"]}.html" class="prev">← 上一篇</a>'
        if prev_a else '<a class="prev empty" href="#">← 上一篇</a>'
    )
    next_link = (
        f'<a href="{next_a["slug"]}.html" class="next">下一篇 →</a>'
        if next_a else '<a class="next empty" href="#">下一篇 →</a>'
    )
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{escape(s(a['title']))} - 楚辞</title>
<meta name="description" content="{escape(s(a['title']))}：{escape(s(''.join(a['paras'])[:76]))}">
<meta name="keywords" content="楚辞,{escape(s(a['title']))},屈原,楚辞体,集思阁">
<meta property="og:title" content="{escape(s(a['title']))}">
<meta property="og:description" content="{escape(s(''.join(a['paras'])[:76]))}">
<meta property="og:type" content="article">
<meta property="og:url" content="{SITE}{DOMAIN_PATH}/{a['slug']}.html">
<meta property="og:image" content="{SITE}/assets/images/og-cover.png">
<meta property="og:site_name" content="集思阁">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#6d2840">
<link rel="canonical" href="{SITE}{DOMAIN_PATH}/{a['slug']}.html">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../gushi/gushi.css">
<style>{TOGGLE_CSS}</style>
</head>
<body>
<div class="container">
  <div class="article">
    <div class="top-bar">
      <a href="./" class="back-link">← 返回楚辞</a>
      <span class="meta">楚辞</span>
      {TOGGLE_BTN}
    </div>
    <h1{zh_attrs(a['title'])}>{escape(s(a['title']))}</h1>
    <div class="meta">楚辞 · 集思阁</div>
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
    (OUT / "index.html").write_text(build_index(data), encoding="utf-8")
    for idx, a in enumerate(arts):
        prev_a = arts[idx - 1] if idx > 0 else None
        next_a = arts[idx + 1] if idx < len(arts) - 1 else None
        (OUT / f"{a['slug']}.html").write_text(
            build_article(a, prev_a, next_a, "楚辞"), encoding="utf-8"
        )
    print(f"生成完成：{len(arts)} 篇 + 目录页 → {OUT}")


if __name__ == "__main__":
    main()
