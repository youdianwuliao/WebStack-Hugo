#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""第二遍精读：对含「者也」的图片带坐标重读，切出知乎「问题 + 回答」结构。

依赖同 scan_xiuxian_exports.py（rapidocr-onnxruntime）。
输入：ocr/hits.json、all/*.png
输出：ocr/paras.jsonl（file -> items[{q, paras}]），供 scripts/build_buzaisanjiezhong.py 使用。
"""
import json
import os
import re
from multiprocessing import Pool

import numpy as np

SRC = '/home/zhaosl/tmp_xiuxian/all'
OUT = '/home/zhaosl/tmp_xiuxian/ocr'
SLICE = 2400
OVERLAP = 160

# 平台界面 / 页眉页脚 / 公众号自撰文案，逐行剔除
DROP_PATTERNS = [
    r'^者也$', r'^已关注$', r'^关注$', r'^取消关注$',
    r'^借天星，证我山盟未改.*$',
    r'^发条带图评论$',
    r'^发布于', r'^编辑于', r'^发布了',
    r'^.*·(回答|发布了回答|回答了问题).*$',
    r'^\d{1,2}:\d{2}(:\d{2})?$',
    r'^\d{4}[-/]\d{1,2}[-/]\d{1,2}(\s+\d{1,2}\s*:\s*\d{2}(\s*:\s*\d{2})?)?(\s*·.*)?$',
    r'^.*·(北京|河北|山东|上海|广东|浙江|江苏|四川|湖北|湖南|福建|陕西|河南|安徽|辽宁|天津|重庆|山西|云南|贵州|广西|江西|黑龙江|吉林|甘肃|新疆|内蒙古|宁夏|青海|西藏|海南|香港|澳门|台湾)(·.*)?$',
    r'^公众号·.*$', r'^公众号$', r'^画影轩$', r'^有点特无聊$', r'^分享图片$', r'^视频$',
    r'^展开$', r'^收起$', r'^写评论$', r'^邀请回答\s*写回答$', r'^邀请回答$', r'^写回答$',
    r'^(点赞|收藏|在看|赞|分享|留言|已阅|取消|确认|广告|立即下载|了解更多|评论|转发|关注)\s*$',
    r'^\d+\s*人赞同(了该回答|了该文章)?$',
    r'^声明[:：].*$', r'^.*侵权[，,].*联系必删.*$', r'^.*必删.*$', r'^.*来源网络.*$',
    r'^点下.*$', r'^.*给小编加鸡腿.*$', r'^#.*#$',
    r'^\d{0,3}\s*(邀请回答|写回答|邀请回答\s*写回答)$',
    r'^[0-9A-Za-z]{0,4}(邀请回答|写回答|邀请回答\s*写回答)$',
    r'^\d*人(听过|赞同)(了该回答)?>?$',
    r'^\d+(小时|分钟|天|月|年)前(·.*)?$',
    r'^.*禁止转载$',
    r'^发布[于干].*$',
    r'^知乎[:：].*$',
    r'^全部评论.*$',
    r'^评论\d*(最新|默认|点赞)?(默认|最新)?$',
    r'^默认最新评论\d*$',
    r'^.*广告$',
    r'^欢迎参与讨论.*$',
    r'^.*全新版本上线.*$',
    r'^.*等你来开拓.*$',
    r'^.*VR实景看房.*$',
    r'^.*房源.*$',
    r'^[\d\s,.·:|%]+$',
    r'^.$',
]
DROP_RE = [re.compile(p) for p in DROP_PATTERNS]
NOISE_RE = re.compile(r'^[VvYy1lI\[\]\(\)\-_—~·.。,，、;；:：/\|*\s]+$')
QUESTION_MARK = re.compile(r'^知乎[·,]?\s*[\d,，]+\s*个回答.*关注')
FOOTER_RE = re.compile(r'^(发布于|编辑于|发布了)|·IP属地|禁止转载')
NAME_MARK = re.compile(r'^者也$')
# 表情占位符：[/礼物]、【捂脸】、[爱] 等
EMOJI_RE = re.compile(r'\[/?[^\]]{1,8}\]|【[^】]{1,8}】')


def is_drop(text):
    t = text.strip()
    if not t:
        return True
    if NOISE_RE.match(t):
        return True
    return any(r.match(t) for r in DROP_RE)


def norm(s):
    """去掉 OCR 里夹杂的空格，便于重复判断。"""
    return re.sub(r'\s+', '', s)


def merge_lines(boxes):
    """boxes: [(y0, y1, x0, text)] -> items: [{'q':..., 'paras':[[line,...]]}]"""
    boxes.sort(key=lambda b: (b[0], b[2]))
    lines = [(y0, y1, x0, x1, t.strip()) for y0, y1, x0, x1, t in boxes if t.strip()]
    # 公众号自撰文案在知乎截图之前：从首个知乎问答题块（含其标题）起保留
    first_q = next((i for i, l in enumerate(lines) if QUESTION_MARK.match(l[4])), None)
    first_name = next((i for i, l in enumerate(lines) if NAME_MARK.match(l[4])), None)
    if first_q is not None:
        lines = lines[max(0, first_q - 2):]
    elif first_name is not None:
        lines = lines[first_name:]

    # 问题标题块：形如「标题 / 标题(重复) / 知乎·N个回答·M关注 / 者也」
    markers = [i for i, l in enumerate(lines) if QUESTION_MARK.match(l[4])]
    items = []
    for k, m in enumerate(markers):
        # 标题：向前取 1-2 行非页脚、非界面文字
        title_lines = []
        j = m - 1
        while j >= 0 and len(title_lines) < 2:
            t = lines[j][4]
            if is_drop(t) or FOOTER_RE.match(t) or NAME_MARK.match(t) or QUESTION_MARK.match(t):
                break
            if len(norm(t)) < 3:
                break
            title_lines.insert(0, t)
            j -= 1
        title = dedupe_adjacent([norm(t) for t in title_lines])
        q = clean_title(' '.join(title))
        if q and not q.endswith(('？', '?')) and len(q) > 22:
            q = ''

        # 正文：marker 之后到下一块标题之前 / 页脚
        if k + 1 < len(markers):
            nxt = markers[k + 1]
            ntitle = 0
            jj = nxt - 1
            while jj >= 0 and ntitle < 2:
                t = lines[jj][4]
                if is_drop(t) or FOOTER_RE.match(t) or NAME_MARK.match(t) or QUESTION_MARK.match(t):
                    break
                if len(norm(t)) < 3:
                    break
                ntitle += 1
                jj -= 1
            end = max(m + 1, nxt - ntitle)
        else:
            end = len(lines)
        body = []
        for i in range(m + 1, end):
            t = lines[i][4]
            if FOOTER_RE.match(t):
                break
            if is_drop(t) or QUESTION_MARK.match(t):
                continue
            body.append((lines[i][0], lines[i][1], lines[i][2], lines[i][3], t))
        if title or body:
            items.append({'q': q, 'paras': split_paras(body)})

    if not items:
        body = [(l[0], l[1], l[2], l[3], l[4]) for l in lines if not is_drop(l[4])]
        if body:
            items.append({'q': '', 'paras': split_paras(body)})
    # 同一问题被截图多次时合并
    merged = []
    for it in items:
        for m in merged:
            if it['q'] and m['q'] == it['q']:
                m['paras'].extend(it['paras'])
                break
        else:
            merged.append(it)
    return merged


TITLE_JUNK = re.compile(r'^(?:[0-9A-Za-z]{1,4}\s*)?(?:邀请回答|写回答|邀请回答\s*写回答)\s*|^[A-Z]{3,4}\s+')


def clean_title(t):
    prev = None
    while prev != t:
        prev = t
        t = TITLE_JUNK.sub('', t).strip()
    t = re.sub(r'\s+', '', t)
    return t.strip('」』”"“《》 ，。、')


def dedupe_adjacent(seq):
    out = []
    for s in seq:
        if out and out[-1] == s:
            continue
        out.append(s)
    return out


def split_paras(body, min_para_chars=0):
    """按行距切块；块内长句合并，短句块保持逐行（诗词）。"""
    if not body:
        return []
    heights = [b[1] - b[0] for b in body]
    med_h = float(np.median(heights))
    gaps = [body[i + 1][0] - body[i][1] for i in range(len(body) - 1)]
    med_gap = float(np.median(gaps)) if gaps else med_h * 0.3
    para_gap = max(med_gap * 1.8, med_h * 0.6)

    widths = [b[3] - b[2] for b in body]
    col_w = max(widths)

    blocks = []
    cur = []
    prev_y1 = None
    for y0, y1, x0, x1, t in body:
        if prev_y1 is not None and y0 - prev_y1 > para_gap:
            if cur:
                blocks.append(cur)
            cur = []
        cur.append((y0, y1, x0, x1, t))
        prev_y1 = y1
    if cur:
        blocks.append(cur)

    out = []
    for b in blocks:
        texts = [x[4] for x in b]
        avg = sum(len(x) for x in texts) / len(texts)
        ends = sum(1 for x in texts if x[-1] in '。！？…，、；;')
        bw = float(np.median([x[3] - x[2] for x in b]))
        verse = avg <= 16 and ends >= len(texts) * 0.6 and bw < col_w * 0.62
        if verse:
            out.append(dedupe_adjacent(texts))
            continue
        text = ''.join(texts)
        text = re.sub(r'^谢邀@\S*', '', text)
        text = EMOJI_RE.sub('', text)
        buf = ''
        for ch in text:
            buf += ch
            if ch in '。！？…' and len(buf) >= 140:
                out.append([buf])
                buf = ''
        if buf:
            if out and len(buf) < 60:
                out[-1][-1] += buf
            else:
                out.append([buf])
    # 通篇长句（少见句号）时按逗号二次切分，保证阅读节奏
    final = []
    for p in out:
        if len(p) > 1:            # 诗词段落保持逐行
            final.append(p)
            continue
        t = ''.join(p)
        while len(t) > 260:
            cut = -1
            for sep in ('。', '，', '；', '、'):
                idx = t.rfind(sep, 60, 220)
                if idx > cut:
                    cut = idx
            if cut <= 0:
                break
            final.append([t[:cut + 1]])
            t = t[cut + 1:]
        if t:
            final.append([t])
    return final


def ocr_one(path):
    from PIL import Image
    from rapidocr_onnxruntime import RapidOCR

    Image.MAX_IMAGE_PIXELS = None
    engine = RapidOCR(intra_op_num_threads=1, **{'Rec.rec_batch_num': 32})
    arr = np.array(Image.open(path).convert('RGB'))
    h = arr.shape[0]
    boxes = []
    y = 0
    while y < h:
        y2 = min(y + SLICE, h)
        res, _ = engine(arr[y:y2][:, :, ::-1])
        if res:
            for box, text, _s in res:
                ys = [p[1] for p in box]
                xs = [p[0] for p in box]
                y0 = y + min(ys)
                if y > 0 and y0 < y + OVERLAP:   # 重叠带交给前一片
                    continue
                boxes.append((y0, y + max(ys), min(xs), max(xs), text))
        if y2 >= h:
            break
        y = y2 - OVERLAP
    return os.path.basename(path), merge_lines(boxes)


def main():
    names = json.load(open(os.path.join(OUT, 'hits.json'), encoding='utf-8'))
    files = [os.path.join(SRC, n) for n in names]
    outpath = os.path.join(OUT, 'paras.jsonl')
    if os.path.exists(outpath):
        os.remove(outpath)
    print(f'todo={len(files)}', flush=True)
    with open(outpath, 'a', encoding='utf-8') as fout, Pool(4) as pool:
        for i, (name, items) in enumerate(pool.imap_unordered(ocr_one, files), 1):
            fout.write(json.dumps({'file': name, 'items': items}, ensure_ascii=False) + '\n')
            fout.flush()
            print(f'[{i}/{len(files)}] {name} {len(items)}则', flush=True)


if __name__ == '__main__':
    main()
