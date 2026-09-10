#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成《天工开物》阅读模块（tiangong/）。

数据源：/tmp/tiangu_data.json（由 /tmp/crawl_gushiwen.py 抓取 古诗文网 得到，简→繁）。
页面结构参考 maoxuan/ 与 daminglv/：目录页（卷首/上卷/中卷/下卷 → 篇）+ 每篇独立正文页，复用 ../gushi/gushi.css 与 ../gushi/gushi.js。
目录页样式取自 maoxuan/index.html 的 <style>，配色改为「苔绿 + 铜金」（工艺自然意象）。

用法：python3 scripts/build_tiangu.py
"""

import json
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = Path("/tmp/tiangu_data.json")
OUT = ROOT / "tiangong"
SITE = "https://www.justgame.top"
BOOK = "天工开物"
DOMAIN_PATH = "/tiangong"
DESC = "明宋应星撰，世界上第一部关于农业和手工业生产技术的综合性百科全书，分上中下三卷十八篇，兼及序说，凡十九目。"

HEAD_ICON = (
    '<svg fill="none" height="30" stroke="currentColor" stroke-linecap="round" '
    'stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="30" '
    'xmlns="http://www.w3.org/2000/svg"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>'
    '<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>'
)

# 目录页主题配色：maoxuan 朱红 → 天工开物 苔绿/铜金
COLOR_MAP = [
    ("#b91c1c", "#3a5a40"),
    ("rgba(185,28,28,", "rgba(58,90,64,"),
    ("#e08a2e", "#b8893f"),
    ("#f8f0f0", "#eef3ee"),
    ("#f3e7e7", "#e6efe7"),
    ("#f0f4f8", "#eef3ee"),
    ("rgba(250,242,242", "rgba(238,243,238"),
]

EXTRA_CSS = """
        .section-block { margin-top: 16px; }
        .section-head {
            display: flex; align-items: baseline; gap: 10px;
            padding: 0 0 8px 2px; border-bottom: 1px dashed rgba(58,90,64,0.22);
            margin-bottom: 10px;
        }
        .section-title { font-size: 15px; font-weight: 700; color: #3a5a40; }
        .section-count { font-size: 11.5px; color: #8a9a90; }
        @media (prefers-color-scheme: dark) {
            .section-title { color: #b8893f; }
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
    vols = data["volumes"]
    total = sum(len(v["articles"]) for v in vols)
    blocks = []
    for v in vols:
        links = "".join(
            '<a class="chapter-item" href="{slug}.html" title="{tt}">'
            '<span class="ch-num">{title}</span></a>'.format(
                slug=a["slug"], tt=escape(a["title"]), title=escape(a["title"]),
            )
            for a in v["articles"]
        )
        blocks.append(
            '<div class="vol-block">\n'
            '<div class="vol-head"><span class="vol-title">{vol}</span>'
            '<span class="vol-count">{n} 篇</span></div>\n'
            '<div class="section-block">\n'
            '<div class="chapter-grid">{links}</div></div></div>'.format(
                vol=escape(v["vol"]), n=len(v["articles"]), links=links
            )
        )

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>天工开物 · 明宋应星 上中下三卷十八篇 全文在线阅读</title>
<meta name="description" content="《天工开物》明宋应星撰，世界上第一部关于农业和手工业生产技术的综合性百科全书，上中下三卷十八篇全文在线阅读，含乃粒、乃服、彰施、冶铸、舟车、佳兵、珠玉等。">
<meta name="keywords" content="天工开物,宋应星,乃粒,乃服,冶铸,舟车,佳兵,珠玉,古代科技,集思阁">
<meta property="og:title" content="天工开物 · 上中下三卷">
<meta property="og:description" content="明宋应星撰，上中下三卷十八篇全文在线阅读。">
<meta property="og:type" content="website">
<meta property="og:url" content="{SITE}{DOMAIN_PATH}/">
<meta property="og:image" content="{SITE}/assets/images/og-cover.png">
<meta property="og:site_name" content="集思阁">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#3a5a40">
<link rel="canonical" href="{SITE}{DOMAIN_PATH}/">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "Book",
  "name": "天工开物",
  "url": "{SITE}{DOMAIN_PATH}/",
  "inLanguage": "zh-Hant",
  "author": {{ "@type": "Person", "name": "宋应星" }},
  "isPartOf": {{ "@type": "WebSite", "name": "集思阁", "url": "{SITE}/" }},
  "numberOfPages": {total}
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
天工开物
</div>
<a class="back-link" href="../index.html">← 返回首页</a>
</div>
<div class="header-subtitle">明 宋应星 撰 · 上中下三卷 · 共 {total} 篇</div>
</div>
<div class="vol-block"><div class="vol-desc">{escape(DESC)}</div></div>
{''.join(blocks)}
<div class="footer-count">天工开物 · 集思阁 · 共 {total} 篇</div>
</div>
<button class="top-btn" id="topBtn" onclick="window.scrollTo({{top:0,behavior:'smooth'}})" title="返回顶部">↑</button>
<script src="../gushi/gushi.js"></script>
</body>
</html>
"""


def build_article(a, prev_a, next_a, meta):
    body = "".join(f"<p>{escape(p)}</p>" for p in a["paras"])
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
<title>{escape(a['title'])} - 天工开物</title>
<meta name="description" content="{escape(a['title'])}：{escape(''.join(a['paras'])[:76])}">
<meta name="keywords" content="天工开物,{escape(meta)},{escape(a['title'])},宋应星,古代科技,集思阁">
<meta property="og:title" content="{escape(a['title'])}">
<meta property="og:description" content="{escape(''.join(a['paras'])[:76])}">
<meta property="og:type" content="article">
<meta property="og:url" content="{SITE}{DOMAIN_PATH}/{a['slug']}.html">
<meta property="og:image" content="{SITE}/assets/images/og-cover.png">
<meta property="og:site_name" content="集思阁">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#3a5a40">
<link rel="canonical" href="{SITE}{DOMAIN_PATH}/{a['slug']}.html">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../gushi/gushi.css">
</head>
<body>
<div class="container">
  <div class="article">
    <div class="top-bar">
      <a href="./" class="back-link">← 返回天工开物</a>
      <span class="meta">{escape(meta)}</span>
    </div>
    <h1>{escape(a['title'])}</h1>
    <div class="meta">天工开物 · 集思阁</div>
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
    data = json.loads(DATA.read_text(encoding="utf-8"))
    OUT.mkdir(exist_ok=True)
    # 全局扁平顺序（跨卷）用于上下篇导航
    flat = []
    vol_of = {}
    for v in data["volumes"]:
        for a in v["articles"]:
            a["_vol"] = v["vol"]
            vol_of[id(a)] = v["vol"]
            flat.append(a)

    (OUT / "index.html").write_text(build_index(data), encoding="utf-8")

    for idx, a in enumerate(flat):
        prev_a = flat[idx - 1] if idx > 0 else None
        next_a = flat[idx + 1] if idx < len(flat) - 1 else None
        meta = f"{a['_vol']} · {a['title']}"
        (OUT / f"{a['slug']}.html").write_text(
            build_article(a, prev_a, next_a, meta), encoding="utf-8"
        )

    keep = {a["slug"] + ".html" for a in flat} | {"index.html"}
    for f in OUT.glob("*.html"):
        if f.name not in keep:
            f.unlink()

    print(f"生成完成：{len(flat)} 篇 + 目录页 → {OUT}")


if __name__ == "__main__":
    main()
