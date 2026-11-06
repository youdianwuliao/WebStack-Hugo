/* 站内搜索共用内核：2D 首页与 3D 天书都从这里取匹配口径与键盘手感。
 * 挂 window.SiteSearchCore（普通 script），两页都用 <script src> 引入。
 * 注意：/assets/* 有长缓存，改本文件须同时递增两个 ?v= 与 sw.js 的 CACHE 版本。
 */
(function (root) {
  'use strict';

  function getPY() { return root.PINYIN_MAP || {}; }
  function toPinyin(text) {
    const PY = getPY();
    return String(text || '').split('').map(function (ch) { return PY[ch] || ch; }).join('').toLowerCase();
  }
  function toInitials(text) {
    const PY = getPY();
    return String(text || '').split('').map(function (ch) { return PY[ch] ? PY[ch][0] : ch; }).join('').toLowerCase();
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function highlight(text, q) {
    const s = escapeHtml(text);
    if (!q) return s;
    const i = s.toLowerCase().indexOf(String(q).toLowerCase());
    if (i < 0) return s;
    return s.slice(0, i) + '<mark>' + s.slice(i, i + q.length) + '</mark>' + s.slice(i + q.length);
  }

  // 给索引记录补齐可匹配字段；t/d/u 为小写原文，py/pi 全拼与首字母
  function decorate(e) {
    e.py = toPinyin(e.t);   e.pi = toInitials(e.t);
    e.dpy = toPinyin(e.d);  e.dpi = toInitials(e.d);
    return e;
  }
  // 相关度评分：精确 > 前缀 > 包含 > 描述 > URL；全拼与首字母同等参与
  function score(e, kw, qpy, qpi) {
    let s = 0;
    if (e.t === kw) s = 100;
    else if (e.t.startsWith(kw)) s = 85;
    else if (e.t.includes(kw)) s = 65;
    else if (e.d.includes(kw)) s = 35;
    else if (e.u.includes(kw)) s = 18;
    if (qpy && qpy.length >= 2) {
      if (e.py === qpy) s = Math.max(s, 90);
      else if (e.py.startsWith(qpy)) s = Math.max(s, 80);
      else if (e.py.includes(qpy)) s = Math.max(s, 60);
      if (e.dpy.includes(qpy)) s = Math.max(s, 30);
    }
    if (qpi && qpi.length >= 2) {
      if (e.pi === qpi) s = Math.max(s, 88);
      else if (e.pi.startsWith(qpi)) s = Math.max(s, 78);
      else if (e.pi.includes(qpi)) s = Math.max(s, 58);
      else if (e.dpi.includes(qpi)) s = Math.max(s, 28);
    }
    return s;
  }
  function search(index, q) {
    const kw = String(q || '').trim().toLowerCase();
    if (!kw) return index.slice();
    const qpy = toPinyin(kw), qpi = toInitials(kw);
    return index.map(function (e) {
      const s = score(e, kw, qpy, qpi);
      return s ? { e: e, s: s } : null;
    }).filter(Boolean).sort(function (a, b) { return b.s - a.s; })
      .map(function (x) { return x.e; });
  }

  /* 结果列表的通用键盘手感：↑↓ 选择、Enter 打开、Esc 收起。
   * o = { results, itemSel, isOpen, onActivate, onEscape, onEmptyEnter, enterDefaultFirst }
   * onEscape(e) 自己决定是否 stopPropagation；其余分支都会拦住，免得触发页面快捷键。
   */
  function bindKeys(input, o) {
    let active = -1;
    function items() { return Array.prototype.slice.call(o.results.querySelectorAll(o.itemSel)); }
    function paint() {
      const list = items();
      for (let i = 0; i < list.length; i++) list[i].classList.toggle('active', i === active);
      const cur = list[active];
      if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
    }
    function reset() { active = -1; paint(); }
    input.addEventListener('input', reset);
    input.addEventListener('keydown', function (e) {
      const list = items(), open = o.isOpen();
      if (e.key === 'ArrowDown' && open && list.length) {
        e.preventDefault(); e.stopPropagation();
        active = Math.min(active + 1, list.length - 1); paint();
      } else if (e.key === 'ArrowUp' && open && list.length) {
        e.preventDefault(); e.stopPropagation();
        active = Math.max(active - 1, -1); paint();
      } else if (e.key === 'Enter') {
        if (open && list.length && (active >= 0 || o.enterDefaultFirst)) {
          e.preventDefault(); e.stopPropagation();
          const el = list[active >= 0 ? active : 0];
          if (el) o.onActivate(el);
        } else if (o.onEmptyEnter) {
          o.onEmptyEnter(e);
        }
      } else if (e.key === 'Escape') {
        if (o.onEscape) o.onEscape(e);
      }
    });
    return { reset: reset, paint: paint };
  }

  root.SiteSearchCore = {
    toPinyin: toPinyin, toInitials: toInitials, escapeHtml: escapeHtml,
    highlight: highlight, decorate: decorate, score: score,
    search: search, bindKeys: bindKeys
  };
})(window);
