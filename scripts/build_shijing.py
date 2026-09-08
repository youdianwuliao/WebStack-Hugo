#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成站内的《诗经》阅读模块（shijing/）。

数据源：shijing/shijing.json（chinese-poetry 诗经全本，305 篇）
页面结构与 maoxuan/ 保持一致：目录页 + 每篇独立正文页，复用 ../gushi/gushi.css 与 ../gushi/gushi.js。
目录页样式取自 maoxuan/index.html 的 <style>，并按主题配色做替换。

用法：python3 scripts/build_shijing.py
"""

import json
import re
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "shijing" / "shijing.json"
OUT = ROOT / "shijing"
SITE = "https://www.justgame.top"
BOOK = "诗经"

GROUP_ORDER = [
    ("国风", "guofeng", "各地土风民歌，十五国风，共 160 篇，含《关雎》《蒹葭》《氓》。"),
    ("小雅", "xiaoya", "宫廷宴飨乐歌，多出自士大夫之手，共 74 篇，含《鹿鸣》《采薇》。"),
    ("大雅", "daya", "朝会宴飨与周族史诗，共 31 篇，含《文王》《生民》《公刘》。"),
    ("颂", "song", "宗庙祭祀乐歌，周颂 31 篇、鲁颂 4 篇、商颂 5 篇，共 40 篇。"),
]

# 数据源中的 “周颂/鲁颂/商颂” 归入 “颂”
GROUP_MAP = {"周颂": "颂", "鲁颂": "颂", "商颂": "颂"}

# 目录页主题配色：maoxuan 朱红 → 诗经 竹青
COLOR_MAP = [
    ("#b91c1c", "#2f6e4f"),
    ("rgba(185,28,28,", "rgba(47,110,79,"),
    ("#e08a2e", "#c9973f"),
    ("#f8f0f0", "#eff5f0"),
    ("#f3e7e7", "#e6efe8"),
    ("#f0f4f8", "#f2f6f1"),
    ("rgba(250,242,242", "rgba(240,247,241"),
]

EXTRA_CSS = """
        .section-block { margin-bottom: 16px; }
        .section-block:last-child { margin-bottom: 0; }
        .section-head {
            display: flex; align-items: baseline; gap: 10px;
            padding: 0 0 8px 2px; border-bottom: 1px dashed rgba(47,110,79,0.22);
            margin-bottom: 10px;
        }
        .section-title { font-size: 15px; font-weight: 700; color: #2f6e4f; }
        .section-count { font-size: 11.5px; color: #8a9a90; }
        .vol-count-badge { font-size: 11.5px; color: #8a9a90; margin-left: 8px; }
        @media (prefers-color-scheme: dark) {
            .section-title { color: #c9973f; }
            .section-count, .vol-count-badge { color: #94a3b8; }
            .section-head { border-color: rgba(148,163,184,0.3); }
        }
"""

HEAD_ICON = (
    '<svg fill="none" height="30" stroke="currentColor" stroke-linecap="round" '
    'stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="30" '
    'xmlns="http://www.w3.org/2000/svg"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>'
    '<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>'
)


def load_index_style():
    """取 maoxuan 目录页样式做基底，替换配色后追加分部（section）样式。"""
    src = (ROOT / "maoxuan" / "index.html").read_text(encoding="utf-8")
    css = src[src.find("<style>") + 7: src.find("</style>")]
    for old, new in COLOR_MAP:
        css = css.replace(old, new)
    return css + EXTRA_CSS


def load_poems():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    poems = []
    for item in data:
        chapter = item["chapter"].strip()
        group = GROUP_MAP.get(chapter, chapter)
        poems.append({
            "title": item["title"].strip(),
            "chapter": chapter,
            "group": group,
            "section": item["section"].strip(),
            "content": [line.strip() for line in item["content"] if line.strip()],
        })
    return poems


def assign_slugs(poems):
    """按 国风/小雅/大雅/颂 分组连续编号，生成文件名 slug。"""
    slugs = {}
    counter = {}
    for item in poems:
        prefix = next(p for g, p, _ in GROUP_ORDER if g == item["group"])
        n = counter.get(item["group"], 0) + 1
        counter[item["group"]] = n
        slug = f"{prefix}-{n:03d}"
        item["slug"] = slug
        item["no"] = n
        slugs[slug] = item
    return slugs


def brief(item, limit=76):
    text = "".join(item["content"])
    return text[:limit] + ("…" if len(text) > limit else "")


def build_index(poems):
    total = len(poems)
    counts = {g: sum(1 for p in poems if p["group"] == g) for g, _, _ in GROUP_ORDER}

    blocks = []
    for group, _prefix, desc in GROUP_ORDER:
        items = [p for p in poems if p["group"] == group]
        sections = []
        for item in items:
            if not sections or sections[-1][0]["section"] != item["section"]:
                sections.append((item, [item]))
            else:
                sections[-1][1].append(item)
        inner = []
        for head, members in sections:
            links = "".join(
                '<a class="chapter-item" href="{slug}.html" title="{section} · {title}">'
                '<span class="ch-num">第{no}篇</span>{title}</a>'.format(
                    slug=p["slug"], section=escape(p["section"]), title=escape(p["title"]), no=p["no"]
                )
                for p in members
            )
            inner.append(
                '<div class="section-block">'
                '<div class="section-head"><span class="section-title">{sec}</span>'
                '<span class="section-count">{n} 篇</span></div>'
                '<div class="chapter-grid">{links}</div></div>'.format(
                    sec=escape(head["section"]), n=len(members), links=links
                )
            )
        blocks.append(
            '<div class="vol-block">\n'
            '<div class="vol-head"><span class="vol-title">{group}</span>'
            '<span class="vol-count">{n} 篇</span></div>\n'
            '<div class="vol-desc">{desc}</div>\n'
            "{inner}</div>".format(group=group, n=counts[group], desc=desc, inner="".join(inner))
        )

    sub = " · ".join(f"{g} {counts[g]}" for g, _, _ in GROUP_ORDER)
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>诗经 · 三百零五篇全集在线阅读</title>
<meta name="description" content="中国最早诗歌总集，收录周初至春秋中叶诗歌 305 篇，分风、雅、颂三部分，含《关雎》《蒹葭》《氓》《采薇》等名篇全文。">
<meta name="keywords" content="诗经,诗三百,国风,小雅,大雅,周颂,关雎,蒹葭,古诗,先秦文学,集思阁">
<meta property="og:title" content="诗经 · 三百零五篇全集">
<meta property="og:description" content="中国最早诗歌总集，305 篇全文在线阅读，分风、雅、颂三部分。">
<meta property="og:type" content="website">
<meta property="og:url" content="{SITE}/shijing/">
<meta property="og:image" content="{SITE}/assets/images/og-cover.png">
<meta property="og:site_name" content="集思阁">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#2f6e4f">
<link rel="canonical" href="{SITE}/shijing/">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "Book",
  "name": "诗经",
  "alternateName": "诗三百",
  "url": "{SITE}/shijing/",
  "inLanguage": "zh-CN",
  "author": {{ "@type": "Person", "name": "周代佚名" }},
  "isPartOf": {{ "@type": "WebSite", "name": "集思阁", "url": "{SITE}/" }},
  "numberOfPages": 305
}}
</script>
<style>{load_index_style()}</style>
</head>
<body>
<div class="container">
<div class="header-section">
<div class="page-header">
<div class="header-title">
{HEAD_ICON}
诗经
</div>
<a class="back-link" href="../index.html">← 返回首页</a>
</div>
<div class="header-subtitle">中国最早的诗歌总集 · 共 {total} 篇 · {sub}</div>
</div>
{''.join(blocks)}
<div class="footer-count">诗经 · 集思阁 · 共 {total} 篇</div>
</div>
<button class="top-btn" id="topBtn" onclick="window.scrollTo({{top:0,behavior:'smooth'}})" title="返回顶部">↑</button>
<script src="../gushi/gushi.js"></script>
</body>
</html>
"""


def build_poem(item, prev_item, next_item):
    body = "".join(f"<p>{escape(line)}</p>" for line in item["content"])
    full = f"{item['chapter']} · {item['section']}"
    desc = brief(item)
    prev_link = (
        f'<a href="{prev_item["slug"]}.html" class="prev">← 上一篇</a>'
        if prev_item
        else '<a class="prev empty" href="#">← 上一篇</a>'
    )
    next_link = (
        f'<a href="{next_item["slug"]}.html" class="next">下一篇 →</a>'
        if next_item
        else '<a class="next empty" href="#">下一篇 →</a>'
    )
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{escape(item['title'])} - 诗经 · {escape(item['section'])}</title>
<meta name="description" content="{escape(desc)}">
<meta name="keywords" content="诗经,{escape(item['section'])},{escape(item['title'])},{escape(item['chapter'])},古诗,集思阁">
<meta property="og:title" content="{escape(item['title'])}">
<meta property="og:description" content="{escape(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="{SITE}/shijing/{item['slug']}.html">
<meta property="og:image" content="{SITE}/assets/images/og-cover.png">
<meta property="og:site_name" content="集思阁">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#2f6e4f">
<link rel="canonical" href="{SITE}/shijing/{item['slug']}.html">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../gushi/gushi.css">
</head>
<body>
<div class="container">
  <div class="article">
    <div class="top-bar">
      <a href="./" class="back-link">← 返回诗经全集</a>
      <span class="meta">{escape(item['section'])}</span>
    </div>
    <h1>{escape(item['title'])}</h1>
    <div class="meta">第{item['no']}篇 · {escape(full)} · 集思阁</div>
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
</body>
</html>
"""


def main():
    poems = load_poems()
    assign_slugs(poems)
    OUT.mkdir(exist_ok=True)

    (OUT / "index.html").write_text(build_index(poems), encoding="utf-8")

    for i, item in enumerate(poems):
        prev_item = poems[i - 1] if i > 0 else None
        next_item = poems[i + 1] if i < len(poems) - 1 else None
        (OUT / f"{item['slug']}.html").write_text(
            build_poem(item, prev_item, next_item), encoding="utf-8"
        )

    # 清理历史遗留的重命名文件（保留 json 数据源与本页面）
    keep = {p["slug"] + ".html" for p in poems} | {"index.html", "shijing.json"}
    for f in OUT.glob("*.html"):
        if f.name not in keep:
            f.unlink()

    print(f"生成完成：{len(poems)} 篇 + 目录页 → {OUT}")


if __name__ == "__main__":
    main()
