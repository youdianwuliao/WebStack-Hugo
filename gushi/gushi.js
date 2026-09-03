(function () {
  'use strict';
  var SIZE_KEY = 'gushiFontSize';
  var FACE_KEY = 'gushiFontFace';
  var SIZE_STEPS = ['small', 'normal', 'large', 'xlarge'];
  var SIZE_PX = { small: 15, normal: 16.5, large: 18.5, xlarge: 20.5 };
  var FACE_LABEL = { song: '宋', kai: '楷', hei: '黑' };
  var FACE_FAMILY = {
    song: '"Songti SC", "SimSun", "Noto Serif SC", serif',
    kai: '"Kaiti SC", "KaiTi", "STKaiti", serif',
    hei: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif'
  };

  function getPref(key, def) {
    try { var v = localStorage.getItem(key); return v || def; } catch (e) { return def; }
  }
  function setPref(key, val) {
    try { localStorage.setItem(key, val); } catch (e) {}
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function applyPrefs(sizeKey, faceKey) {
    var px = SIZE_PX[sizeKey] || SIZE_PX.normal;
    var fam = FACE_FAMILY[faceKey] || FACE_FAMILY.hei;
    document.body.style.setProperty('--read-font-size', px + 'px');
    document.body.style.setProperty('--read-font-family', fam);
  }

  // ===== 夜间主题（与首页共享 nightMode 偏好）=====
  var THEME_KEY = 'nightMode';
  function setThemeAttr(theme) {
    if (theme) document.documentElement.setAttribute('data-theme', theme);
    else document.documentElement.removeAttribute('data-theme');
  }
  function systemDark() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function currentDark() {
    var attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'dark') return true;
    if (attr === 'light') return false;
    return systemDark();
  }
  function applyTheme() {
    var v = getPref(THEME_KEY, '');
    if (v === 'true') setThemeAttr('dark');
    else if (v === 'false') setThemeAttr('light');
    else setThemeAttr('');
  }
  applyTheme();

  // 阅读进度条
  var bar = document.createElement('div');
  bar.className = 'reading-progress';
  document.body.appendChild(bar);
  function updateProgress() {
    var doc = document.documentElement;
    var total = doc.scrollHeight - window.innerHeight;
    var pct = total > 0 ? (window.scrollY / total * 100) : 0;
    bar.style.width = pct + '%';
  }
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress, { passive: true });
  updateProgress();

  // 阅读工具条
  var topBar = document.querySelector('.top-bar');
  if (topBar) {
    var curSize = getPref(SIZE_KEY, 'normal');
    var curFace = getPref(FACE_KEY, 'hei');
    applyPrefs(curSize, curFace);

    var tb = document.createElement('div');
    tb.className = 'reading-toolbar';
    var sizeIdx = SIZE_STEPS.indexOf(curSize);
    if (sizeIdx < 0) sizeIdx = 1;
    tb.innerHTML =
      '<span class="tool-label">字号</span>' +
      '<button type="button" class="tool-btn" id="fontDec" title="缩小字号">A−</button>' +
      '<button type="button" class="tool-btn" id="fontInc" title="放大字号">A+</button>' +
      '<span class="tool-divider"></span>' +
      '<span class="tool-label">字体</span>' +
      '<button type="button" class="tool-btn face-btn" data-face="song">宋</button>' +
      '<button type="button" class="tool-btn face-btn" data-face="kai">楷</button>' +
      '<button type="button" class="tool-btn face-btn" data-face="hei">黑</button>' +
      '<span class="tool-divider"></span>' +
      '<button type="button" class="tool-btn night-btn" id="nightToggle" title="切换夜间模式">' + (currentDark() ? '☀️' : '🌙') + '</button>';
    topBar.appendChild(tb);

    function setActive() {
      var btns = tb.querySelectorAll('.face-btn');
      for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle('active', btns[i].getAttribute('data-face') === curFace);
      }
    }
    setActive();

    function changeSize(delta) {
      sizeIdx = Math.min(SIZE_STEPS.length - 1, Math.max(0, sizeIdx + delta));
      curSize = SIZE_STEPS[sizeIdx];
      setPref(SIZE_KEY, curSize);
      applyPrefs(curSize, curFace);
    }
    tb.querySelector('#fontDec').addEventListener('click', function () { changeSize(-1); });
    tb.querySelector('#fontInc').addEventListener('click', function () { changeSize(1); });
    tb.querySelectorAll('.face-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        curFace = btn.getAttribute('data-face');
        setPref(FACE_KEY, curFace);
        applyPrefs(curSize, curFace);
        setActive();
      });
    });

    var nightBtn = tb.querySelector('#nightToggle');
    if (nightBtn) {
      nightBtn.classList.toggle('active', currentDark());
      nightBtn.addEventListener('click', function () {
        var dark = !currentDark();
        setPref(THEME_KEY, dark ? 'true' : 'false');
        setThemeAttr(dark ? 'dark' : 'light');
        nightBtn.textContent = dark ? '☀️' : '🌙';
        nightBtn.classList.toggle('active', dark);
      });
    }
  }

  // 返回顶部按钮
  var topBtn = document.getElementById('topBtn');
  if (topBtn) {
    window.addEventListener('scroll', function () {
      topBtn.classList.toggle('show', window.scrollY > 400);
    }, { passive: true });
  }

  // 阅读足迹（供目录页统计已读进度）
  (function () {
    var seg = location.pathname.split('/');
    var book = seg.length > 2 ? seg[seg.length - 2] : '';
    if (!book || !/^[a-z0-9]+$/i.test(book)) return;
    var key = 'bookVisited_' + book;
    var page = location.pathname.split('/').pop() || '';
    try {
      var list = JSON.parse(localStorage.getItem(key)) || [];
      if (page && list.indexOf(page) === -1) {
        list.push(page);
        localStorage.setItem(key, JSON.stringify(list));
      }
    } catch (e) {}
  })();

  // Service Worker 注册
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('../sw.js').catch(function () {});
    });
  }
})();
