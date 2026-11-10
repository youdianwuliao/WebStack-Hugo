/* 抽一签 —— 3D 天书里的漫游彩蛋（默认不出现，按 G 才抽）。
 * 普通 script，挂 window.SiteQuest；不依赖 THREE，只管抽签与一行提示。
 * 不做对错、不需扫视：随机抽一个分类，由 library.js 带相机飞过去逛，
 * 提示六秒后自行隐去，不留下任何开关状态，也不改导航行为。
 * 注意：/assets/* 有长缓存，改本文件须递增 library.html 的 ?v= 与 sw.js 的 CACHE 版本。
 */
(function (root) {
  'use strict';

  var el = null;
  var names = [];           // 固定分类名，索引与 clusterInfo 一致
  var lastCi = -1;
  var fadeTimer = 0;

  function render(text, lit) {
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('lit', !!lit);
    el.classList.toggle('show', !!text);
  }

  function setClusters(list) {
    names = list || [];
  }

  function draw() {
    if (!names.length) return -1;
    clearTimeout(fadeTimer);
    var ci, guard = 0;
    do {
      ci = (Math.random() * names.length) | 0;
      guard++;
    } while (names.length > 1 && ci === lastCi && guard < 12);
    lastCi = ci;
    render('今日宜逛 · ' + names[ci], true);
    fadeTimer = setTimeout(function () { render('', false); }, 6000);
    return ci;
  }

  root.SiteQuest = {
    setClusters: setClusters,
    draw: draw
  };

  el = document.getElementById('quest');
})(window);
