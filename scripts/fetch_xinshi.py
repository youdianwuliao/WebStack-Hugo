#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取《宋郑所南先生心史》全文，产出 build_xinshi.py 所需的结构化数据。

数据源：识典古籍 https://www.shidianguji.com/book/NA11198
  明崇祯刊本，〔南宋〕郑思肖 撰、〔明〕林古度 校订，原书藏日本内阁文库。
  共 21 章 276 段，含自序一二三、咸淳集、大义集、中兴集二卷、后序一二、久久书、
  杂文、大义略叙、附录、又后序、总后序、自跋、盟言、正觉咒、书心史后。

用法：
    python3 scripts/fetch_xinshi.py            # 有缓存则复用，否则联网抓
    rm -rf /tmp/xinshi_text && python3 scripts/fetch_xinshi.py   # 强制重抓

输出：
    /tmp/xinshi_text/        各章节页 HTML 缓存（调试可比对）
    /tmp/xinshi_data.json    结构化数据，供 build_xinshi.py 使用
        {"meta": {...}, "articles": [{"order","name","startPage","endPage",
                                      "paras":[{"order","text"}]}]}
    文本仍是繁体，简繁转换交给 build 脚本（scripts/zh_toggle.py）。

关键点：该站 /api/ancientlib/read/* 全部被字节 argus 反爬拦截（curl 与无头浏览器
都只得到 {"errorCode":40001} / 页面 "Data exception"），**不要走接口**。
改为解析章节页 HTML 里内嵌的 window._ROUTER_DATA：
    loaderData["__session/(lang$)/book/$"]
      .bookInfo.catalog.chapters[]   全部章节：chapterId / paragraphCount / 起止页码
      .bookInfo.previewPages[]        全书级 8 页试读书影（与章节无关）
      .paragraphList[]                **当前章完整正文**
实测每章 len(paragraphList) == paragraphCount，即整章不漏，无需任何鉴权。
"""

import json
import re
import subprocess
import time
from pathlib import Path

BOOK = "NA11198"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "Chrome/120.0 Safari/537.36")
ENTRY = "1kcij377xgylv"           # 第一章（卷首）的 chapterId，用于取书目信息
OUT_DIR = Path("/tmp/xinshi_text")
OUT = Path("/tmp/xinshi_data.json")


def get(url, dest):
    """下载一个章节页；返回是否成功。"""
    for _ in range(3):
        r = subprocess.run(
            ["curl", "-sL", "-m", "40", "-A", UA,
             "-H", f"Referer: https://www.shidianguji.com/book/{BOOK}",
             "-o", str(dest), "-w", "%{http_code}", url],
            capture_output=True, text=True)
        if r.stdout.strip() == "200" and dest.stat().st_size > 50000:
            return True
        time.sleep(4)
    return False


def router(path):
    """取出页面内嵌的 window._ROUTER_DATA。"""
    h = path.read_text(encoding="utf-8", errors="ignore")
    i = h.find("window._ROUTER_DATA = ")
    j = h.find("</script>", i)
    return json.loads(h[i + len("window._ROUTER_DATA = "):j].rstrip().rstrip(";"))


def book_data(path):
    return router(path)["loaderData"]["__session/(lang$)/book/$"]


def main():
    OUT_DIR.mkdir(exist_ok=True)
    base = OUT_DIR / "book.html"
    entry_url = f"https://www.shidianguji.com/book/{BOOK}/chapter/{ENTRY}?version=22"
    if not (base.exists() and base.stat().st_size > 50000):
        if not get(entry_url, base):
            raise SystemExit("书目页抓取失败")
    page = book_data(base)
    bi = page["bookInfo"]
    chapters = bi["catalog"]["chapters"]
    meta = {
        "bookId": BOOK, "bookName": bi["bookName"], "version": bi["version"],
        "authors": bi["authors"], "edition": bi["edition"],
        "imageSource": bi["imageSource"], "library": bi["library"],
        "totalPage": bi["totalPage"], "coverUrl": bi["coverUrl"],
        "previewPages": bi["previewPages"],
    }
    print(f"《{bi['bookName']}》 {bi['edition']['editionDynastyName']}"
          f"{bi['edition']['edition']} · {bi['library']} · "
          f"共 {bi['totalPage']} 页 · {len(chapters)} 章")

    articles = []
    for idx, c in enumerate(chapters):
        name = "".join(x["content"] for x in c["chapterName"])
        f = OUT_DIR / f"ch{idx + 1:02d}.html"
        if not (f.exists() and f.stat().st_size > 50000):
            url = (f"https://www.shidianguji.com/book/{BOOK}/chapter/"
                   f"{c['chapterId']}?version={bi['version']}")
            if not get(url, f):
                print(f"  !! {name} 抓取失败")
                continue
            time.sleep(2)          # 别把对方打急了
        paras = []
        for p in book_data(f)["paragraphList"]:
            try:
                cj = json.loads(p["content"])
                text = "".join(l.get("content") or "" for l in cj.get("lines", []))
            except (ValueError, KeyError):
                text = ""
            text = re.sub(r"\s+", "", text)
            if text:
                paras.append({"order": p.get("inChapterOrder"), "text": text})
        articles.append({
            "order": idx + 1, "chapterId": c["chapterId"], "name": name,
            "startPage": c["startPageNum"], "endPage": c["endPageNumWithoutSubchapter"],
            "declared": c["paragraphCount"], "paras": paras,
        })
        flag = "OK " if len(paras) == c["paragraphCount"] else "差异"
        print(f"  {idx + 1:2d} {flag} 段 {len(paras):3d}/{c['paragraphCount']:3d}"
              f"  字 {sum(len(x['text']) for x in paras):6d}  {name}")

    OUT.write_text(json.dumps({"meta": meta, "articles": articles},
                              ensure_ascii=False, indent=1), encoding="utf-8")
    total = sum(len(x["text"]) for a in articles for x in a["paras"])
    print(f"\n合计 {len(articles)} 章 / {sum(len(a['paras']) for a in articles)} 段 / "
          f"{total} 字 → {OUT}")


if __name__ == "__main__":
    main()
