#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""阅读模块「简/繁」切换共享组件。

约定：页面默认输出**简体**，可一键切回繁体。
实现方式：可见文本写简体，同时在元素上用 data-t2t 存繁体原文，
由内置脚本就地替换——离线可用、无外部依赖，选择记录在 localStorage。

用法（各 build_*.py 共用）：
    from zh_toggle import TOGGLE_CSS, TOGGLE_JS, TOGGLE_BTN, s, zh_attrs
- s(繁体串)      -> 简体串，用于标题/描述等默认简体的输出
- zh_attrs(繁体串) -> ' data-t2t="繁体"'，挂在需要切换的元素上
"""

from html import escape
from opencc import OpenCC

_CC = OpenCC("t2s")
ZH_PREF_KEY = "jisi-zh-pref"


def s(text):
    """繁→简：页面默认以简体呈现。"""
    return _CC.convert(text) if text else text


def zh_attrs(trad):
    """可见文本为简体，data-t2t 保存繁体，供切换脚本还原。"""
    return ' data-t2t="{}"'.format(escape(trad, quote=True))


TOGGLE_BTN = (
    '<button class="zh-toggle" id="zhToggle" type="button" '
    'title="简体/繁体切换" aria-label="切换为繁体">简</button>'
)

# 用 currentColor/inherit，自动适配各模块配色与深浅色
TOGGLE_CSS = """
        .zh-toggle {
            display: inline-flex; align-items: center; justify-content: center;
            min-width: 30px; height: 26px; padding: 0 8px; margin-left: 10px;
            font-size: 13px; line-height: 1; cursor: pointer;
            background: transparent; color: inherit;
            border: 1px solid currentColor; border-radius: 6px;
            opacity: 0.65; transition: opacity 0.18s ease;
            vertical-align: middle;
        }
        .zh-toggle:hover { opacity: 1; }
"""

TOGGLE_JS = """
<script>
(function () {
  var KEY = '%(key)s';
  var btn = document.getElementById('zhToggle');
  function apply(trad) {
    var els = document.querySelectorAll('[data-t2t]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.getAttribute('data-zh-simp') === null) el.setAttribute('data-zh-simp', el.textContent);
      el.textContent = trad ? el.getAttribute('data-t2t') : el.getAttribute('data-zh-simp');
    }
    document.documentElement.classList.toggle('zh-trad', trad);
    if (btn) {
      btn.textContent = trad ? '繁' : '简';
      btn.setAttribute('aria-label', trad ? '切换为简体' : '切换为繁体');
    }
    try { localStorage.setItem(KEY, trad ? 't' : 's'); } catch (e) {}
  }
  var pref = null;
  try { pref = localStorage.getItem(KEY); } catch (e) {}
  apply(pref === 't');
  if (btn) btn.addEventListener('click', function () {
    apply(!document.documentElement.classList.contains('zh-trad'));
  });
})();
</script>
""" % {"key": ZH_PREF_KEY}
