#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成《心史》阅读模块（xinshi/）。

数据源
  正文：/tmp/xinshi_data.json
    由 scripts/fetch_xinshi.py 抓取识典古籍（shidianguji.com）《宋郑所南先生心史》
    NA11198 的 21 个章节页。该站 /api/ancientlib/read/* 被字节 argus 反爬全面拦截，
    但章节页 HTML 内嵌 window._ROUTER_DATA，其中的 paragraphList 就是该章完整正文
    （段数与目录声明的 paragraphCount 一致），无需鉴权即可取全。
  书影：xinshi/scans/ 下 247 叶 —— 原书为明崇祯刊本，日本内阁文库藏，
    影像来自国立公文書館デジタルアーカイブ（公开、免费、可下载）：
      簿册 https://www.digital.archives.go.jp/file/1083674
      冊一 https://www.digital.archives.go.jp/img/2844069 （122 叶）
      冊二 https://www.digital.archives.go.jp/img/2844071 （125 叶）
    每叶为双叶展开图，取 IIIF 3000px 上限后转 WebP（1600px 主图 + 320px 缩略图），
    由 scripts/fetch_xinshi_scans.py 与 scripts/prep_xinshi_scans.py 完成，
    产物落在 xinshi/scans/。
    注意：识典页码是「半叶」连续计数（第 L 半叶 = 第 L//2+1 叶，偶数取右版），
    冊一与源站叶号对得上，冊二起有累积偏移（实测 3 叶），故正文页只挂书影总入口，
    不标注每篇的叶号，以免给错。

页面结构参考 shanhaijing/、chuci/：目录页 + 每篇独立正文页 + 书影总览页，
复用 ../gushi/gushi.css 与 ../gushi/gushi.js，接入简繁切换（默认简体）。

用法：python3 scripts/build_xinshi.py
"""

import json
import sys
from html import escape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from zh_toggle import TOGGLE_BTN, TOGGLE_CSS, TOGGLE_JS, s as _zh_s, zh_attrs  # noqa: E402
from opencc import OpenCC  # noqa: E402

_S2T = OpenCC("s2t")


def s(text):
    """繁→简，另把「呪」并入正字「咒」——opencc 的 t2s 保留呪，与站内标题用字不一致。"""
    return _zh_s(text).replace("呪", "咒") if text else text

ROOT = Path(__file__).resolve().parent.parent
DATA = Path("/tmp/xinshi_data.json")
OUT = ROOT / "xinshi"
SITE = "https://www.justgame.top"
BOOK = "心史"
DOMAIN_PATH = "/xinshi"
PRIMARY = "#3e4a52"
ACCENT = "#a8432b"
DESC = (
    "宋鄭思肖撰，明崇禎刊本。宋亡後鄭思肖隱居吳門，不仕不婚，"
    "將所作詩文封入鐵函沉於蘇州承天寺井中，三百五十六年後重見天日，"
    "故又稱《鐵函心史》。收咸淳集、大義集、中興集、久久書、雜文、大義略敘等，"
    "存詩二百五十首、文四十篇。"
)
SCAN_NOTE = (
    "書影為明崇禎刊本，原書藏日本內閣文庫，"
    "影像取自國立公文書館デジタルアーカイブ（公開·免費·可下載）。"
    "每葉係雙葉展開圖，即原書攤開之左右兩版。"
)

# 识典古籍的半叶页码 → 原书叶：叶 = 页//2 + 1；冊一 1–122 叶，冊二接续
VOL1, VOL2 = 122, 125
TOTAL_LEAVES = VOL1 + VOL2
HEAD_ICON = (
    '<svg fill="none" height="30" stroke="currentColor" stroke-linecap="round" '
    'stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="30" '
    'xmlns="http://www.w3.org/2000/svg"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>'
    '<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>'
)

# 目录页配色：maoxuan 朱红 → 心史 铁青/朱砂
COLOR_MAP = [
    ("#b91c1c", PRIMARY),
    ("rgba(185,28,28,", "rgba(62,74,82,"),
    ("#e08a2e", ACCENT),
    ("#f8f0f0", "#eef1f3"),
    ("#f3e7e7", "#e6eaed"),
    ("#f0f4f8", "#eef1f3"),
    ("rgba(250,242,242", "rgba(238,241,243"),
]

EXTRA_CSS = """
        .section-block { margin-top: 16px; }
        .section-head {
            display: flex; align-items: baseline; gap: 10px;
            padding: 0 0 8px 2px; border-bottom: 1px dashed rgba(62,74,82,0.22);
            margin-bottom: 10px;
        }
        .section-title { font-size: 15px; font-weight: 700; color: #3e4a52; }
        .section-count { font-size: 11.5px; color: #8a9a90; }
        @media (prefers-color-scheme: dark) {
            .section-title { color: #a8432b; }
            .section-count { color: #94a3b8; }
            .section-head { border-color: rgba(148,163,184,0.3); }
        }
"""

# 每篇标题一律去掉「宋鄭所南先生心史」这个书名前缀，只留篇名
STRIP_PREFIX = "宋鄭所南先生心史"


def load_index_style():
    src = (ROOT / "maoxuan" / "index.html").read_text(encoding="utf-8")
    css = src[src.find("<style>") + 7: src.find("</style>")]
    for old, new in COLOR_MAP:
        css = css.replace(old, new)
    return css + EXTRA_CSS


def display_name(art):
    """去掉书名前缀，并统一成繁体——源站章节名繁简混杂（如「后序一」「附录」）。"""
    name = art["name"].strip()
    if name == STRIP_PREFIX:
        return "卷首"
    name = name.replace(STRIP_PREFIX, "").strip()
    return _S2T.convert(name or art["name"])


def first_plain(art, limit=76):
    text = art["paras"][0]["text"] if art["paras"] else ""
    return text[:limit] + ("…" if len(text) > limit else "")


CN = "〇一二三四五六七八九十"


def cn(n):
    """1→一，10→十，11→十一，21→二十一。"""
    if n <= 10:
        return CN[n]
    if n < 20:
        return "十" + CN[n - 10]
    if n % 10 == 0 and n < 100:
        return CN[n // 10] + "十"
    if n < 100:
        return CN[n // 10] + "十" + CN[n % 10]
    return str(n)


def build_index(arts):
    total = len(arts)
    links = "".join(
        '<a class="chapter-item" href="{slug}.html" title="{tt}">'
        '<span class="ch-num">第{num}篇</span>'
        '<span class="ch-title"{t_att}>{title}</span></a>'.format(
            slug=a["slug"], tt=escape(s(a["title"])), num=cn(i + 1),
            title=escape(s(a["title"])), t_att=zh_attrs(a["title"]),
        )
        for i, a in enumerate(arts)
    )
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>心史 · 铁函心史 全文在线阅读（附原书书影）</title>
<meta name="description" content="《心史》宋郑思肖撰，又称《铁函心史》。收咸淳集、大义集、中兴集、久久书、杂文、大义略叙等，存诗二百五十首、文四十篇，附明崇祯刊本原书书影二百四十七叶。">
<meta name="keywords" content="心史,铁函心史,所南心史,郑思肖,郑所南,咸淳集,大义集,中兴集,久久书,杂文,大义略叙,宋遗民,集思阁">
<meta property="og:title" content="心史 · 铁函心史">
<meta property="og:description" content="宋郑思肖撰，明崇祯刊本全文在线阅读，附原书书影。">
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
  "name": "心史",
  "alternateName": ["铁函心史", "所南心史"],
  "url": "{SITE}{DOMAIN_PATH}/",
  "inLanguage": "zh-Hans",
  "author": {{ "@type": "Person", "name": "郑思肖" }},
  "contributor": {{ "@type": "Person", "name": "林古度（校订）" }},
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
心史
</div>
<a class="back-link" href="../index.html">← 返回首页</a>
{TOGGLE_BTN}
</div>
<div class="header-subtitle">宋 郑思肖 撰 · 明崇祯刊本 · 共 {total} 篇</div>
</div>
<div class="vol-block">
<div class="vol-desc"{zh_attrs(DESC)}>{escape(s(DESC))}</div>
<div class="section-block">
<div class="section-head"><span class="section-title">心史</span>
<span class="section-count">{total} 篇</span></div>
<div class="chapter-grid">{links}</div>
</div>
<div class="book-link-row">
<a class="book-link" href="shuying.html">原书书影 · 明崇祯刊本 247 叶 →</a>
</div>
</div>
<div class="footer-count">心史 · 集思阁 · 共 {total} 篇</div>
</div>
<button class="top-btn" id="topBtn" onclick="window.scrollTo({{top:0,behavior:'smooth'}})" title="返回顶部">↑</button>
<style>
        .book-link-row {{ margin-top: 14px; padding-top: 12px; border-top: 1px dashed rgba(62,74,82,0.22); }}
        .book-link {{ font-size: 13.5px; color: {PRIMARY}; text-decoration: none; }}
        .book-link:hover {{ color: {ACCENT}; }}
        @media (prefers-color-scheme: dark) {{ .book-link {{ color: #cbd5e1; }} }}
</style>
<script src="../gushi/gushi.js"></script>
{TOGGLE_JS}</body>
</html>
"""


def build_article(a, prev_a, next_a):
    body = "\n".join(
        '<p{t}>{text}</p>'.format(t=zh_attrs(p["text"]), text=escape(s(p["text"])))
        for p in a["paras"]
    )
    desc = first_plain(a)
    name = a["title"]
    prev_link = (
        f'<a href="{prev_a["slug"]}.html" class="prev">← {escape(s(prev_a["title"]))}</a>'
        if prev_a else '<a class="prev empty" href="#">← 上一篇</a>'
    )
    next_link = (
        f'<a href="{next_a["slug"]}.html" class="next">{escape(s(next_a["title"]))} →</a>'
        if next_a else '<a class="next empty" href="#">下一篇 →</a>'
    )
    leaves_note = (
        '<a href="shuying.html">明崇祯刊本 · 全 {n} 叶（日本内阁文库藏）</a>'.format(n=TOTAL_LEAVES)
    )
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{escape(s(name))} - 心史</title>
<meta name="description" content="{escape(s(name))}：{escape(s(desc))}">
<meta name="keywords" content="心史,{escape(s(name))},郑思肖,铁函心史,宋遗民,集思阁">
<meta property="og:title" content="{escape(s(name))} · 心史">
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
<style>{TOGGLE_CSS}
        .scan-line {{ margin-top: 26px; padding-top: 12px; border-top: 1px dashed rgba(62,74,82,0.25);
            font-size: 13px; color: #6b7784; }}
        .scan-line a {{ color: {PRIMARY}; text-decoration: none; }}
        .scan-line a:hover {{ color: {ACCENT}; }}
        @media (prefers-color-scheme: dark) {{
            .scan-line {{ color: #94a3b8; border-color: rgba(148,163,184,0.3); }}
            .scan-line a {{ color: #cbd5e1; }}
        }}
</style>
</head>
<body>
<div class="container">
  <div class="article">
    <div class="top-bar">
      <a href="./" class="back-link">← 返回心史</a>
      <span class="meta">心史</span>
      {TOGGLE_BTN}
    </div>
    <h1{zh_attrs(name)}>{escape(s(name))}</h1>
    <div class="meta">心史 · 集思阁</div>
    <div class="article-body">
{body}
    </div>
    <div class="scan-line">原书书影：{leaves_note}</div>
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


SHUYING_CSS = """
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: "SF Pro Display", "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif;
        background: #f5f6f7; color: #2d3748; padding: 20px;
        -webkit-font-smoothing: antialiased;
    }
    .container { max-width: 1180px; margin: 0 auto; background: #fff;
        border-radius: 14px; padding: 28px; box-shadow: 0 6px 24px rgba(0,0,0,0.06); }
    .page-header { display: flex; align-items: center; justify-content: space-between;
        flex-wrap: wrap; gap: 12px; padding-bottom: 14px;
        border-bottom: 1px solid rgba(62,74,82,0.16); }
    .header-title { font-size: 1.5rem; font-weight: 700; color: #3e4a52; }
    .back-link { font-size: 13.5px; color: #3e4a52; text-decoration: none; }
    .back-link:hover { color: #a8432b; }
    .note { margin: 14px 0 22px; font-size: 12.5px; line-height: 1.9; color: #6b7784; }
    h2 { font-size: 15px; font-weight: 700; color: #3e4a52; margin: 26px 0 10px;
        padding-bottom: 8px; border-bottom: 1px dashed rgba(62,74,82,0.22); }
    h2 .cnt { font-size: 11.5px; font-weight: 400; color: #8a9a90; margin-left: 8px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 10px; }
    /* 247 格一次铺开，让视口外的格子跳过布局与绘制，滚动更顺 */
    .leaf { display: block; position: relative; text-decoration: none;
        content-visibility: auto; contain-intrinsic-size: auto 96px; }
    .leaf img { width: 100%; display: block; border: 1px solid rgba(62,74,82,0.18);
        border-radius: 3px; background: #ebedee; }
    .leaf span { display: block; text-align: center; font-size: 11px; color: #8494a2; padding-top: 3px; }
    .leaf:hover img { border-color: #a8432b; }
    .leaf:hover span { color: #a8432b; }
    /* 灯箱 */
    .lb { position: fixed; inset: 0; background: rgba(20,22,25,0.94); z-index: 99;
        display: none; align-items: center; justify-content: center; }
    .lb.on { display: flex; }
    .lb img { max-width: 94vw; max-height: 86vh; object-fit: contain; }
    .lb-bar { position: fixed; top: 0; left: 0; right: 0; height: 46px; display: flex;
        align-items: center; gap: 16px; padding: 0 16px; color: #e8eaed; font-size: 13.5px;
        background: rgba(20,22,25,0.7); }
    .lb-bar .sp { flex: 1; }
    .lb-bar a, .lb-bar button { color: #e8eaed; background: none; border: 1px solid rgba(232,234,237,0.45);
        border-radius: 6px; padding: 4px 10px; font-size: 13px; cursor: pointer; text-decoration: none; }
    .lb-bar button:hover, .lb-bar a:hover { border-color: #fff; color: #fff; }
    .lb-nav { position: fixed; top: 50%; transform: translateY(-50%); font-size: 30px;
        color: rgba(232,234,237,0.75); background: none; border: none; cursor: pointer; padding: 12px; }
    .lb-nav:hover { color: #fff; }
    #lbPrev { left: 6px; } #lbNext { right: 6px; }
    @media (prefers-color-scheme: dark) {
        body { background: #16181c; color: #cbd5e1; }
        .container { background: #1e2126; }
        .header-title, h2 { color: #e2e8f0; }
        .back-link { color: #cbd5e1; }
        .note { color: #94a3b8; }
        .leaf img { border-color: rgba(148,163,184,0.25); background: #23262c; }
    }
"""

SHUYING_JS = """
<script>
(function () {
  var leaves = [].slice.call(document.querySelectorAll('.leaf'));
  var lb = document.getElementById('lb');
  var img = document.getElementById('lbImg');
  var num = document.getElementById('lbNum');
  var open = document.getElementById('lbOpen');
  var cur = -1;

  function show(i) {
    if (i < 0 || i >= leaves.length) return;
    cur = i;
    var a = leaves[i];
    img.src = a.getAttribute('data-src');
    img.alt = a.getAttribute('data-alt');
    num.textContent = a.getAttribute('data-alt') + '　(' + (i + 1) + '/' + leaves.length + ')';
    open.href = a.getAttribute('data-src');
    lb.classList.add('on');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    lb.classList.remove('on');
    document.body.style.overflow = '';
  }
  leaves.forEach(function (a, i) {
    a.addEventListener('click', function (e) { e.preventDefault(); show(i); });
  });
  document.getElementById('lbClose').addEventListener('click', close);
  document.getElementById('lbPrev').addEventListener('click', function () { show(cur - 1); });
  document.getElementById('lbNext').addEventListener('click', function () { show(cur + 1); });
  lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
  document.addEventListener('keydown', function (e) {
    if (!lb.classList.contains('on')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(cur - 1);
    if (e.key === 'ArrowRight') show(cur + 1);
  });
  // 支持从正文页带 #v1-020 锚点直达
  if (location.hash) {
    var t = document.querySelector(location.hash);
    if (t) t.scrollIntoView();
  }
})();
</script>
"""


def build_shuying(counts):
    sections = []
    for i, (srcdir, prefix, count) in enumerate(counts):
        vol = i + 1
        cells = "".join(
            '<a class="leaf" href="scans/{p}-{n:03d}.webp" '
            'data-src="scans/{p}-{n:03d}.webp" data-alt="冊{v} 第 {n} 叶" id="{p}-{n:03d}">'
            '<img src="scans/thumb/{p}-{n:03d}.webp" alt="心史 冊{v} 第 {n} 叶" '
            'loading="lazy" decoding="async" width="256" height="186">'
            '<span>第 {n} 叶</span></a>'.format(
                p=prefix, n=n, v=cn(vol)
            )
            for n in range(1, count + 1)
        )
        sections.append(
            f'<h2>冊{cn(vol)}<span class="cnt">{count} 叶</span></h2>\n<div class="grid">{cells}</div>'
        )
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>心史 书影 · 明崇祯刊本全 247 叶 - 心史</title>
<meta name="description" content="《心史》明崇祯刊本原书书影，日本内阁文库藏，全二册二百四十七叶，逐叶可放大查看。">
<meta name="keywords" content="心史书影,铁函心史,明崇祯刊本,内阁文库,郑思肖,古籍书影,集思阁">
<meta property="og:title" content="心史 书影 · 明崇祯刊本">
<meta property="og:description" content="明崇祯刊本原书书影全二百四十七叶，日本内阁文库藏。">
<meta property="og:type" content="website">
<meta property="og:url" content="{SITE}{DOMAIN_PATH}/shuying.html">
<meta property="og:image" content="{SITE}/assets/images/og-cover.png">
<meta property="og:site_name" content="集思阁">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="{PRIMARY}">
<link rel="canonical" href="{SITE}{DOMAIN_PATH}/shuying.html">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<style>{SHUYING_CSS}</style>
</head>
<body>
<div class="container">
  <div class="page-header">
    <div class="header-title">心史 书影</div>
    <a class="back-link" href="./">← 返回心史</a>
  </div>
  <div class="note">{escape(s(SCAN_NOTE))}<br>点击任一叶可放大，键盘 ← → 翻叶，Esc 关闭。</div>
{''.join(sections)}
</div>
<div class="lb" id="lb">
  <div class="lb-bar">
    <span id="lbNum"></span><span class="sp"></span>
    <a id="lbOpen" href="#" target="_blank" rel="noopener">原图</a>
    <button id="lbClose" type="button">关闭</button>
  </div>
  <button class="lb-nav" id="lbPrev" type="button" aria-label="上一叶">‹</button>
  <img id="lbImg" src="" alt="">
  <button class="lb-nav" id="lbNext" type="button" aria-label="下一叶">›</button>
</div>
{SHUYING_JS}</body>
</html>
"""


def main():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    arts = data["articles"]
    for i, a in enumerate(arts):
        a["title"] = display_name(a)
        a["slug"] = f"xx{i + 1:02d}"
    OUT.mkdir(exist_ok=True)

    (OUT / "index.html").write_text(build_index(arts), encoding="utf-8")
    for idx, a in enumerate(arts):
        prev_a = arts[idx - 1] if idx > 0 else None
        next_a = arts[idx + 1] if idx < len(arts) - 1 else None
        (OUT / f"{a['slug']}.html").write_text(
            build_article(a, prev_a, next_a), encoding="utf-8")

    counts = [("vol1", "v1", VOL1), ("vol2", "v2", VOL2)]
    (OUT / "shuying.html").write_text(build_shuying(counts), encoding="utf-8")

    keep = {a["slug"] + ".html" for a in arts} | {"index.html", "shuying.html"}
    for f in OUT.glob("*.html"):
        if f.name not in keep:
            f.unlink()

    total_leaves = sum(c for _, _, c in counts)
    print(f"生成完成：{len(arts)} 篇 + 目录页 + 书影页（{total_leaves} 叶）→ {OUT}")
    for a in arts:
        print(f"  {a['slug']} {a['title']:18s} {len(a['paras']):3d} 段  {sum(len(p['text']) for p in a['paras']):6d} 字")


if __name__ == "__main__":
    main()
