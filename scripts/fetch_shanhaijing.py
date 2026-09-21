#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取并清洗《山海经》，产出 build_shanhaijing.py 所需的结构化数据。

数据源：维基文库 https://zh.wikisource.org/wiki/山海經
  十九页：〈郭璞序〉＋〈山经〉五篇（南山经…中山经）＋〈海经〉十三篇
  （海外四经、海内四经、大荒四经、海内经）。
  每篇是校点过的繁体本，正文中夹郭璞注（{{*|…}}），另有 {{另|…}} 异文等模板。

用法：
    python3 scripts/fetch_shanhaijing.py            # 有缓存则复用，否则联网抓
    rm /tmp/shj_raw/all.json && python3 scripts/fetch_shanhaijing.py   # 强制重抓

输出：
    /tmp/shj_raw/all.json          原始 wikitext 缓存（每页一份 .wiki 便于核对）
    /tmp/shanhaijing_data.json     清洗后的结构化数据，供 build_shanhaijing.py 使用
        {
          "book": "山海经",
          "articles": [
            {"slug": "xuyan", "title": "郭璞序", "vol": "序", "blocks": [
                {"type": "h", "text": "南山经之首"},
                {"type": "p", "segs": [[0, "正文"], [1, "郭璞注"]]}   # 0=正文 1=注
            ]}
          ]
        }
    文本仍是繁体，简繁转换交给 build 脚本（scripts/zh_toggle.py）。

两个必须知道的坑：
  1. 本机 DNS 把 zh.wikisource.org 解析到不通的中国节点，必须用
     curl --resolve zh.wikisource.org:443:208.80.153.224（Wikimedia codfw text-lb）。
  2. w/api.php 有速率限制，调用过密会持续返回 429。故带描述性 UA、每批之间 sleep，
     且一次请求最多带 10 个标题而非逐页取。
"""

import json
import re
import subprocess
import time
from pathlib import Path

UA = "JisiGeImporter/1.0 (https://www.justgame.top/; personal static library)"
WIKISOURCE_IP = "208.80.153.224"
API = "https://zh.wikisource.org/w/api.php"
RAW_DIR = Path("/tmp/shj_raw")
OUT = Path("/tmp/shanhaijing_data.json")

# 篇目顺序与 slug（照维基文库主页面「山经 / 海经」次序）
ORDER = [
    ("郭璞序", "xuyan", "序"),
    ("南山經", "shj01", "山经"),
    ("西山經", "shj02", "山经"),
    ("北山經", "shj03", "山经"),
    ("東山經", "shj04", "山经"),
    ("中山經", "shj05", "山经"),
    ("海外南經", "shj06", "海经"),
    ("海外西經", "shj07", "海经"),
    ("海外北經", "shj08", "海经"),
    ("海外東經", "shj09", "海经"),
    ("海內南經", "shj10", "海经"),
    ("海內西經", "shj11", "海经"),
    ("海內北經", "shj12", "海经"),
    ("海內東經", "shj13", "海经"),
    ("大荒東經", "shj14", "海经"),
    ("大荒南經", "shj15", "海经"),
    ("大荒西經", "shj16", "海经"),
    ("大荒北經", "shj17", "海经"),
    ("海內經", "shj18", "海经"),
]

DROP_TEMPLATES = {"Textquality", "header2", "header", "PD-old", "檢索", "其它版本"}


# ---------------------------------------------------------------- 抓取


def api(params):
    """调用维基文库 API，失败重试；返回解析后的 JSON。"""
    args = ["curl", "-s", "-m", "40",
            "--resolve", f"zh.wikisource.org:443:{WIKISOURCE_IP}",
            "-A", UA, "-G", API]
    for k, v in params.items():
        args += ["--data-urlencode", f"{k}={v}"]
    for _ in range(4):
        out = subprocess.run(args, capture_output=True, text=True).stdout
        if out.strip().startswith("{"):
            return json.loads(out)
        time.sleep(6)          # 多半是 429，退避后重试
    raise SystemExit("维基文库 API 连续失败，稍后再试")


def fetch_all():
    """逐批取回全部篇目的 wikitext，并落盘缓存。"""
    titles = ["山海經/" + name for name, _, _ in ORDER]
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    pages = {}
    for i in range(0, len(titles), 10):     # 批量取，减少请求数避开限流
        d = api({"action": "query", "prop": "revisions", "rvprop": "content",
                 "rvslots": "main", "titles": "|".join(titles[i:i + 10]),
                 "format": "json", "formatversion": "2"})
        for p in d["query"]["pages"]:
            pages[p["title"]] = p["revisions"][0]["slots"]["main"]["content"]
        time.sleep(3)
    for t in titles:
        (RAW_DIR / (t.split("/")[-1] + ".wiki")).write_text(pages[t], encoding="utf-8")
    (RAW_DIR / "all.json").write_text(
        json.dumps({"order": [n for n, _, _ in ORDER], "pages": pages},
                   ensure_ascii=False), encoding="utf-8")
    print(f"已抓取 {len(pages)} 页，共 {sum(len(v) for v in pages.values())} 字符 → {RAW_DIR}")
    return pages


def load_pages():
    cache = RAW_DIR / "all.json"
    if cache.exists():
        print(f"复用缓存 {cache}（删除该文件可强制重抓）")
        return json.loads(cache.read_text(encoding="utf-8"))["pages"]
    return fetch_all()


# ---------------------------------------------------------------- 清洗


def find_template_end(s, start):
    """s[start:start+2] == '{{'，返回配对 '}}' 之后的下标。"""
    depth = 0
    i = start
    while i < len(s):
        if s.startswith("{{", i):
            depth += 1
            i += 2
            continue
        if s.startswith("}}", i):
            depth -= 1
            i += 2
            if depth == 0:
                return i
            continue
        i += 1
    return len(s)


def split_top_level(s, sep="|"):
    """按顶层分隔符切分（忽略嵌套模板与链接内部的 sep）。"""
    parts, buf, i, depth = [], "", 0, 0
    while i < len(s):
        if s.startswith("{{", i):
            depth += 1
            buf += "{{"
            i += 2
            continue
        if s.startswith("}}", i):
            depth -= 1
            buf += "}}"
            i += 2
            continue
        if s.startswith("[[", i):
            depth += 1
            buf += "[["
            i += 2
            continue
        if s.startswith("]]", i):
            depth -= 1
            buf += "]]"
            i += 2
            continue
        if s[i] == sep and depth == 0:
            parts.append(buf)
            buf = ""
            i += 1
            continue
        buf += s[i]
        i += 1
    parts.append(buf)
    return parts


def strip_links(s):
    """[[A|B]] -> B，[[A]] -> A，分类链接删除。"""
    s = re.sub(r"\[\[\s*(?:Category|分類|cat)\s*:[^\]]*\]\]", "", s)
    s = re.sub(r"\[\[([^\[\]\|]+)\|([^\[\]]*)\]\]", r"\2", s)
    s = re.sub(r"\[\[([^\[\]]+)\]\]", r"\1", s)
    return s


def expand(text, anno=False, out=None):
    """展开 wikitext，把结果按 (是否郭璞注, 文本) 追加到 out。

    注意：遇到模板时先把已缓冲的正文吐出，否则模板内容会插到正文之前
    （曾因此把「又東三百里，曰堂庭之山」错排成「堂又東三百里，曰庭之山」）。
    """
    if out is None:
        out = []
    buf = ""

    def flush():
        nonlocal buf
        if buf:
            out.append((anno, buf))
            buf = ""

    i = 0
    while i < len(text):
        if text.startswith("{{", i):
            end = find_template_end(text, i)
            body = text[i + 2:end - 2]
            parts = split_top_level(body)
            name = parts[0].strip()
            args = parts[1:]
            if name == "*":
                flush()
                expand("|".join(args), not anno, out)
            elif name in ("另", "另2", "!"):
                flush()
                if args:                     # {{另|正|异…}} 取第一个
                    expand(args[0], anno, out)
            elif name in DROP_TEMPLATES:
                pass
            elif name == "YL":
                flush()
                if args:
                    expand(args[0], anno, out)
            else:
                # 未知模板：取第一个非命名参数，保底不丢字
                for a in args:
                    if "=" not in a:
                        flush()
                        expand(a, anno, out)
                        break
            i = end
            continue
        buf += text[i]
        i += 1
    flush()
    return out


def strip_named_templates(s, names):
    """删除指定名字的模板（支持跨行），其余原样保留。"""
    out = []
    i = 0
    while i < len(s):
        if s.startswith("{{", i):
            end = find_template_end(s, i)
            body = s[i + 2:end - 2]
            name = split_top_level(body)[0].strip()
            if name in names:
                i = end
                continue
            out.append(s[i:end])
            i = end
            continue
        out.append(s[i])
        i += 1
    return "".join(out)


def clean_wikitext(s):
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    s = strip_named_templates(s, DROP_TEMPLATES)
    s = re.sub(r"<gallery>.*?</gallery>", "", s, flags=re.S)   # 篇末插图，正文版不要
    s = re.sub(r"<ref[^>]*/>", "", s)
    s = re.sub(r"<ref[^>]*>.*?</ref>", "", s, flags=re.S)
    s = re.sub(r"<references\s*/?>", "", s)
    s = re.sub(r"</?onlyinclude>|</?noinclude>|__NOEDITSECTION__|__NOTOC__", "", s)
    s = re.sub(r"</?sub>|</?small>|</?big>", "", s)
    # 袁珂校注（现代编辑语），与四库／郭注体例不合，去掉
    s = re.sub(r"（珂案：[^）]*）", "", s)
    s = re.sub(r"珂案：[^。]*。", "", s)
    return s


def parse_page(wikitext):
    """整页清洗后按空行切段：标题成 h 块，其余合并成一段并解析正文／郭注。"""
    s = clean_wikitext(wikitext)
    # 行首小节标题先提成独立块，避免与紧随其后的正文挤在一起
    s = re.sub(r"^=+\s*(.+?)\s*=+[ \t\u3000]*$", r"\n\n@@H@@\1\n\n", s, flags=re.M)
    blocks = []
    for chunk in re.split(r"\n[ \t\u3000]*\n", s):
        chunk = chunk.strip("\n").strip()
        if not chunk:
            continue
        if chunk.startswith("@@H@@"):
            title = re.sub(r"\s+", "", chunk[5:])
            if title:
                blocks.append({"type": "h", "text": title})
            continue
        para = re.sub(r"\s*\n\s*", "", chunk).strip("\u3000").strip()
        if not para:
            continue
        segs = expand(para)
        merged = []
        for anno, text in segs:
            text = strip_links(text)
            text = re.sub(r"[ \t]+", " ", text).strip()
            if not text:
                continue
            if merged and merged[-1][0] == anno:
                merged[-1][1] += text
            else:
                merged.append([1 if anno else 0, text])
        if merged:
            blocks.append({"type": "p", "segs": merged})
    return blocks


def main():
    pages = load_pages()
    articles = []
    for name, slug, vol in ORDER:
        blocks = parse_page(pages["山海經/" + name])
        n_char = sum(len(t) for b in blocks if b["type"] == "p" for _, t in b["segs"])
        n_anno = sum(1 for b in blocks if b["type"] == "p" for a, _ in b["segs"] if a)
        print(f"  {name:6s} {slug:6s} 块={len(blocks):4d} 正文={n_char:6d} 字 注段={n_anno:4d}")
        articles.append({"slug": slug, "title": name, "vol": vol, "blocks": blocks})

    OUT.write_text(json.dumps(
        {"book": "山海经", "source": "https://zh.wikisource.org/wiki/山海經",
         "articles": articles}, ensure_ascii=False, indent=1), encoding="utf-8")
    total = sum(len(t) for a in articles for b in a["blocks"]
                if b["type"] == "p" for _, t in b["segs"])
    print(f"\n共 {len(articles)} 篇，正文合计 {total} 字 → {OUT}")


if __name__ == "__main__":
    main()
