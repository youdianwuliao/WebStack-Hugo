#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""下载《宋郑所南先生心史》明崇祯刊本的全部原书扫描。

来源：国立公文書館デジタルアーカイブ（公开、免费、可下载）
  簿册页 https://www.digital.archives.go.jp/file/1083674
    冊一 https://www.digital.archives.go.jp/img/2844069  122 叶
    冊二 https://www.digital.archives.go.jp/img/2844071  125 叶
  即识典古籍那本书影的源头（其 imageSource 写着「日本内阁文库」）。

用法：
    python3 scripts/fetch_xinshi_scans.py
    # 已下过的叶会自动跳过，中断后重跑即可续传

输出：
    ~/xinshi-scans/vol1/0001.jpg … vol2/0125.jpg   3000px 宽 JPEG（站方上限）
    ~/xinshi-scans/manifest.json                   每叶的 itemId / 原始文件名 / 来源 URL
    再用 scripts/prep_xinshi_scans.py 转成站点用的 WebP。

两个关键点：
  1. 阅览器页 /img/<volumeId> 里内嵌 najContentList 变量，是该册全部叶的完整清单
     （id / contentName / path / 尺寸），不必走任何被拦截的接口。
  2. 下载走 IIIF Image API 2.0：
       /content/item/da12/<itemId>/iiif/<name>.jp2/full/3000,/0/default.jpg
     站方 maxWidth/maxHeight = 3000；不带 IIIF 参数的原路径返回 400。
     **每叶是 6200x4500 的双叶展开图**（原书摊开的左右两版），所以「叶数」约为
     「页数」的一半——识典把每叶切成 _0/_1 两半，才报 484 页，实际只有 247 叶。
"""

import json
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

BASE = "https://www.digital.archives.go.jp"
VIEWERS = [("vol1", 2844069), ("vol2", 2844071)]
OUT = Path.home() / "xinshi-scans"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "Chrome/120.0 Safari/537.36")
WORKERS = 4          # 单线程约 100KB/s，4 路并发可把 247 叶压到 10 分钟级
SIZE = "3000,"       # IIIF size 参数：宽 3000px，高按比例


def curl(url, dest=None, timeout=180):
    args = ["curl", "-sL", "-m", str(timeout), "-A", UA]
    if dest:
        args += ["-o", str(dest), "-w", "%{http_code} %{size_download}"]
    args.append(url)
    return subprocess.run(args, capture_output=True, text=True).stdout.strip()


def fetch_viewer(img_id):
    """取阅览器页并解析出该册的 najContentList（该页偶有瞬时抽风，故重试）。"""
    m = None
    for attempt in range(4):
        html = subprocess.run(
            ["curl", "-sL", "-m", "60", "-A", UA, f"{BASE}/img/{img_id}"],
            capture_output=True, text=True).stdout
        m = re.search(r"najContentList\s*=\s*(\[.*?\])\s*;", html, re.S)
        if m:
            break
        print(f"  /img/{img_id} 第 {attempt + 1} 次未取到清单（{len(html)} 字符），重试…")
        time.sleep(5)
    if not m:
        raise SystemExit(f"未从 /img/{img_id} 解析出 najContentList")
    return json.loads(m.group(1))


def main():
    OUT.mkdir(exist_ok=True)
    manifest = {"source": "国立公文書館デジタルアーカイブ",
                "bookPage": "https://www.digital.archives.go.jp/file/1083674",
                "volumes": []}
    jobs = []
    for vol, img_id in VIEWERS:
        pages = fetch_viewer(img_id)
        (OUT / vol).mkdir(exist_ok=True)
        entry = {"volume": vol, "viewerId": img_id,
                 "viewer": f"{BASE}/img/{img_id}", "pages": []}
        for p in pages:
            n = int(re.search(r"_(\d+)\.jp2$", p["contentName"]).group(1))
            url = (f"{BASE}/content/item/da12/{p['id']}/iiif/"
                   f"{p['contentName']}/full/{SIZE}/0/default.jpg")
            dest = OUT / vol / f"{n:04d}.jpg"
            entry["pages"].append({"no": n, "itemId": p["id"],
                                   "contentName": p["contentName"],
                                   "size": p.get("size"), "url": url})
            if not (dest.exists() and dest.stat().st_size > 50000):
                jobs.append((url, dest))
        manifest["volumes"].append(entry)
        print(f"  {vol}: {len(pages)} 叶")

    print(f"待下载 {len(jobs)} 叶（已存在则跳过）")
    done = {"ok": 0, "fail": []}

    def work(job):
        url, dest = job
        for attempt in range(3):
            out = curl(url, dest)
            if out.startswith("200") and dest.stat().st_size > 50000:
                done["ok"] += 1
                if done["ok"] % 20 == 0:
                    print(f"  已下载 {done['ok']}/{len(jobs)}", flush=True)
                return
            time.sleep(3 + attempt * 5)
        done["fail"].append(str(dest))

    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        list(ex.map(work, jobs))

    (OUT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n完成 {done['ok']}/{len(jobs)} 叶，失败 {len(done['fail'])}")
    for f in done["fail"][:10]:
        print("  失败:", f)
    return 1 if done["fail"] else 0


if __name__ == "__main__":
    sys.exit(main())
