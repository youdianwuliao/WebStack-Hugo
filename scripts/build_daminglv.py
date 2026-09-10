#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成《大明律》阅读模块（daminglv/）。

数据源：/tmp/dml_data.json（由 scripts 抓取 shidianguji 得到，保留繁体原文）。
页面结构参考 maoxuan/ 与 shijing/：目录页（七律→卷→条）+ 每条独立正文页，复用 ../gushi/gushi.css 与 ../gushi/gushi.js。
目录页样式取自 maoxuan/index.html，配色改为「藏青+金」（区别于毛选朱红、诗经竹青）。

用法：python3 scripts/build_daminglv.py
"""

import json
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = Path("/tmp/dml_data.json")
OUT = ROOT / "daminglv"
SITE = "https://www.justgame.top"
BOOK = "大明律"
DOMAIN_PATH = "/daminglv"

# 律 -> 序（用于目录与 slug）。修正 OCR 卷名，按《大明律》原典七律三十卷。
LAW_ORDER = [
    ("名例律", "总则。定五刑、十恶、八议及量刑通例，为诸律之纲。"),
    ("吏律", "职官公务之法，分职制、公式二门。"),
    ("户律", "户籍、田宅、婚姻、仓库、钱债等民事之法，分七门。"),
    ("礼律", "祭祀、仪制等礼乐教化之法，分二门。"),
    ("兵律", "宫卫、军政、关津、厩牧、邮驿等军事之法，分五门。"),
    ("刑律", "贼盗、人命、斗殴、诉讼、断狱等刑名之法，门类最繁。"),
    ("工律", "营造、河防等工程之法，分二门。"),
]

LAW_KEY = {
    "名例律": "ml", "吏律": "li", "户律": "hu", "礼律": "la",
    "兵律": "bi", "刑律": "xi", "工律": "go",
}

# 目录页主题配色：maoxuan 朱红 → 大明律 藏青/金
COLOR_MAP = [
    ("#b91c1c", "#1f456e"),
    ("rgba(185,28,28,", "rgba(31,69,110,"),
    ("#e08a2e", "#c9a227"),
    ("#f8f0f0", "#eef2f7"),
    ("#f3e7e7", "#e6edf4"),
    ("#f0f4f8", "#f3f1ea"),
    ("rgba(250,242,242", "rgba(238,243,248"),
]

EXTRA_CSS = """
        .section-block { margin-top: 16px; }
        .section-head {
            display: flex; align-items: baseline; gap: 10px;
            padding: 0 0 8px 2px; border-bottom: 1px dashed rgba(31,69,110,0.22);
            margin-bottom: 10px;
        }
        .section-title { font-size: 15px; font-weight: 700; color: #1f456e; }
        .section-count { font-size: 11.5px; color: #8a9a90; }
        @media (prefers-color-scheme: dark) {
            .section-title { color: #c9a227; }
            .section-count { color: #94a3b8; }
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
    src = (ROOT / "maoxuan" / "index.html").read_text(encoding="utf-8")
    css = src[src.find("<style>") + 7: src.find("</style>")]
    for old, new in COLOR_MAP:
        css = css.replace(old, new)
    return css + EXTRA_CSS


def build_index(data):
    laws = data["laws"]
    law_desc = dict(LAW_ORDER)
    # 统计
    law_stats = []
    for L in laws:
        nv = len(L["volumes"])
        na = sum(len(v["articles"]) for v in L["volumes"])
        law_stats.append((L["lv"], nv, na))
    total_arts = sum(s[2] for s in law_stats)
    total_vols = sum(s[1] for s in law_stats)

    blocks = []
    for L in laws:
        lv = L["lv"]
        vols = L["volumes"]
        nv = len(vols)
        na = sum(len(v["articles"]) for v in vols)
        inner = []
        for v in vols:
            links = "".join(
                '<a class="chapter-item" href="{slug}.html" title="{tt}">'
                '<span class="ch-num">第{no}条</span>{title}</a>'.format(
                    slug=a["slug"], tt=escape(a["title"]),
                    no=i + 1, title=escape(a["title"]),
                )
                for i, a in enumerate(v["articles"])
            )
            inner.append(
                '<div class="section-block">'
                '<div class="section-head"><span class="section-title">卷{vol} {vtitle}</span>'
                '<span class="section-count">{n} 条</span></div>'
                '<div class="chapter-grid">{links}</div></div>'.format(
                    vol=v["vol"], vtitle=escape(v["title"].split("·")[-1]),
                    n=len(v["articles"]), links=links,
                )
            )
        blocks.append(
            '<div class="vol-block">\n'
            '<div class="vol-head"><span class="vol-title">{lv}</span>'
            '<span class="vol-count">{nv} 卷 · {na} 条</span></div>\n'
            '<div class="vol-desc">{desc}</div>\n'
            "{inner}</div>".format(
                lv=lv, nv=nv, na=na, desc=law_desc.get(lv, ""), inner="".join(inner)
            )
        )

    sub = " · ".join(f"{lv} {nv}卷" for lv, nv, na in law_stats)
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>大明律 · 洪武三十年颁行 七律三十卷全文在线阅读</title>
<meta name="description" content="《大明律》明太祖洪武三十年颁行，七律三十卷四百六十条全文在线阅读，含名例、吏、户、礼、兵、刑、工七律及《御制大明律序》。">
<meta name="keywords" content="大明律,明律,洪武律,名例律,刑律,法典,明代法律,集思阁">
<meta property="og:title" content="大明律 · 七律三十卷">
<meta property="og:description" content="明太祖洪武三十年颁行，七律三十卷全文在线阅读。">
<meta property="og:type" content="website">
<meta property="og:url" content="{SITE}{DOMAIN_PATH}/">
<meta property="og:image" content="{SITE}/assets/images/og-cover.png">
<meta property="og:site_name" content="集思阁">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1f456e">
<link rel="canonical" href="{SITE}{DOMAIN_PATH}/">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "Book",
  "name": "大明律",
  "url": "{SITE}{DOMAIN_PATH}/",
  "inLanguage": "zh-Hant",
  "author": {{ "@type": "Person", "name": "明太祖 敕修" }},
  "isPartOf": {{ "@type": "WebSite", "name": "集思阁", "url": "{SITE}/" }},
  "numberOfPages": {total_arts}
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
大明律
</div>
<a class="back-link" href="../index.html">← 返回首页</a>
</div>
<div class="header-subtitle">明太祖洪武三十年颁行 · 七律三十卷 · 共 {total_arts} 条 · {sub}</div>
</div>
{''.join(blocks)}
<div class="footer-count">大明律 · 集思阁 · 共 {total_arts} 条</div>
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
<title>{escape(a['title'])} - 大明律 · {escape(meta)}</title>
<meta name="description" content="{escape(a['title'])}：{escape(''.join(a['paras'])[:76])}">
<meta name="keywords" content="大明律,{escape(meta)},{escape(a['title'])},明代法律,集思阁">
<meta property="og:title" content="{escape(a['title'])}">
<meta property="og:description" content="{escape(''.join(a['paras'])[:76])}">
<meta property="og:type" content="article">
<meta property="og:url" content="{SITE}{DOMAIN_PATH}/{a['slug']}.html">
<meta property="og:image" content="{SITE}/assets/images/og-cover.png">
<meta property="og:site_name" content="集思阁">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1f456e">
<link rel="canonical" href="{SITE}{DOMAIN_PATH}/{a['slug']}.html">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../gushi/gushi.css">
</head>
<body>
<div class="container">
  <div class="article">
    <div class="top-bar">
      <a href="./" class="back-link">← 返回大明律</a>
      <span class="meta">{escape(meta)}</span>
    </div>
    <h1>{escape(a['title'])}</h1>
    <div class="meta">大明律 · 集思阁</div>
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

    # 为每个 条 生成 slug（律键+卷+序号），并构建全局顺序用于上下篇
    flat = []  # (law, article_dict)
    for L in data["laws"]:
        lv = L["lv"]
        key = LAW_KEY.get(lv, "zz")
        for v in L["volumes"]:
            for i, a in enumerate(v["articles"]):
                slug = f"{key}{v['vol']:02d}-{i+1:02d}"
                a["slug"] = slug
                a["_law"] = lv
                a["_vol"] = v["vol"]
                a["_vtitle"] = v["title"]
                flat.append(a)

    # 序言页（若有内容）
    pref = data.get("preface")
    if pref and pref.get("paras"):
        pref_slug = "xuyan"
        body = "".join(f"<p>{escape(p)}</p>" for p in pref["paras"])
        pref_html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>御制大明律序 - 大明律</title>
<meta name="description" content="《御制大明律序》及进大明律表，明太祖朱元璋撰。">
<meta name="keywords" content="大明律,御制大明律序,朱元璋,明代法律,集思阁">
<meta property="og:title" content="御制大明律序">
<meta property="og:type" content="article">
<meta property="og:url" content="{SITE}{DOMAIN_PATH}/{pref_slug}.html">
<meta property="og:image" content="{SITE}/assets/images/og-cover.png">
<meta property="og:site_name" content="集思阁">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1f456e">
<link rel="canonical" href="{SITE}{DOMAIN_PATH}/{pref_slug}.html">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../gushi/gushi.css">
</head>
<body>
<div class="container">
  <div class="article">
    <div class="top-bar">
      <a href="./" class="back-link">← 返回大明律</a>
      <span class="meta">序 · 表</span>
    </div>
    <h1>御制大明律序 · 进大明律表</h1>
    <div class="meta">大明律 · 集思阁</div>
    <div class="article-body">
{body}
    </div>
    <div class="pager">
      <a class="prev empty" href="#">← 上一篇</a>
      <a href="{flat[0]['slug']}.html" class="next">下一篇 →</a>
    </div>
  </div>
</div>
<button class="top-btn" id="topBtn" onclick="window.scrollTo({{top:0,behavior:'smooth'}})" title="返回顶部">↑</button>
<script src="../gushi/gushi.js"></script>
</body>
</html>
"""
        (OUT / f"{pref_slug}.html").write_text(pref_html, encoding="utf-8")

    # 目录页
    (OUT / "index.html").write_text(build_index(data), encoding="utf-8")

    # 每条正文页（保持全局顺序做上下篇导航）
    for idx, a in enumerate(flat):
        prev_a = flat[idx - 1] if idx > 0 else None
        next_a = flat[idx + 1] if idx < len(flat) - 1 else None
        meta = f"{a['_law']} · 卷{a['_vol']} {a['_vtitle'].split('·')[-1]}"
        (OUT / f"{a['slug']}.html").write_text(
            build_article(a, prev_a, next_a, meta), encoding="utf-8"
        )

    # 清理历史遗留文件
    keep = {a["slug"] + ".html" for a in flat} | {"index.html"}
    if pref and pref.get("paras"):
        keep.add("xuyan.html")
    for f in OUT.glob("*.html"):
        if f.name not in keep:
            f.unlink()

    print(f"生成完成：{len(flat)} 条 + 目录页 + 序言页 → {OUT}")


if __name__ == "__main__":
    main()
