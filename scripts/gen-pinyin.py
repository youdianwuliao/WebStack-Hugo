#!/usr/bin/env python3
# 从 nav.json 生成 assets/js/pinyin-map.js（需 pypinyin: pip install pypinyin）
import json, re
from pypinyin import pinyin, Style

def collect():
    nav=json.load(open('nav.json',encoding='utf-8'))['navigation']
    texts=[]
    def walk(cats):
        for c in cats:
            texts.append(c.get('category',''))
            texts.append(c.get('name',''))
            for it in c.get('items',[]):
                texts.append(it.get('title',''))
                texts.append(it.get('description',''))
            walk(c.get('subcategories',[]))
    walk(nav)
    return set(re.findall(r'[一-鿿]',''.join(texts)))

hanzi=sorted(collect())
full={h:''.join(p for p in pinyin(h,style=Style.NORMAL)[0]) for h in hanzi}
lines=['// 汉字->全拼映射，由 pypinyin 从 nav.json 生成（构建期生成，运行时零依赖）',
'// 若 nav.json 新增汉字，重新运行: python3 scripts/gen-pinyin.py',
'window.PINYIN_MAP = {']
items=[json.dumps(h,ensure_ascii=False)+':'+json.dumps(py) for h,py in full.items()]
for i in range(0,len(items),20):
    lines.append('  '+','.join(items[i:i+20])+',')
lines.append('};')
open('assets/js/pinyin-map.js','w',encoding='utf-8').write('
'.join(lines)+'
')
print('generated assets/js/pinyin-map.js, %d chars'%len(full))
