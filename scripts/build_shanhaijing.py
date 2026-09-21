#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成《山海经》阅读模块（shanhaijing/）。

数据源：/tmp/shanhaijing_data.json
  由 scripts/fetch_shanhaijing.py 从维基文库（zh.wikisource.org）抓取并清洗——十九页：
  〈郭璞序〉＋〈山经〉五篇（南山经…中山经）＋〈海经〉十三篇（海外四经、海内四经、
  大荒四经、海内经），繁体原文，含郭璞注（南山经、西山经、海内经东经三篇有注，
  余篇维基文库未录注）。抓取须 `--resolve zh.wikisource.org:443:208.80.153.224`
  （本机默认 DNS 指向不通节点），详见该脚本头部说明。

页面结构参考 maoxuan/、shijing/：目录页（序／山经／海经三段）+ 每篇独立正文页，
复用 ../gushi/gushi.css 与 ../gushi/gushi.js，并接入简繁切换（默认简体）。
目录页样式取自 maoxuan/index.html 的 <style>，配色改为「石青 + 赭金」（山川博物意象）。

用法：python3 scripts/build_shanhaijing.py
"""

import json
import sys
from html import escape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from zh_toggle import TOGGLE_BTN, TOGGLE_CSS, TOGGLE_JS, s, zh_attrs  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DATA = Path("/tmp/shanhaijing_data.json")
OUT = ROOT / "shanhaijing"
SITE = "https://www.justgame.top"
BOOK = "山海经"
DOMAIN_PATH = "/shanhaijing"
PRIMARY = "#2e5d6e"
ACCENT = "#c2793a"
DESC = (
    "先秦古籍，今本十八卷，分《山經》五篇、《海經》十三篇，"
    "記山川地理、異獸神祇與上古神話，晉郭璞為之作注，為現存最早的地理博物志怪之書。"
)

HEAD_ICON = (
    '<svg fill="none" height="30" stroke="currentColor" stroke-linecap="round" '
    'stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="30" '
    'xmlns="http://www.w3.org/2000/svg"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>'
    '<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>'
)

# 目录页主题配色：maoxuan 朱红 → 山海经 石青/赭金
COLOR_MAP = [
    ("#b91c1c", PRIMARY),
    ("rgba(185,28,28,", "rgba(46,93,110,"),
    ("#e08a2e", ACCENT),
    ("#f8f0f0", "#edf3f5"),
    ("#f3e7e7", "#e5edf0"),
    ("#f0f4f8", "#edf3f5"),
    ("rgba(250,242,242", "rgba(237,243,245"),
]

EXTRA_CSS = """
        .section-block { margin-top: 16px; }
        .section-head {
            display: flex; align-items: baseline; gap: 10px;
            padding: 0 0 8px 2px; border-bottom: 1px dashed rgba(46,93,110,0.22);
            margin-bottom: 10px;
        }
        .section-title { font-size: 15px; font-weight: 700; color: #2e5d6e; }
        .section-count { font-size: 11.5px; color: #8a9a90; }
        @media (prefers-color-scheme: dark) {
            .section-title { color: #c2793a; }
            .section-count { color: #94a3b8; }
            .section-head { border-color: rgba(148,163,184,0.3); }
        }
"""

# 正文页：郭璞注用更小的字号与更淡的颜色随文排印，不加边框底色
ARTICLE_CSS = """
        .article-body p { text-indent: 0; }
        .article-body .anno {
            font-size: 0.86em; color: #7b8794; line-height: 1.7;
        }
        @media (prefers-color-scheme: dark) {
            .article-body .anno { color: #94a3b8; }
        }
"""

# 分组键（简体，与数据源一致）、显示用繁体卷名、卷说明（繁体，供简繁切换还原）
VOLUMES = [
    ("序", "序", "晉郭璞為《山海經》所作之序，論「物不自異，待我而後異」，為全書張目。"),
    ("山经", "山經", "南山經、西山經、北山經、東山經、中山經五篇，記內地山川、草木、鳥獸、神祇與祭祀之禮。"),
    ("海经", "海經", "海外、海內、大荒諸經及海內經共十三篇，多記殊方異國、遠方神怪，為上古神話之淵藪。"),
]

CN_NUM = "一二三四五六七八九十"


def cn_number(n):
    """1→一，10→十，11→十一，18→十八。"""
    if n <= 10:
        return CN_NUM[n - 1]
    if n < 20:
        return "十" + CN_NUM[n - 11]
    return str(n)


def load_index_style():
    src = (ROOT / "maoxuan" / "index.html").read_text(encoding="utf-8")
    css = src[src.find("<style>") + 7: src.find("</style>")]
    for old, new in COLOR_MAP:
        css = css.replace(old, new)
    return css + EXTRA_CSS


def first_plain(article, limit=76):
    """取首段纯经文作摘要（跳过郭璞注）。"""
    for b in article["blocks"]:
        if b["type"] != "p":
            continue
        text = "".join(t for k, t in b["segs"] if not k)
        if text:
            return text[:limit] + ("…" if len(text) > limit else "")
    return ""


def build_index(articles):
    total = len(articles)
    blocks = []
    for vol_key, vol_label, vol_desc in VOLUMES:
        items = [a for a in articles if a["vol"] == vol_key]
        links = "".join(
            '<a class="chapter-item" href="{slug}.html" title="{tt}">'
            '<span class="ch-num">{num}</span>'
            '<span class="ch-title"{t_att}>{title}</span></a>'.format(
                slug=a["slug"], tt=escape(s(a["title"])),
                num=escape(a["num"]), title=escape(s(a["title"])),
                t_att=zh_attrs(a["title"]),
            )
            for a in items
        )
        blocks.append(
            '<div class="vol-block">\n'
            '<div class="vol-head"><span class="vol-title"{vl_att}>{vol}</span>'
            '<span class="vol-count">{n} 篇</span></div>\n'
            '<div class="vol-desc"{vd_att}>{vd}</div>\n'
            '<div class="section-block">\n'
            '<div class="chapter-grid">{links}</div></div></div>'.format(
                vol=escape(s(vol_label)), vl_att=zh_attrs(vol_label),
                n=len(items),
                vd=escape(s(vol_desc)), vd_att=zh_attrs(vol_desc),
                links=links,
            )
        )

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>山海经 · 十八卷全文在线阅读（附郭璞注）</title>
<meta name="description" content="《山海经》先秦古籍，山经五篇、海经十三篇全文在线阅读，含南山经、西山经、北山经、东山经、中山经及海外、海内、大荒诸经，晋郭璞注。">
<meta name="keywords" content="山海经,南山经,西山经,北山经,东山经,中山经,海外经,海内经,大荒经,郭璞注,九尾狐,精卫,夸父,集思阁">
<meta property="og:title" content="山海经 · 十八卷">
<meta property="og:description" content="先秦地理博物志怪之书，山经五篇、海经十三篇全文在线阅读，附晋郭璞注。">
<meta property="og:type" content="website">
<meta property="og:url" content="{SITE}{DOMAIN_PATH}/">
<meta property="og:image" content="{SITE}/assets/images/og-cover.png">
<meta property="og:site_name" content="集思阁">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="{PRIMARY}">
<link rel="canonical" href="{SITE}{DOMAIN_PATH}/">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "Book",
  "name": "山海经",
  "alternateName": "山海經",
  "url": "{SITE}{DOMAIN_PATH}/",
  "inLanguage": "zh-Hans",
  "author": {{ "@type": "Person", "name": "佚名" }},
  "contributor": {{ "@type": "Person", "name": "郭璞（注）" }},
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
山海经
</div>
<a class="back-link" href="../index.html">← 返回首页</a>
{TOGGLE_BTN}
</div>
<div class="header-subtitle">先秦古籍 · 晋郭璞注 · 山经五篇 海经十三篇 · 共 {total} 篇</div>
</div>
{''.join(blocks)}
<div class="footer-count">山海经 · 集思阁 · 共 {total} 篇</div>
</div>
<button class="top-btn" id="topBtn" onclick="window.scrollTo({{top:0,behavior:'smooth'}})" title="返回顶部">↑</button>
<script src="../gushi/gushi.js"></script>
{TOGGLE_JS}</body>
</html>
"""


def render_block(b):
    if b["type"] == "h":
        return '<h2{t_att}>{title}</h2>'.format(
            t_att=zh_attrs(b["text"]), title=escape(s(b["text"]))
        )
    segs = b["segs"]
    # 纯经文段落：data-t2t 直接挂在 <p> 上，与既有模块一致
    if all(k == 0 for k, _ in segs):
        trad = "".join(t for _, t in segs)
        return '<p{t_att}>{text}</p>'.format(
            t_att=zh_attrs(trad), text=escape(s(trad))
        )
    # 夹注段落：正文与郭璞注各成叶子节点，简繁切换才不会被拍平
    inner = "".join(
        '<span class="{cls}"{t_att}>{text}</span>'.format(
            cls="anno" if k else "zh", t_att=zh_attrs(t), text=escape(s(t))
        )
        for k, t in segs
    )
    return f"<p>{inner}</p>"


def build_article(a, prev_a, next_a):
    body = "\n".join(render_block(b) for b in a["blocks"])
    desc = first_plain(a)
    meta = f"{a['vol_label']} · {a['title']}"
    prev_link = (
        f'<a href="{prev_a["slug"]}.html" class="prev">← {escape(s(prev_a["title"]))}</a>'
        if prev_a else '<a class="prev empty" href="#">← 上一篇</a>'
    )
    next_link = (
        f'<a href="{next_a["slug"]}.html" class="next">{escape(s(next_a["title"]))} →</a>'
        if next_a else '<a class="next empty" href="#">下一篇 →</a>'
    )
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{escape(s(a['title']))} - 山海经</title>
<meta name="description" content="{escape(s(a['title']))}：{escape(s(desc))}">
<meta name="keywords" content="山海经,{escape(s(meta))},{escape(s(a['title']))},郭璞注,上古神话,集思阁">
<meta property="og:title" content="{escape(s(a['title']))} · 山海经">
<meta property="og:description" content="{escape(s(desc))}">
<meta property="og:type" content="article">
<meta property="og:url" content="{SITE}{DOMAIN_PATH}/{a['slug']}.html">
<meta property="og:image" content="{SITE}/assets/images/og-cover.png">
<meta property="og:site_name" content="集思阁">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="{PRIMARY}">
<link rel="canonical" href="{SITE}{DOMAIN_PATH}/{a['slug']}.html">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../gushi/gushi.css">
<style>{TOGGLE_CSS}{ARTICLE_CSS}</style>
</head>
<body>
<div class="container">
  <div class="article">
    <div class="top-bar">
      <a href="./" class="back-link">← 返回山海经</a>
      <span class="meta"{zh_attrs(meta)}>{escape(s(meta))}</span>
      {TOGGLE_BTN}
    </div>
    <h1{zh_attrs(a['title'])}>{escape(s(a['title']))}</h1>
    <div class="meta">山海经 · 集思阁</div>
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
    articles = data["articles"]
    labels = {k: lbl for k, lbl, _ in VOLUMES}
    for i, a in enumerate(articles):
        a["vol_label"] = labels[a["vol"]]
        if a["slug"] == "xuyan":
            a["num"] = "序"
        else:
            a["num"] = "第" + cn_number(i)
    OUT.mkdir(exist_ok=True)

    (OUT / "index.html").write_text(build_index(articles), encoding="utf-8")

    for idx, a in enumerate(articles):
        prev_a = articles[idx - 1] if idx > 0 else None
        next_a = articles[idx + 1] if idx < len(articles) - 1 else None
        (OUT / f"{a['slug']}.html").write_text(
            build_article(a, prev_a, next_a), encoding="utf-8"
        )

    keep = {a["slug"] + ".html" for a in articles} | {"index.html"}
    for f in OUT.glob("*.html"):
        if f.name not in keep:
            f.unlink()

    print(f"生成完成：{len(articles)} 篇 + 目录页 → {OUT}")


if __name__ == "__main__":
    main()
