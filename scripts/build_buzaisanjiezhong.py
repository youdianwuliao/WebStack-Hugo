#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成《不在三界中》电子书模块（署名作者：者也）。

素材来源：xiuxian/ 下导出的公众号 PNG（内含知乎截图），
OCR 结果见 /home/zhaosl/tmp_xiuxian/ocr/paras.jsonl。

产物：
    buzaisanjiezhong/index.html      目录页
    buzaisanjiezhong/bzsjNN.html     各篇正文
用法：
    python3 scripts/build_buzaisanjiezhong.py
"""
import html
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'scripts', 'data', 'buzaisanjiezhong')
SRC = os.path.join(DATA, 'paras.jsonl')            # 精读 OCR 结果（篇 -> 问答段落）
TITLE_MAP = os.path.join(DATA, 'chapter_titles.json')   # 篇名人工定稿
SCANS_MANIFEST = os.path.join(DATA, 'scans_manifest.json')  # 篇 -> 原图 WebP 清单
OUTDIR = os.path.join(ROOT, 'buzaisanjiezhong')
BOOK = '不在三界中'
AUTHOR = '者也'
HOST = 'https://www.justgame.top/buzaisanjiezhong/'
ACCENT = '#3182ce'

# OCR 常见误字（保守替换，只处理高置信的形近字）
FIXES = [
    ('志忑', '忐忑'), ('笑箸', '笑靥'), ('买啥', '卖傻'), ('维限', '维艰'),
    ('本米', '本来'), ('蒙绕', '萦绕'), ('海市楼', '海市蜃楼'), ('一但', '一旦'),
    ('趋之若的', '趋之若鹜的'), ('苍茫的大干', '苍茫的大千'), ('传音干里', '传音千里'),
    ('主宰当下的圣神', '主宰当下的神圣'), ('白暂', '白皙'),
]


EMOJI_LEFT = re.compile(r'\[[^\]】\n]{1,8}[\]】]|【[^】\]]{1,8}[】\]]')
# 混进正文的知乎交互提示与广告
UI_TOKENS = [
    re.compile(r'\d{0,2}[\.、]?\s*(邀请回答\s*[0-9A-Za-z]{0,2}\s*写回答|邀请回答|写回答)'),
    re.compile(r'Q不反馈'),
    re.compile(r'你赞同过(冥想修行相关内容|该回答|该文章)?'),
    re.compile(r'你关注的[\u4e00-\u9fa5A-Za-z]{0,8}赞同'),
    re.compile(r'CHERON[\u4e00-\u9fa5]{0,4}'),
    re.compile(r'崩坏[:：]星穹铁道[\u4e00-\u9fa5！，。]{0,8}'),
    re.compile(r'没有更多内容(发布)?'),
]
AD_MARKERS = ('广告', '房源', '看房', '自如', '租房', '省钱', '冤枉钱', '全新版本上线',
              '等你来开拓', '扫码', '优惠', '包邮', '点击下载')


def fix_text(t):
    for a, b in FIXES:
        t = t.replace(a, b)
    t = EMOJI_LEFT.sub('', t)
    for r in UI_TOKENS:
        t = r.sub('', t)
    # 广告整句剔除
    if any(m in t for m in AD_MARKERS):
        t = ''.join(p for p in re.split(r'(?<=[。！？])', t)
                    if not any(m in p for m in AD_MARKERS))
    return t.strip()


def dedupe_lines(lines):
    """剔除截图重叠造成的整段复读。"""
    out = []
    i = 0
    n = len(lines)
    while i < n:
        matched = 0
        for j in range(max(0, len(out) - 40), len(out)):
            if out[j] == lines[i]:
                k = 0
                while (j + k < len(out) and i + k < n and out[j + k] == lines[i + k]):
                    k += 1
                if k >= 3:
                    matched = k
                    break
        if matched:
            i += matched
        else:
            out.append(lines[i])
            i += 1
    return out


GENERIC_TITLE = {'分享图片', '每日一图', '无题'}

# 知乎问题标题被截图截断/串行的两处，按原文补全
Q_FIXES = {
    '灵魂」是什么？': '「灵魂」是什么？',
    '松、冷静的状态，像是极度理智，几乎没有情绪波动？':
        '怎样去除心中杂念，让人进入一种很轻松、冷静的状态？',
    '在观呼吸，否则便和睡觉没区别，这样做对吗？':
        '观呼吸时，时刻保持清醒，要意识到自己是自己在观呼吸，否则便和睡觉没区别，这样做对吗？',
}


# 截图里问题标题被切掉/未识出的两篇，按原图补回问题（第二遍校验时所见）
Q_BY_SRC = {
    '老家的房子_2247486339.png': ['读书就能增加智慧，就可以开悟，觉悟吗？'],
    '都是你_2247486167.png': ['宇宙的创造者是谁，而他的创造者又是谁？'],
}


def auto_title(src, items):
    m = re.match(r'^(.*)_\d+\.png$', src)
    base = m.group(1) if m else src
    if base not in GENERIC_TITLE:
        return base
    for it in items:
        q = it['q'].strip(' ？?')
        if q:
            return q[:16]
    for it in items:
        for p in it['paras']:
            s = p.replace('\n', '')
            if len(s) >= 6:
                return s[:14]
    return base


def load_chapters():
    rows = [json.loads(l) for l in open(SRC, encoding='utf-8')]
    overrides = json.load(open(TITLE_MAP, encoding='utf-8')) if os.path.exists(TITLE_MAP) else {}
    chapters = []
    for r in rows:
        f = r['file']
        items = []
        for it in r['items']:
            paras = []
            for p in it['paras']:
                # ocr 侧约定：单元素即整段散文，多元素为逐行排布的诗词
                if len(p) > 1:
                    lines = dedupe_lines([x.strip() for x in p if x.strip()])
                    if lines:
                        paras.append('\n'.join(fix_text(x) for x in lines))
                else:
                    text = fix_text(p[0].strip()) if p else ''
                    if text:
                        paras.append(text)
            if not paras:
                continue
            items.append({'q': Q_FIXES.get(it['q'], fix_text(it['q'])), 'paras': paras})
        if not items:
            continue
        for i, q in enumerate(Q_BY_SRC.get(f, [])):
            if i < len(items) and not items[i]['q']:
                items[i]['q'] = q
        m = re.search(r'_(\d+)\.png$', f)
        chapters.append({
            'src': f,
            'title': overrides.get(f) or auto_title(f, items),
            'items': items,
            'order': int(m.group(1)) if m else 0,
        })
    chapters.sort(key=lambda c: c['order'])
    return chapters


# 评论痕迹（人名 / 作者标识 / IP 属地 / 时间）：保留但用空格与灰字区分，让正文仍是重心
CMT_PATTERNS = [
    r'者也作者',
    r'有点无聊',
    r'\d+(?:秒|分钟|小时|天|月|年)前',
    r'刚刚|昨天|今天|前天',
    r'·IP属地[\u4e00-\u9fa5]{2,4}',
    r'[\u4e00-\u9fa5]{2,4}·禁止转载',
    r'默认最新|最新默认',
    r'评论\d*|点赞\d*',
]
CMT_RES = [re.compile(p) for p in CMT_PATTERNS]


def mark_comment_traces(text):
    """在已转义的文本里给评论痕迹加空格与灰字标记。"""
    for r in CMT_RES:
        text = r.sub(lambda m: ' <span class="cmt">{}</span> '.format(m.group(0)), text)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\s+([，。！？、；：”）】》])', r'\1', text)
    text = re.sub(r'([（“【《])\s+', r'\1', text)
    return text.strip()


def esc(t):
    return html.escape(t, quote=True)


def summary(ch):
    for it in ch['items']:
        for p in it['paras']:
            s = p.replace('\n', '')
            if len(s) >= 30:
                return s[:70]
    return ch['title']


def chapter_page(ch, idx, total, chapters):
    prev_ch = chapters[idx - 1] if idx > 0 else None
    next_ch = chapters[idx + 1] if idx + 1 < total else None
    body = []
    title_key = re.sub(r'\s+', '', ch['title'])
    for it in ch['items']:
        if it['q'] and re.sub(r'\s+', '', it['q']) != title_key:
            body.append('<h2>' + esc(it['q']) + '</h2>')
        for p in it['paras']:
            if '\n' in p:
                body.append('<p class="verse">' + '<br>'.join(mark_comment_traces(esc(x)) for x in p.split('\n')) + '</p>')
            else:
                body.append('<p>' + mark_comment_traces(esc(p)) + '</p>')
    prev_html = ('<a href="' + prev_ch['file'] + '" class="prev">← ' + esc(prev_ch['title']) + '</a>'
                 if prev_ch else '<a class="prev empty" href="#">← 上一篇</a>')
    next_html = ('<a href="' + next_ch['file'] + '" class="next">' + esc(next_ch['title']) + ' →</a>'
                 if next_ch else '<a class="next empty" href="#">下一篇 →</a>')
    desc = summary(ch)
    scans = ch.get('scans') or []
    if len(scans) > 1:
        links = ' / '.join(
            '<a href="scans/{}" target="_blank" rel="noopener">第 {} 段</a>'.format(s, i + 1)
            for i, s in enumerate(scans))
        scan_html = ('<div class="scan-link">原文为公众号转发的知乎截图（文字由此识读整理），'
                     '原图较长，分段查看：{}</div>'.format(links))
    elif scans:
        scan_html = ('<div class="scan-link">原文为公众号转发的知乎截图（文字由此识读整理），'
                     '<a href="scans/{}" target="_blank" rel="noopener">查看原图 →</a></div>'.format(scans[0]))
    else:
        scan_html = ''
    return f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(ch['title'])} - {BOOK}</title>
<meta name="description" content="{esc(desc)}">
<meta name="keywords" content="{BOOK},{AUTHOR},{esc(ch['title'])},知乎,修行,集思阁">
<meta property="og:title" content="{esc(ch['title'])} · {BOOK}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="{HOST}{ch['file']}">
<meta property="og:image" content="https://www.justgame.top/assets/images/og-cover.png">
<meta property="og:site_name" content="集思阁">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="{ACCENT}">
<link rel="canonical" href="{HOST}{ch['file']}">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../gushi/gushi.css">
<style>
        .article-body p {{ text-indent: 0; }}
        .article-body .verse {{ text-align: center; line-height: 2.1; letter-spacing: 0.06em; white-space: pre-line; }}
        .article-body .cmt {{ color: #9aa4b2; font-size: 0.86em; }}
        @media (prefers-color-scheme: dark) {{ .article-body .cmt {{ color: #7c8899; }} }}
        .scan-link {{
            margin: 26px 0 4px; padding: 10px 14px; border-radius: 10px;
            font-size: 12.5px; line-height: 1.8; color: var(--text-light);
            background: var(--accent-soft); border: 1px solid var(--accent-border);
        }}
        .scan-link a {{ color: var(--accent); }}
</style>
</head>
<body>
<div class="container">
  <div class="article">
    <div class="top-bar">
      <a href="./" class="back-link">← 返回{BOOK}</a>
      <span class="meta">第 {idx + 1} 篇 / 共 {total} 篇</span>
    </div>
    <h1>{esc(ch['title'])}</h1>
    <div class="meta">{BOOK} · {AUTHOR}</div>
    <div class="article-body">
{chr(10).join(body)}
    </div>
    {scan_html}
    <div class="pager">
      {prev_html}
      {next_html}
    </div>
  </div>
</div>
<button class="top-btn" id="topBtn" onclick="window.scrollTo({{top:0,behavior:'smooth'}})" title="返回顶部">↑</button>
<script src="../gushi/gushi.js"></script>
</body>
</html>
'''


def index_page(chapters):
    items = []
    for i, ch in enumerate(chapters):
        items.append(
            '<a class="chapter-item" href="{}" title="{}"><span class="ch-num">第 {} 篇</span>'
            '<span class="ch-title">{}</span></a>'.format(
                ch['file'], esc(ch['title']), i + 1, esc(ch['title'])))
    grid = ''.join(items)
    return f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{BOOK} · 者也知乎文字全集在线阅读</title>
<meta name="description" content="《{BOOK}》收录知乎答主「{AUTHOR}」的文字，谈意识、修行、体证与因果，共 {len(chapters)} 篇，简体全文在线阅读。">
<meta name="keywords" content="{BOOK},{AUTHOR},知乎,修行,体证,意识,因果,玄学,集思阁">
<meta property="og:title" content="{BOOK} · {AUTHOR}">
<meta property="og:description" content="收录知乎答主「{AUTHOR}」的文字，共 {len(chapters)} 篇。">
<meta property="og:type" content="website">
<meta property="og:url" content="{HOST}">
<meta property="og:image" content="https://www.justgame.top/assets/images/og-cover.png">
<meta property="og:site_name" content="集思阁">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="{ACCENT}">
<link rel="canonical" href="{HOST}">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "Book",
  "name": "{BOOK}",
  "url": "{HOST}",
  "inLanguage": "zh-Hans",
  "author": {{ "@type": "Person", "name": "{AUTHOR}" }},
  "isPartOf": {{ "@type": "WebSite", "name": "集思阁", "url": "https://www.justgame.top/" }},
  "numberOfPages": {len(chapters)}
}}
</script>
<style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        html {{ scroll-behavior: smooth; }}
        body {{
            font-family: "SF Pro Display", "Helvetica Neue", "Segoe UI", Arial, sans-serif;
            background: linear-gradient(135deg, #eef2f8 0%, #e6ecf5 50%, #f4f1ec 100%);
            color: #2d3748; margin: 0; padding: 20px; min-height: 100vh;
            -webkit-font-smoothing: antialiased;
        }}
        .container {{
            max-width: 1100px; margin: 0 auto; background: rgba(255,255,255,0.78);
            backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
            border-radius: 20px; padding: 30px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.08); border: 1px solid rgba(255,255,255,0.6);
        }}
        .header-section {{
            background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(238,242,248,0.9));
            border-radius: 16px; padding: 26px 28px; margin-bottom: 28px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid rgba(255,255,255,0.7);
            position: relative; overflow: hidden;
        }}
        .header-section::before {{
            content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
            background: linear-gradient(90deg, {ACCENT}, #7c5cbf, {ACCENT});
        }}
        .page-header {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 12px; }}
        .header-title {{
            font-size: 2rem; font-weight: 700;
            background: linear-gradient(135deg, #2d3748, {ACCENT});
            -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
            display: flex; align-items: center; gap: 12px;
        }}
        .header-subtitle {{ text-align: center; color: #718096; font-size: 1rem; }}
        .back-link {{
            display: inline-block; color: {ACCENT}; text-decoration: none; font-weight: 500;
            padding: 10px 20px; border-radius: 10px; transition: all 0.3s ease;
            background: rgba(49,130,206,0.08); border: 1px solid rgba(49,130,206,0.2);
        }}
        .back-link:hover {{ background: {ACCENT}; color: #fff; transform: translateY(-1px); }}
        .vol-block {{
            background: rgba(255,255,255,0.65); border-radius: 14px; padding: 20px 22px;
            margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.6);
        }}
        .vol-head {{ display: flex; align-items: baseline; gap: 12px; margin-bottom: 6px; flex-wrap: wrap; }}
        .vol-title {{ font-size: 1.25rem; font-weight: 700; color: {ACCENT}; }}
        .vol-count {{ font-size: 13px; color: {ACCENT}; background: rgba(49,130,206,0.08); padding: 2px 10px; border-radius: 999px; }}
        .vol-desc {{ font-size: 13.5px; color: #718096; margin-bottom: 14px; line-height: 1.7; }}
        .chapter-grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }}
        .chapter-item {{
            display: block; color: #334155; text-decoration: none; font-size: 13.5px; line-height: 1.4;
            background: rgba(255,255,255,0.7); border: 1px solid rgba(255,255,255,0.7);
            border-radius: 8px; padding: 8px 10px; transition: all 0.25s;
        }}
        .chapter-item:hover {{
            background: {ACCENT}; color: #fff; transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(49,130,206,0.25);
        }}
        .chapter-item .ch-num {{ display: block; font-size: 11px; opacity: 0.7; margin-bottom: 2px; }}
        .footer-count {{ text-align: center; padding: 18px 0 5px; font-size: 12px; color: #999; }}
        .top-btn {{
            position: fixed; bottom: 24px; right: 24px; width: 40px; height: 40px; border-radius: 50%;
            border: none; background: {ACCENT}; color: #fff; cursor: pointer; display: none;
            align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(49,130,206,0.4);
            transition: all 0.3s; z-index: 100;
        }}
        .top-btn.show {{ display: flex; }}
        .disclaimer {{
            margin-top: 18px; padding: 12px 16px; border-radius: 10px; font-size: 12.5px;
            color: #8a94a6; background: rgba(49,130,206,0.05); line-height: 1.8;
        }}
        @media (max-width: 640px) {{
            body {{ padding: 12px; }}
            .container {{ padding: 16px; border-radius: 16px; }}
            .header-title {{ font-size: 1.5rem; }}
            .chapter-grid {{ grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }}
        }}
        @media (prefers-reduced-motion: reduce) {{ *, *::before, *::after {{ animation: none !important; transition: none !important; }} }}
        @media (prefers-color-scheme: dark) {{
            body {{ background: linear-gradient(135deg, #141b2d 0%, #1a2332 50%, #232a38 100%); color: #e2e8f0; }}
            .container {{ background: rgba(30,41,59,0.92); border-color: rgba(100,116,139,0.25); }}
            .header-section {{ background: linear-gradient(135deg, rgba(30,41,59,0.95), rgba(38,50,70,0.95)); border-color: rgba(100,116,139,0.25); }}
            .header-title {{ background: linear-gradient(135deg, #e8eef7, #7eb3e8); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }}
            .header-subtitle {{ color: #94a3b8; }}
            .vol-title {{ color: #7eb3e8; }}
            .vol-count {{ color: #7eb3e8; background: rgba(126,179,232,0.12); }}
            .vol-block {{ background: rgba(30,41,59,0.7); border-color: rgba(100,116,139,0.2); }}
            .chapter-item {{ background: rgba(30,41,59,0.75); border-color: rgba(100,116,139,0.25); color: #cbd5e1; }}
            .chapter-item:hover {{ background: {ACCENT}; color: #fff; }}
            .vol-desc, .footer-count {{ color: #94a3b8; }}
            .back-link {{ background: rgba(126,179,232,0.15); border-color: rgba(126,179,232,0.4); color: #7eb3e8; }}
            .disclaimer {{ color: #94a3b8; background: rgba(126,179,232,0.07); }}
        }}
</style>
</head>
<body>
<div class="container">
<div class="header-section">
<div class="page-header">
<div class="header-title">
<svg fill="none" height="30" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="30" xmlns="http://www.w3.org/2000/svg"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
{BOOK}
</div>
<a class="back-link" href="../index.html">← 返回首页</a>
</div>
<div class="header-subtitle">{AUTHOR} · 知乎文字合集 · 共 {len(chapters)} 篇</div>
</div>
<div class="vol-block">
<div class="vol-head"><span class="vol-title">目录</span><span class="vol-count">{len(chapters)} 篇</span></div>
<div class="vol-desc">知乎答主「{AUTHOR}」的文字，谈意识、虚空、修行体证与因果轮回。原文为公众号转发的知乎截图，此处由图片文字识读整理而成，序号按发布时间先后排列。</div>
<div class="chapter-grid">{grid}</div>
</div>
<div class="disclaimer">说明：本书文字来自公众号中转载的知乎截图，经 OCR 识读后整理，个别字词可能仍有识读误差，每篇正文末尾可查看该篇原始截图自行核对；仅供个人研读使用，版权归原作者「{AUTHOR}」所有。</div>
<div class="footer-count">{BOOK} · {AUTHOR} · 集思阁 · 共 {len(chapters)} 篇</div>
</div>
<button class="top-btn" id="topBtn" onclick="window.scrollTo({{top:0,behavior:'smooth'}})" title="返回顶部">↑</button>
<script src="../gushi/gushi.js"></script>
</body>
</html>
'''


def main():
    chapters = load_chapters()
    os.makedirs(OUTDIR, exist_ok=True)
    manifest = json.load(open(SCANS_MANIFEST, encoding='utf-8')) if os.path.exists(SCANS_MANIFEST) else {}
    for i, ch in enumerate(chapters):
        ch['file'] = 'bzsj{:02d}.html'.format(i + 1)
        ch['scans'] = manifest.get(ch['src'], [])
    for i, ch in enumerate(chapters):
        with open(os.path.join(OUTDIR, ch['file']), 'w', encoding='utf-8') as f:
            f.write(chapter_page(ch, i, len(chapters), chapters))
    with open(os.path.join(OUTDIR, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(index_page(chapters))
    print('生成 {} 篇 + 目录页'.format(len(chapters)))
    for i, ch in enumerate(chapters, 1):
        print('  {:02d} {}  <- {}'.format(i, ch['title'], ch['src']))


if __name__ == '__main__':
    main()
