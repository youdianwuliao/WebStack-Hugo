import * as THREE from '../three/three.module.min.js';

/* ============================================================
 * 集思阁 · 天书 —— 星图式三维导航
 * 数据与 2D 站共用同一份 nav.json（含子分类），并共用 navRecents / navFavs。
 *   · 阻尼相机：所有位移与转向都平滑过渡，不再瞬移
 *   · 分类直达栏 + 当前位置：永远知道自己在哪、随时归位
 *   · 浑天仪坐标环、流星、星闪、星云：更耐看的星海
 *   · 悬停：书卷放大、光晕浮起、名牌展开全名与简介（默认仅一字）
 *   · 最近访问 / 我的收藏：与 2D 站双向同步的独立星团
 *   · 高清贴图：高倍超采样 + 线性过滤，文字不再发虚
 * ============================================================ */

const NAV_URL = 'nav.json';
const RECENT_KEY = 'navRecents';   // 与 2D 站共用（URL 数组）
const FAV_KEY = 'navFavs';         // 与 2D 站共用（URL 数组）
const OLD_RECENT_KEY = 'tianshuRecents';
const CLUSTER_SLOTS = 12;
const RECENTS_CENTER = new THREE.Vector3(265, 55, -80);
const FAVS_CENTER = new THREE.Vector3(-265, 55, -80);

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const canvas      = $('scene');
const reticle     = $('reticle');
const hintEl      = $('hint');
const introOv     = $('overlay-intro');
const pauseOv     = $('overlay-pause');
const enterBtn    = $('enter');
const resumeBtn   = $('resume');
const muteBtn     = $('mute');
const loadingEl   = $('loading');
const catrailEl   = $('catrail');
const whereEl     = $('where');
const helpStatEl  = $('helpStat');
const anchorsEl   = $('anchors');
const quickInput  = $('quickSearch');
const quickResEl  = $('quickResults');
const overviewEl  = $('overview');
const introTotal  = $('introTotal');

canvas.style.touchAction = 'none';

// 站内搜索内核与 2D 首页共用同一份（拼音 / 首字母 / 相关度 / 键盘手感）
const Core = window.SiteSearchCore;
function isTyping() {
  const a = document.activeElement;
  return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA');
}

// 与 2D 站一致：尽早发起 nav.json 请求，复用 HTTP / SW 缓存（不禁用缓存）
const NAV_PROMISE = fetch(NAV_URL).then((r) => r.json());

// ---------- 渲染器 / 场景 / 相机 ----------
// 低配设备降低贴图超采样与像素比，省显存；更弱的已在 library.html 直接回落 2D
const LOW_END = (function () {
  try {
    return (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
      (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  } catch (e) { return false; }
})();
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const DPR_HIGH = Math.min(window.devicePixelRatio || 1, LOW_END ? 1.5 : 2);
renderer.setPixelRatio(DPR_HIGH);
renderer.setSize(window.innerWidth, window.innerHeight);
let perfFrames = 0, perfReal = 0, perfChecked = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04050b);
scene.fog = new THREE.FogExp2(0x04050b, 0.0010);

// 时辰主题：按本地时间改星海底色与曝光，晨昏更暖、正午更清、深夜更沉
function applyTimeTheme() {
  const h = new Date().getHours();
  let bg, expo;
  if (h >= 5 && h < 9) { bg = 0x0d1126; expo = 1.34; }
  else if (h >= 9 && h < 17) { bg = 0x050a18; expo = 1.18; }
  else if (h >= 17 && h < 20) { bg = 0x170d1e; expo = 1.38; }
  else { bg = 0x04050b; expo = 1.25; }
  scene.background.setHex(bg);
  scene.fog.color.setHex(bg);
  renderer.toneMappingExposure = expo;
}
applyTimeTheme();

const camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.1, 1800);
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
// 当首页：默认视角收近，书卷从 ~11px 变成 ~19px；入场再从这个更远处缓缓推近
const HOME_POS = new THREE.Vector3(0, 24, 110);
const PUSH_START = new THREE.Vector3(0, 38, 215);
camera.position.copy(HOME_POS);

// ---------- 通用贴图工具 ----------
const CN = '"PingFang SC","Microsoft YaHei","Kaiti SC",serif';
function clipText(s, n) {
  s = (s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n) + '…' : s;
}
// 文字贴图统一高倍超采样绘制，再以线性过滤采样（禁用 mipmap），
// 避免 3D 中文字因贴图分辨率不足 / mipmap 缩糊而发虚。
const ICON_SS = LOW_END ? 1 : 1.5, TEXT_SS = LOW_END ? 1.5 : 2, CARD_SS = LOW_END ? 2 : 3;
function finishTex(c, aspect) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  if (aspect) t.aspect = aspect;
  return t;
}
function radialTexture(stops, size) {
  size = (size || 256) * TEXT_SS;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach((s) => grd.addColorStop(s[0], s[1]));
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  return finishTex(c);
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ---------- 渐变天穹 ----------
function makeSky() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0.0, '#0c0a22');
  grd.addColorStop(0.42, '#090816');
  grd.addColorStop(1.0, '#03030a');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 512);
  const tex = finishTex(c);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, fog: false });
  return new THREE.Mesh(new THREE.SphereGeometry(1300, 32, 16), mat);
}
scene.add(makeSky());

// ---------- 星空 ----------
function makeStars(count, size, opacity) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const r = 380 + Math.random() * 900;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3]     = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph);
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    c.setHSL(0.56 + Math.random() * 0.18, 0.55, 0.55 + Math.random() * 0.42);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, opacity, depthWrite: false });
  m.fog = false;
  return new THREE.Points(g, m);
}
const starsFar  = makeStars(2400, 1.4, 0.9);
const starsNear = makeStars(700, 2.9, 0.5);
scene.add(starsFar, starsNear);

// ---------- 流星（多段渐隐尾焰） ----------
const meteors = [];
const METEOR_SEG = 6;
function createMeteor() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((METEOR_SEG + 1) * 3), 3));
  const col = new Float32Array((METEOR_SEG + 1) * 3);
  for (let k = 0; k <= METEOR_SEG; k++) {
    const f = 1 - k / METEOR_SEG;
    col[k * 3] = 0.85 * f * f; col[k * 3 + 1] = 0.92 * f * f; col[k * 3 + 2] = 1.0 * f * f;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const line = new THREE.Line(g, m);
  line.frustumCulled = false;
  scene.add(line);
  return { line, wait: 0, life: 0, dir: new THREE.Vector3(), head: new THREE.Vector3(), len: 50, speed: 260 };
}
for (let i = 0; i < 3; i++) {
  const m = createMeteor();
  m.wait = 1.5 + i * 2.6 + Math.random() * 3;
  meteors.push(m);
}
function spawnMeteor(m) {
  const r = 420 + Math.random() * 160;
  const th = Math.random() * Math.PI * 2;
  const ph = Math.acos(2 * Math.random() - 1);
  m.head.set(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.7, r * Math.sin(ph) * Math.sin(th));
  m.dir.set(Math.random() - 0.5, -(0.15 + Math.random() * 0.45), Math.random() - 0.5).normalize();
  m.len = 45 + Math.random() * 70;
  m.speed = 220 + Math.random() * 180;
  m.life = 0.9 + Math.random() * 0.7;
}
function updateMeteors(dt) {
  for (const m of meteors) {
    if (m.life > 0) {
      m.life -= dt;
      const p = m.line.geometry.attributes.position.array;
      for (let k = 0; k <= METEOR_SEG; k++) {
        const f = k / METEOR_SEG;
        p[k * 3]     = m.head.x - m.dir.x * m.len * f;
        p[k * 3 + 1] = m.head.y - m.dir.y * m.len * f;
        p[k * 3 + 2] = m.head.z - m.dir.z * m.len * f;
      }
      m.line.geometry.attributes.position.needsUpdate = true;
      m.head.addScaledVector(m.dir, m.speed * dt);
      m.line.material.opacity = 0.9 * Math.min(1, Math.max(0, m.life * 2.6));
      if (m.life <= 0) { m.line.material.opacity = 0; m.wait = 3 + Math.random() * 8; }
    } else {
      m.line.material.opacity = 0;
      m.wait -= dt;
      if (m.wait <= 0) spawnMeteor(m);
    }
  }
}

// ---------- 星云 + 远处光核 ----------
const nebulaGroup = new THREE.Group();
scene.add(nebulaGroup);
function makeGlow(hex, alpha) {
  const tex = radialTexture([
    [0, hex],
    [0.4, hex.replace(/,[0-9.]+\)$/, ',' + (alpha * 0.4) + ')')],
    [1, 'rgba(0,0,0,0)']
  ]);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  return new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
}
const nebDefs = [
  ['rgba(120,90,220,0.55)', 520], ['rgba(40,140,180,0.5)', 640],
  ['rgba(180,80,200,0.45)', 470], ['rgba(70,110,200,0.5)', 760],
  ['rgba(200,120,90,0.32)', 560], ['rgba(90,200,170,0.4)', 680]
];
nebDefs.forEach((d, i) => {
  const n = makeGlow(d[0], 0.5);
  const ang = i * 1.05 + 0.4;
  const R = 600;
  n.position.set(Math.cos(ang) * R, (i - 2.5) * 110, Math.sin(ang) * R - 160);
  n.scale.set(d[1], d[1], 1);
  n.lookAt(0, 0, 0);
  nebulaGroup.add(n);
});
[['rgba(180,200,255,0.5)', 900, -300, 700, 260],
 ['rgba(255,210,160,0.4)', -700, 200, -500, 220]].forEach((c) => {
  const core = makeGlow(c[0], 0.5);
  core.position.set(c[1], c[2], c[3]);
  core.scale.set(c[4], c[4], 1);
  core.lookAt(0, 0, 0);
  nebulaGroup.add(core);
});

// ---------- 浑天仪（星图坐标环）----------
const armillary = new THREE.Group();
scene.add(armillary);
function addRing(radius, color, opacity, rot) {
  const g = new THREE.TorusGeometry(radius, 0.45, 6, 160);
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const mesh = new THREE.Mesh(g, m);
  mesh.rotation.set(rot[0], rot[1], rot[2]);
  armillary.add(mesh);
}
addRing(135, 0x7b86d8, 0.20, [Math.PI / 2, 0, 0]);
addRing(135, 0x9a72c8, 0.13, [0, 0, 0]);
addRing(135, 0x54a6c8, 0.12, [0, Math.PI / 2, 0.4]);
addRing(96,  0x8f7fd0, 0.10, [Math.PI / 2, 0.5, 0]);

// ---------- 标题工具 ----------
function makeTitleTexture(name, w, h, fs) {
  w = w || 560; h = h || 132; fs = fs || 60;
  const c = document.createElement('canvas'); c.width = w * TEXT_SS; c.height = h * TEXT_SS;
  const g = c.getContext('2d');
  g.scale(TEXT_SS, TEXT_SS);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold ' + fs + 'px ' + CN;
  g.shadowColor = 'rgba(255,200,120,0.9)'; g.shadowBlur = 26 * TEXT_SS;
  g.fillStyle = 'rgba(255,214,140,0.96)';
  g.fillText(name, w / 2, h / 2 + 2);
  return finishTex(c, w / h);
}
// 中枢地标：抬到顶部空档，别压在正好落在画面中上方的分类星团上
const hubTex = makeTitleTexture('集思阁 · 天书', 760, 150, 66);
const hub = new THREE.Sprite(new THREE.SpriteMaterial({ map: hubTex, transparent: true, depthWrite: false, fog: false }));
hub.position.set(0, 94, 0);
hub.scale.set(42, 42 / hubTex.aspect, 1);
scene.add(hub);

// ---------- 书卷贴图 ----------
const iconTexCache = new Map();
function makeIconTexture(ch, color) {
  const hex = '#' + color.getHexString();
  const key = ch + '|' + hex;
  const hit = iconTexCache.get(key);
  if (hit) return hit;
  const s = 256;
  const c = document.createElement('canvas'); c.width = c.height = s * ICON_SS;
  const g = c.getContext('2d');
  g.scale(ICON_SS, ICON_SS);
  const r = (color.r * 255) | 0, gg = (color.g * 255) | 0, b = (color.b * 255) | 0;
  const grd = g.createRadialGradient(s / 2, s / 2, 8, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(' + r + ',' + gg + ',' + b + ',0.34)');
  grd.addColorStop(0.6, 'rgba(' + r + ',' + gg + ',' + b + ',0.10)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  g.strokeStyle = hex; g.lineWidth = 10; g.shadowColor = hex; g.shadowBlur = 24 * ICON_SS;
  g.beginPath(); g.arc(s / 2, s / 2, 96, 0, Math.PI * 2); g.stroke();
  g.shadowBlur = 0;
  g.strokeStyle = 'rgba(255,255,255,0.32)'; g.lineWidth = 2;
  g.beginPath(); g.arc(s / 2, s / 2, 80, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#f7f0df'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = 150;
  g.font = 'bold ' + fs + 'px ' + CN;
  while (g.measureText(ch).width > s - 96 && fs > 56) {
    fs -= 8; g.font = 'bold ' + fs + 'px ' + CN;
  }
  g.shadowColor = hex; g.shadowBlur = 14 * ICON_SS;
  g.fillText(ch, s / 2, s / 2 + 6);
  const t = finishTex(c);
  iconTexCache.set(key, t);
  return t;
}
// 悬停名牌：默认只一个字，悬停后全名 + 简介 + 操作提示都展开
function makeCardTexture(title, desc, hex, hint, cat) {
  // 玉简式名牌：细边、左侧一道暖金指示线，文字左对齐、操作提示右对齐
  const fsT = 40, fsD = 23, fsH = 19, padV = 16, gap = 8, padL = 32, padR = 18;
  const ttl = clipText(title || '未命名', 22);
  const dtxt = clipText(desc, 30);
  const m = document.createElement('canvas').getContext('2d');
  m.font = 'bold ' + fsT + 'px ' + CN;
  const tw = Math.min(m.measureText(ttl).width, 700);
  m.font = fsD + 'px ' + CN;
  const dw = dtxt ? Math.min(m.measureText(dtxt).width, 700) : 0;
  m.font = fsH + 'px ' + CN;
  const hintW = m.measureText(hint).width;
  m.font = (fsH - 2) + 'px ' + CN;
  const catW = m.measureText(cat || '').width;
  const hw = Math.min(hintW + catW + 28, 700);
  const w = Math.ceil(Math.max(tw, dw, hw, 190) + padL + padR);
  let y = padV, descY = 0;
  const titleY = y + fsT / 2; y += fsT;
  if (dtxt) { y += gap; descY = y + fsD / 2; y += fsD; }
  y += gap;
  const hintY = y + fsH / 2; y += fsH;
  const h = Math.ceil(y + padV);
  const c = document.createElement('canvas'); c.width = w * CARD_SS; c.height = h * CARD_SS;
  const g = c.getContext('2d');
  g.scale(CARD_SS, CARD_SS);
  g.fillStyle = 'rgba(8,10,22,0.62)';
  roundRect(g, 2, 2, w - 4, h - 4, 8); g.fill();
  g.strokeStyle = hex; g.lineWidth = 1.2; g.shadowColor = hex; g.shadowBlur = 10 * CARD_SS;
  roundRect(g, 2, 2, w - 4, h - 4, 8); g.stroke(); g.shadowBlur = 0;
  // 左侧细指示线
  g.fillStyle = 'rgba(255,214,140,0.9)';
  g.shadowColor = 'rgba(255,200,120,0.85)'; g.shadowBlur = 8 * CARD_SS;
  g.fillRect(13, 12, 3, h - 24);
  g.shadowBlur = 0;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillStyle = '#ffe6b4'; g.font = 'bold ' + fsT + 'px ' + CN;
  g.shadowColor = hex; g.shadowBlur = 10 * CARD_SS;
  g.fillText(ttl, padL, titleY); g.shadowBlur = 0;
  if (dtxt) {
    g.fillStyle = 'rgba(233,220,195,0.8)'; g.font = fsD + 'px ' + CN;
    g.fillText(dtxt, padL, descY);
  }
  // 底行左侧标出分类归属，右侧是操作提示
  g.textAlign = 'left';
  g.fillStyle = 'rgba(233,220,195,0.55)'; g.font = (fsH - 2) + 'px ' + CN;
  g.fillText(cat || '', padL, hintY);
  g.textAlign = 'right';
  g.fillStyle = 'rgba(255,214,140,0.92)'; g.font = fsH + 'px ' + CN;
  g.fillText(hint, w - padR, hintY);
  return finishTex(c, w / h);
}

// ---------- 悬停光晕 / 名牌 ----------
const haloTex = radialTexture([
  [0, 'rgba(255,255,255,0.85)'],
  [0.38, 'rgba(255,255,255,0.28)'],
  [1, 'rgba(255,255,255,0)']
]);
const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true,
  blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0, color: 0xffffff }));
halo.renderOrder = -1;
scene.add(halo);
const cardSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
cardSprite.visible = false; cardSprite.renderOrder = 1000;
scene.add(cardSprite);

// ---------- 展卷光爆 / 悬停细环 / 连线流光 ----------
const burstTex = radialTexture([
  [0, 'rgba(255,255,255,0.95)'], [0.22, 'rgba(255,236,196,0.55)'],
  [0.55, 'rgba(255,210,150,0.16)'], [1, 'rgba(255,255,255,0)']
]);
const bursts = [];
function burstAt(pos, color, scaleTo, life) {
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: burstTex, color,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.95 }));
  spr.position.copy(pos);
  spr.scale.set(1, 1, 1);
  spr.renderOrder = 900;
  scene.add(spr);
  bursts.push({ spr, age: 0, life: life || 0.7, scaleTo: scaleTo || 18 });
}
function makeRingTex() {
  const s = 256;
  const c = document.createElement('canvas'); c.width = c.height = s * TEXT_SS;
  const g = c.getContext('2d');
  g.scale(TEXT_SS, TEXT_SS);
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2.5;
  g.shadowColor = 'rgba(255,220,160,0.9)'; g.shadowBlur = 10 * TEXT_SS;
  g.beginPath(); g.arc(s / 2, s / 2, 104, 0, Math.PI * 2); g.stroke();
  g.shadowBlur = 0;
  // 四道刻度，像浑天仪刻度环
  g.lineWidth = 3;
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2;
    g.beginPath();
    g.moveTo(s / 2 + Math.cos(a) * 96, s / 2 + Math.sin(a) * 96);
    g.lineTo(s / 2 + Math.cos(a) * 116, s / 2 + Math.sin(a) * 116);
    g.stroke();
  }
  return finishTex(c);
}
const hoverRing = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeRingTex(), transparent: true,
  blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0, color: 0xffffff }));
hoverRing.renderOrder = 3;
hoverRing.visible = false;
scene.add(hoverRing);

// ---------- 玻璃球壳 / 动态星座网 / 整团拖动 ----------
const shellGeo = new THREE.SphereGeometry(1, 32, 20);
const shellVert = 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }';
const shellFrag = 'uniform vec3 uColor; uniform float uGlow; uniform float uFade; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0); float a = f * (0.20 + uGlow * 0.55) * uFade; gl_FragColor = vec4(uColor * (0.85 + uGlow * 0.8), a); }';
const pickMeshes = [];
const _pickRay = new THREE.Raycaster();
function makeShell(ci, color, radius) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color.clone() }, uGlow: { value: 0 }, uFade: { value: 1 } },
    vertexShader: shellVert, fragmentShader: shellFrag,
    side: THREE.BackSide, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false
  });
  const shell = new THREE.Mesh(shellGeo, mat);
  shell.scale.set(radius, radius * 0.72, radius * 0.6);
  shell.renderOrder = -2;
  scene.add(shell);
  // 不可见的拾取代理：略小于球壳，留出球间空隙供「拖空地环顾」
  const pick = new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({ visible: false }));
  pick.scale.set(radius * 0.82, radius * 0.72 * 0.82, radius * 0.6 * 0.82);
  pick.userData.ci = ci;
  scene.add(pick);
  pickMeshes.push(pick);
  return { shell, pick };
}

// 动态星座网：每帧按书卷当前位置重连，自转 / 漂浮 / 拖动都跟得住
const MAX_NET_EDGES = 2600;
const MAX_EDGE2 = 80 * 80;      // 一串被拉变形的边照常连着，只有拉得过长的才断，免得横跨天空
const netPos = new Float32Array(MAX_NET_EDGES * 6);
const netGeo = new THREE.BufferGeometry();
netGeo.setAttribute('position', new THREE.BufferAttribute(netPos, 3).setUsage(THREE.DynamicDrawUsage));
netGeo.setDrawRange(0, 0);
const netMesh = new THREE.LineSegments(netGeo, new THREE.LineBasicMaterial({
  color: 0x8ea6d8, transparent: true, opacity: 0.26,
  depthWrite: false, fog: false, blending: THREE.AdditiveBlending
}));
netMesh.frustumCulled = false;
netMesh.renderOrder = -1;
scene.add(netMesh);

let clusterMembers = [];       // ci -> [书卷索引]
let flowNext = null;            // 每本书在网里的下一跳，供流光沿边流动
function updateNet() {
  if (!flowNext) return;
  let v = 0;
  flowNext.fill(-1);
  for (let ci = 0; ci < clusterMembers.length; ci++) {
    const vis = [];
    for (const idx of clusterMembers[ci]) {
      if (bookSprites[idx] && bookSprites[idx].visible && bookData[idx] && bookData[idx].url) vis.push(idx);
    }
    const k = vis.length;
    if (k < 2) continue;
    // 按 j+1 连会得到 137° 跨度的长线、把画面糊成乱麻；螺旋里索引差 8 / 13
    // 的点角度几乎重合，连它们才是真正的近邻短边，形成清爽的星座网。
    const step = k >= 14 ? 8 : 1;
    for (let j = 0; j < k; j++) {
      const a = vis[j];
      const b = vis[(j + step < k) ? j + step : (j + 1) % k];
      const pa = bookSprites[a].position, pb = bookSprites[b].position;
      if (pa.distanceToSquared(pb) > MAX_EDGE2) continue;
      flowNext[a] = b;
      if (v < MAX_NET_EDGES) {
        netPos[v * 6]     = pa.x; netPos[v * 6 + 1] = pa.y; netPos[v * 6 + 2] = pa.z;
        netPos[v * 6 + 3] = pb.x; netPos[v * 6 + 4] = pb.y; netPos[v * 6 + 5] = pb.z;
        v++;
      }
      if (k >= 22 && j + 13 < k && v < MAX_NET_EDGES) {
        const d = vis[j + 13], pd = bookSprites[d].position;
        if (pa.distanceToSquared(pd) > MAX_EDGE2) continue;
        netPos[v * 6]     = pa.x; netPos[v * 6 + 1] = pa.y; netPos[v * 6 + 2] = pa.z;
        netPos[v * 6 + 3] = pd.x; netPos[v * 6 + 4] = pd.y; netPos[v * 6 + 5] = pd.z;
        v++;
      }
    }
  }
  netGeo.setDrawRange(0, v * 2);
  netGeo.attributes.position.needsUpdate = true;
}

// 拖动平面：过被抓节点、垂直于视线；dragIdx 在下方节点物理块声明
const dragPlane = new THREE.Plane();
const dragHit = new THREE.Vector3();
const dragOffset = new THREE.Vector3();
const dragNormal = new THREE.Vector3();
function pickClusterAt(clientX, clientY) {
  if (!pickMeshes.length) return -1;
  const ndc = new THREE.Vector2(
    (clientX / window.innerWidth) * 2 - 1,
    -(clientY / window.innerHeight) * 2 + 1
  );
  _pickRay.setFromCamera(ndc, camera);
  const hits = _pickRay.intersectObjects(pickMeshes, false);
  return hits.length ? hits[0].object.userData.ci : -1;
}
// ---------- 节点级黏性物理（粘粘世界式，牵连只限同一分类内） ----------
// 拖一个书卷，同分类其余按距离衰减地跟过来，各自带散落 / 垂落 / 响应快慢差；
// 别的分类零牵引，只有真正被这一串「路过」撞上时才轻碰让开一点。
let dragIdx = -1;
const dragTarget = new THREE.Vector3();
let dragTargetSet = false;
let nodeOffset = [], nodeVel = [], nodeBase = [], nodeScatter = [];
const _nodeA = new THREE.Vector3(), _nodeB = new THREE.Vector3();
const _dragDelta = new THREE.Vector3();
const _shellOff = new THREE.Vector3();

function pickNodeAt(clientX, clientY) {
  if (hoveredIdx >= 0) return hoveredIdx;     // 直接指着书卷
  // 没精确指到书：找鼠标落在哪颗球里，取该团里屏幕投影最近的一本，抓取更宽容
  const ci = pickClusterAt(clientX, clientY);
  if (ci < 0 || !clusterMembers[ci]) return -1;
  let best = -1, bd = Infinity;
  for (const i of clusterMembers[ci]) {
    if (!bookSprites[i].visible || !bookData[i].url) continue;
    _nodeA.copy(bookSprites[i].position).project(camera);
    const sx = (_nodeA.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-_nodeA.y * 0.5 + 0.5) * window.innerHeight;
    const d = (sx - clientX) * (sx - clientX) + (sy - clientY) * (sy - clientY);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

function applyCollisions(activeCi) {
  // 跟着被拎起那颗一起动的同分类书卷，路过别的分类时只把对方轻碰让开；
  // 同分类内部靠弹性相连，互不推挤；别的分类绝不被吸过来
  const R = 4.4, R2 = R * R;
  const act = [];
  for (let i = 0; i < bookSprites.length; i++) {
    if (bookCluster[i] === activeCi && bookSprites[i].visible && bookData[i].url &&
        nodeOffset[i].lengthSq() > 0.04) act.push(i);
  }
  if (!act.length) return;
  for (const i of act) {
    _nodeA.copy(nodeBase[i]).add(nodeOffset[i]);
    for (let j = 0; j < bookSprites.length; j++) {
      if (bookCluster[j] === activeCi || !bookSprites[j].visible || !bookData[j].url) continue;
      _nodeB.copy(nodeBase[j]).add(nodeOffset[j]);
      const dx = _nodeB.x - _nodeA.x, dy = _nodeB.y - _nodeA.y, dz = _nodeB.z - _nodeA.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= R2 || d2 < 1e-6) continue;
      const d = Math.sqrt(d2), push = (R - d) * 0.6 / d;
      const s = nodeScatter[j], jitter = (1 - d / R) * 0.12;
      nodeOffset[j].x += dx * push + s.x * jitter;
      nodeOffset[j].y += dy * push + s.y * jitter;
      nodeOffset[j].z += dz * push + s.z * jitter;
    }
  }
}

// 双击分类名：被拖散的那一团依次收回初始的有序形状
const resettingCi = new Set();
function resetClusterLayout(ci) {
  const mem = clusterMembers[ci];
  if (!mem || !mem.length) return;
  resettingCi.add(ci);
  blip(560, 0.14, 0.03);
}

function nodePhysicsStep(dt) {
  const dragging = dragIdx >= 0 && dragMoved && dragTargetSet;
  if (!dragging) {
    // 松手后保持拖到的位置；只有被双击归位的分类才平滑收回初始形状
    const damp = Math.exp(-10.0 * dt);
    const homeDamp = [];
    for (let m = 0; m < 6; m++) homeDamp[m] = Math.exp(-(4.6 + m * 0.6) * dt);
    for (let i = 0; i < bookSprites.length; i++) {
      if (!bookSprites[i].visible || !bookData[i].url) continue;
      if (resettingCi.has(bookCluster[i])) {
        // 按索引错开快慢，像星星一颗颗归位，而不是整团瞬间平移回去
        nodeVel[i].set(0, 0, 0);
        nodeOffset[i].multiplyScalar(homeDamp[i % 6]);
        continue;
      }
      nodeVel[i].multiplyScalar(damp);
      nodeOffset[i].addScaledVector(nodeVel[i], dt);
    }
    if (resettingCi.size) {
      for (const ci of Array.from(resettingCi)) {
        let done = true;
        for (const i of clusterMembers[ci] || []) {
          if (nodeOffset[i] && nodeOffset[i].lengthSq() > 0.25) { done = false; break; }
        }
        if (done) {
          for (const i of clusterMembers[ci] || []) if (nodeOffset[i]) nodeOffset[i].set(0, 0, 0);
          resettingCi.delete(ci);
        }
      }
    }
    return;
  }
  const activeCi = bookCluster[dragIdx];
  const damp = Math.exp(-3.0 * dt);
  const still = Math.exp(-8.0 * dt);
  _dragDelta.copy(dragTarget).sub(nodeBase[dragIdx]);
  const dl = _dragDelta.length();
  const scatterAmt = Math.min(4.5, dl * 0.075);
  const sagAmt = Math.min(3.5, dl * 0.05);
  for (let i = 0; i < bookSprites.length; i++) {
    if (!bookSprites[i].visible || !bookData[i].url) continue;
    if (i !== dragIdx && bookCluster[i] !== activeCi) {
      // 其他分类零牵引：只收住残余速度，停在哪就在哪，不回位也不被吸过来
      nodeVel[i].multiplyScalar(still);
      nodeOffset[i].addScaledVector(nodeVel[i], dt);
      continue;
    }
    let tx, ty, tz, k;
    if (i === dragIdx) {
      tx = _dragDelta.x; ty = _dragDelta.y; tz = _dragDelta.z; k = 24.0;
    } else {
      // 一串珠子：按离被拎起那颗的距离衰减，各自带固定散落、越远越垂落，
      // 响应速度略有差异，不是刚性等幅平移
      const d = nodeBase[i].distanceTo(nodeBase[dragIdx]);
      const w = 0.9 / (1 + (d * d) / (26 * 26));
      const s = nodeScatter[i];
      tx = _dragDelta.x * w + s.x * scatterAmt;
      ty = _dragDelta.y * w + s.y * scatterAmt - sagAmt * (1 - w);
      tz = _dragDelta.z * w + s.z * scatterAmt;
      k = 7.0 + (i % 5) * 1.0;
    }
    nodeVel[i].x = (nodeVel[i].x + (tx - nodeOffset[i].x) * k * dt) * damp;
    nodeVel[i].y = (nodeVel[i].y + (ty - nodeOffset[i].y) * k * dt) * damp;
    nodeVel[i].z = (nodeVel[i].z + (tz - nodeOffset[i].z) * k * dt) * damp;
    if (nodeVel[i].lengthSq() > 300 * 300) nodeVel[i].setLength(300);
    nodeOffset[i].addScaledVector(nodeVel[i], dt);
  }
  applyCollisions(activeCi);
}
// 按真实经过时间推进并拆成小子步：低帧率下也按真实时间收敛
function updateNodePhysics(dt) {
  if (!nodeOffset.length) return;
  const n = Math.min(6, Math.max(1, Math.ceil(dt / 0.03)));
  const h = dt / n;
  for (let s = 0; s < n; s++) nodePhysicsStep(h);
  // 物理统一负责最终位置：基础位置 + 节点位移
  for (let i = 0; i < bookSprites.length; i++) {
    if (bookSprites[i].visible && bookData[i].url)
      bookSprites[i].position.copy(nodeBase[i]).add(nodeOffset[i]);
  }
}

let flowGeo = null, flowPos = null, flowCol = null, flowPhase = null;
function buildFlow() {
  const n = bookSprites.length;
  flowPos = new Float32Array(n * 3);
  flowCol = new Float32Array(n * 3);
  flowPhase = new Float32Array(n);
  for (let i = 0; i < n; i++) flowPhase[i] = Math.random();
  flowGeo = new THREE.BufferGeometry();
  flowGeo.setAttribute('position', new THREE.BufferAttribute(flowPos, 3));
  flowGeo.setAttribute('color', new THREE.BufferAttribute(flowCol, 3));
  // 固定像素尺寸的圆形光斑：避免近距离时被 sizeAttenuation 放大成白色方块
  const pts = new THREE.Points(flowGeo, new THREE.PointsMaterial({ size: 4, map: burstTex,
    vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false, sizeAttenuation: false }));
  pts.frustumCulled = false;
  scene.add(pts);
}
// 光点沿星座网的边流动：每本书 → 网里的下一本，拖动 / 自转时始终连着
function updateFlow(dt) {
  if (!flowGeo) return;
  for (let i = 0; i < bookSprites.length; i++) {
    const spr = bookSprites[i];
    const nx = flowNext ? flowNext[i] : -1;
    const nxt = nx >= 0 ? bookSprites[nx] : null;
    if (!spr.visible || !bookData[i] || !bookData[i].url || !nxt || !nxt.visible) {
      flowCol[i * 3] = flowCol[i * 3 + 1] = flowCol[i * 3 + 2] = 0;
      continue;
    }
    flowPhase[i] = (flowPhase[i] + dt * 0.26) % 1;
    const p = flowPhase[i], a = spr.position, b = nxt.position;
    flowPos[i * 3]     = a.x + (b.x - a.x) * p;
    flowPos[i * 3 + 1] = a.y + (b.y - a.y) * p;
    flowPos[i * 3 + 2] = a.z + (b.z - a.z) * p;
    const col = bookColor[i];
    flowCol[i * 3] = col.r; flowCol[i * 3 + 1] = col.g; flowCol[i * 3 + 2] = col.b;
  }
  flowGeo.attributes.position.needsUpdate = true;
  flowGeo.attributes.color.needsUpdate = true;
}
function updateBursts(dt) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    b.age += dt;
    const p = b.age / b.life;
    if (p >= 1) {
      scene.remove(b.spr);
      b.spr.material.dispose();
      bursts.splice(i, 1);
      continue;
    }
    const s = 2 + b.scaleTo * p;
    b.spr.scale.set(s, s, 1);
    b.spr.material.opacity = 0.9 * (1 - p) * (1 - p);
  }
}
const cardBase = new THREE.Vector2(1, 1);
const CARD_OFFSET = 3.6;
const cardDown = new THREE.Vector3();
// 沿「相机屏幕下方」偏移，而不是世界 Y：俯视/仰视时名牌也稳定在书卷下方，不遮住书卷
function placeCard(bp) {
  cardDown.set(0, -1, 0).applyQuaternion(camera.quaternion);
  cardSprite.position.copy(bp).addScaledVector(cardDown, CARD_OFFSET);
}
let cardAlpha = 0, cardShown = false, cardKey = '';

// ---------- 数据 ----------
let bookSprites = [], bookData = [], bookColor = [], bookCluster = [], clusterInfo = [], searchIndex = [];
let hoveredIdx = -1, pendingOpen = -1;
const driftData = [];
const baseScale = new THREE.Vector2(3.1, 3.1);
const HOVER_SCALE = 1.45;
const OPEN_DIST = 15;

const bookByUrl = new Map();   // URL -> { title, desc, sub, color }，供两个共享星团解析
let favSet = new Set();
function readUrlList(key) {
  try {
    const a = JSON.parse(localStorage.getItem(key));
    return Array.isArray(a) ? a.filter((x) => typeof x === 'string' && x) : [];
  } catch (e) { return []; }
}
function writeUrlList(key, arr) {
  try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) {}
}
function makeUrlCluster(name, key, center) {
  return { name, key, center, ci: -1, baseIdx: 0, count: 0, titleSpr: null, emptySpr: null };
}
const recents = makeUrlCluster('最近访问', RECENT_KEY, RECENTS_CENTER);
const favs = makeUrlCluster('我的收藏', FAV_KEY, FAVS_CENTER);
const urlClusters = [recents, favs];
function reloadFavs() { favSet = new Set(readUrlList(FAV_KEY)); }

// 与 2D 站 buildCategory 一致：直接 items + 各子分类 items 全部展开
function collectItems(cat) {
  const out = [];
  (cat.items || []).forEach((it) => out.push({ it, sub: '' }));
  (cat.subcategories || []).forEach((sub) => {
    (sub.items || []).forEach((it) => out.push({ it, sub: sub.name || '' }));
  });
  return out;
}

function catColor(i, n) {
  return new THREE.Color().setHSL((i * 0.13 + 0.05) % 1, 0.65, 0.62);
}

// 初始布局：星团在三维空间里自然散布，不排成同一平面的规整方阵。
// 黄金角螺旋给低差异的均匀底子，再叠确定性扰动与 3D 最小间距松弛，
// 前后 / 高低 / 疏密都有变化，像一片星系而不是等距排开的柜台。
let clusterCenters = [];
function computeClusterCenters(n) {
  const pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const yy = 1 - 2 * u;
    const rad = Math.sqrt(Math.max(0, 1 - yy * yy));
    const a = golden * i;
    const jr = 0.82 + 0.18 * Math.abs(Math.sin(i * 12.9898));
    pts.push(new THREE.Vector3(
      Math.cos(a) * rad * 190 * jr + Math.sin(i * 7.13) * 12,
      yy * 115 * jr + Math.sin(i * 3.71) * 10,
      Math.sin(a) * rad * 78 * jr - 50 + Math.sin(i * 5.19) * 12
    ));
  }
  // 松弛分两笔：屏幕上看到的是 x-y，这两轴必须拉开，否则前后两团会叠成一坨、
  // 分类名也糊在一起；z 只留较松的真实间距，纵深感照旧保留。
  for (let iter = 0; iter < 90; iter++) {
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        const pa = pts[a], pb = pts[b];
        const dx = pa.x - pb.x, dy = pa.y - pb.y, dz = pa.z - pb.z;
        const dxy = Math.hypot(dx, dy);
        if (dxy < 100 && dxy > 1e-4) {
          const push = (100 - dxy) * 0.5 / dxy;
          pa.x += dx * push; pa.y += dy * push;
          pb.x -= dx * push; pb.y -= dy * push;
        }
        const d3 = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d3 < 62 && d3 > 1e-4) {
          const push = (62 - d3) * 0.5 / d3;
          pa.z += dz * push; pb.z -= dz * push;
        }
      }
    }
  }
  return pts;
}

// 逐批构建：星空先动起来，书卷分批浮现，避免 280 个 sprite 一次性同步创建卡住首屏
function buildCategoryAt(cat, ci, n) {
  const center = clusterCenters[ci].clone();
  const col = catColor(ci, n);

  // 书卷在三维椭球里自然散布，不再压成一整片平面圆盘；仍有最小间距松弛防叠字
  const entries = collectItems(cat);
  const k = entries.length;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const pts = [];
  const R0 = 11 + Math.min(12, Math.sqrt(k) * 1.5);
  for (let j = 0; j < k; j++) {
    const yy = 1 - 2 * (j + 0.5) / k;
    const rad = Math.sqrt(Math.max(0, 1 - yy * yy));
    const theta = golden * j;
    const R = R0 * (0.8 + Math.random() * 0.2);
    const dir = new THREE.Vector3(
      Math.cos(theta) * rad,
      yy * 0.72,
      Math.sin(theta) * rad * 0.72
    );
    pts.push(center.clone().add(dir.multiplyScalar(R)));
  }
  const minDist = 6.0;
    for (let iter = 0; iter < 30; iter++) {
      for (let a = 0; a < k; a++) {
        for (let b = a + 1; b < k; b++) {
          const d = pts[a].clone().sub(pts[b]);
          const len = d.length();
          if (len < minDist && len > 1e-4) {
            d.multiplyScalar((minDist - len) * 0.5 / len);
            pts[a].add(d); pts[b].sub(d);
          }
        }
      }
    }
    entries.forEach((entry, j) => {
      const it = entry.it, sub = entry.sub;
      const p = pts[j].clone();
      const ch = (it.title || '·').trim().charAt(0) || '·';
      const tex = makeIconTexture(ch, col);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      spr.scale.set(baseScale.x, baseScale.y, 1);
      spr.position.copy(p);
      spr.userData.idx = bookData.length;
      scene.add(spr);
      bookSprites.push(spr);
      bookData.push({ url: it.url, title: it.title || '', desc: it.description || '', sub });
      bookByUrl.set(it.url, { title: it.title || '', desc: it.description || '', sub, color: col.clone() });
      bookColor.push(col.clone());
      bookCluster.push(ci);
      driftData.push({ base: p.clone(), phase: Math.random() * Math.PI * 2,
        amp: 0.2 + Math.random() * 0.3, speed: 0.2 + Math.random() * 0.3 });
    });
    // 一颗玻璃球罩住整团：淡轮廓、只画背面，不挡书卷
    const radius = R0 * 1.2 + 2;
    const sh = makeShell(ci, col, radius);
    sh.shell.position.copy(center);
    sh.pick.position.copy(center);
    // 每团缓慢自转（方向交替、速度略有差异），让书卷轮流到前面
    const spin = (0.018 + Math.random() * 0.02) * (ci % 2 ? 1 : -1);   // 盘内自转
    clusterInfo.push({ name: cat.category, center: center.clone(), titleSpr: null,
      count: entries.length, spin: spin, angle: 0, radius: radius,
      shell: sh.shell, pick: sh.pick, glow: 0 });
}

// 索引字段与 2D 首页共用：标题 / 描述 / URL 的小写原文 + 全拼 / 首字母。
// 拼音表异步加载完会再调一次，让首字母匹配即时生效。
let searchIndexBuilt = false;
function buildSearchIndex() {
  searchIndex = [];
  clusterInfo.forEach((c, ci) => {
    const name = c.name || '';
    searchIndex.push(Core.decorate({
      type: 'cat', name: name, cluster: ci,
      t: name.toLowerCase(), d: '', u: ''
    }));
  });
  bookData.forEach((d, i) => {
    if (!d || !d.url) return;
    const title = d.title || '';
    const desc = (d.sub ? d.sub + ' ' : '') + (d.desc || '');
    searchIndex.push(Core.decorate({
      type: 'item', title: title, desc: d.desc || '', sub: d.sub || '',
      url: d.url, inst: i,
      t: title.toLowerCase(), d: desc.toLowerCase(), u: d.url.toLowerCase()
    }));
  });
  searchIndexBuilt = true;
}

function finishSky() {
  urlClusters.forEach((cl) => {
    cl.ci = clusterInfo.length;
    const sh = makeShell(cl.ci, new THREE.Color(0xcfd8ff), 18);
    sh.shell.position.copy(cl.center);
    sh.pick.position.copy(cl.center);
    clusterInfo.push({ name: cl.name, center: cl.center.clone(), radius: 18,
      shell: sh.shell, pick: sh.pick, glow: 0 });
    cl.center = clusterInfo[cl.ci].center;   // 与星团中心共用引用，拖动后布局自动同步
    cl.baseIdx = bookData.length;
    for (let s = 0; s < CLUSTER_SLOTS; s++) {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
      spr.visible = false; spr.userData.idx = bookData.length;
      scene.add(spr);
      bookSprites.push(spr);
      bookData.push({ url: '', title: '', desc: '', sub: '' });
      bookColor.push(new THREE.Color(0xffffff));
      bookCluster.push(cl.ci);
      driftData.push({ base: cl.center.clone(), phase: Math.random() * 6.28, amp: 0.15, speed: 0.3 });
    }
  });
  migrateOldRecents();
  reloadFavs();
  refreshCluster(recents);
  refreshCluster(favs);

  buildSearchIndex();
  buildFlow();
  // 建立「团 -> 成员」索引与流光下一跳，星座网每帧据此动态重连
  clusterMembers = [];
  for (let ci = 0; ci < clusterInfo.length; ci++) clusterMembers.push([]);
  for (let i = 0; i < bookSprites.length; i++) {
    if (clusterMembers[bookCluster[i]]) clusterMembers[bookCluster[i]].push(i);
  }
  flowNext = new Int32Array(bookSprites.length).fill(-1);
  // 分类锚点卡：点一下直飞，双击把拖散的书卷收回有序形状
  // 单击延迟一瞬，好让双击能取消飞行、只做归位，视角不突然跳走
  let anchorClickTimer = 0;
  clusterInfo.forEach((c, ci) => {
    if (ci >= clusterInfo.length - urlClusters.length) return;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'anchor';
    el.innerHTML = escHtml(c.name) + ' <b>' + (c.count || 0) + '</b>';
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    el.style.animationDelay = (0.05 * ci) + 's';
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.detail > 1) return;      // 双击的第二下别再飞一次
      clearTimeout(anchorClickTimer);
      anchorClickTimer = setTimeout(() => teleportToCluster(ci, true), 230);
    });
    // 双击分类名：把拖散的书卷收回初始的有序形状
    el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      clearTimeout(anchorClickTimer);
      resetClusterLayout(ci);
    });
    anchorsEl.appendChild(el);
    c.anchorEl = el;
  });
}

// ---------- 最近访问 / 我的收藏（与 2D 站共用 URL 数组）----------
function migrateOldRecents() {
  try {
    const old = JSON.parse(localStorage.getItem(OLD_RECENT_KEY));
    if (!Array.isArray(old) || !old.length || readUrlList(RECENT_KEY).length) return;
    const urls = old.map((o) => (typeof o === 'string' ? o : o && o.url)).filter(Boolean).slice(0, 10);
    if (urls.length) writeUrlList(RECENT_KEY, urls);
  } catch (e) {}
}
function refreshCluster(cl) {
  if (!bookSprites.length) return;
  const urls = readUrlList(cl.key).slice(0, CLUSTER_SLOTS);
  for (let s = 0; s < CLUSTER_SLOTS; s++) {
    const idx = cl.baseIdx + s;
    bookSprites[idx].visible = false;
    bookSprites[idx].scale.set(baseScale.x, baseScale.y, 1);
    bookData[idx] = { url: '', title: '', desc: '', sub: '' };
  }
  let count = 0;
  for (const url of urls) {
    const info = bookByUrl.get(url);
    if (!info) continue;
    const idx = cl.baseIdx + count;
    bookData[idx] = { url, title: info.title, desc: info.desc, sub: info.sub };
    bookColor[idx].copy(info.color);
    const spr = bookSprites[idx];
    spr.material.map = makeIconTexture((info.title || '·').trim().charAt(0) || '·', bookColor[idx]);
    spr.material.needsUpdate = true;
    spr.visible = true;
    count++;
  }
  cl.count = count;
  layoutCluster(cl);
}
function layoutCluster(cl) {
  const k = cl.count;
  // 空态也给一行提示，让「最近访问 / 我的收藏」这两个星团始终可发现
  if (!cl.emptySpr) {
    const txt = cl.name === '最近访问' ? '暂无访问 · 去逛逛星图' : '暂无收藏 · 按 F 收藏书卷';
    const t = makeTitleTexture(txt, 640, 120, 42);
    cl.emptySpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true,
      depthWrite: false, fog: false, opacity: 0.5 }));
    cl.emptySpr.scale.set(22, 22 / t.aspect, 1);
    cl.emptySpr.position.copy(cl.center);
    scene.add(cl.emptySpr);
  }
  cl.emptySpr.visible = k === 0;
  if (!cl.titleSpr) {
    const t = makeTitleTexture('「' + cl.name + '」');
    cl.titleSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
    cl.titleSpr.scale.set(15, 15 / t.aspect, 1);
    cl.titleSpr.position.copy(cl.center).add(new THREE.Vector3(0, 13, 0));
    scene.add(cl.titleSpr);
  }
  cl.titleSpr.visible = k > 0;
  if (k === 0) { hoveredIdx = -1; cardShown = false; return; }
  const golden = Math.PI * (3 - Math.sqrt(5));
  const R = 8 + Math.min(4, k * 0.3);
  for (let i = 0; i < k; i++) {
    const yy = k > 1 ? 1 - (i / (k - 1)) * 2 : 0;
    const rad = Math.sqrt(Math.max(0, 1 - yy * yy));
    const theta = golden * i;
    const dir = new THREE.Vector3(Math.cos(theta) * rad, yy * 0.45, Math.sin(theta) * rad);
    const p = cl.center.clone().add(dir.multiplyScalar(R));
    if (p.y > cl.center.y + 9) p.y = cl.center.y + 6;
    bookSprites[cl.baseIdx + i].position.copy(p);
    driftData[cl.baseIdx + i].base = p.clone();
  }
  hoveredIdx = -1; cardShown = false;
}
// 写入格式与 2D 站 recordVisit 完全一致，两站互相可见
function recordVisit(url) {
  const r = [url].concat(readUrlList(RECENT_KEY).filter((x) => x !== url)).slice(0, 10);
  writeUrlList(RECENT_KEY, r);
  refreshCluster(recents);
  buildCatRail();
  whereCi = -2;
}
function toggleFavUrl(url) {
  blip(620, 0.09, 0.04);
  const arr = readUrlList(FAV_KEY);
  const i = arr.indexOf(url);
  if (i >= 0) arr.splice(i, 1); else arr.push(url);
  writeUrlList(FAV_KEY, arr);
  reloadFavs();
  refreshCluster(favs);
  buildCatRail();
  whereCi = -2;
}

// ---------- 控制：拖拽环顾 + 阻尼飞行 ----------
let searchOpen = false, helpOpen = false;
const keys = Object.create(null);
let yaw = 0, pitch = 0;
let tYaw = 0, tPitch = 0;
let gliding = false;
let started = false;
const camTarget = HOME_POS.clone();
let walkRemaining = 0;
let hintTimer = 0;
const STEP = 10, WALK_CLAMP = 50, MOVE_SPEED = 15.0, MAX_R = 900;
const POS_LERP = 8.5, ANG_LERP = 6.0;
const _UP = new THREE.Vector3(0, 1, 0);
const _panF = new THREE.Vector3(), _panR = new THREE.Vector3(), _panU = new THREE.Vector3();
let mouseNDC = new THREE.Vector2(0, 0);
let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
let pointerActive = false, dragMoved = false, downX = 0, downY = 0;
let introPush = 0, entered = false, focusCi = -1;

function onKey(e, down) {
  const k = e.code;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'ShiftLeft', 'ShiftRight'].includes(k)) keys[k] = down;
}
document.addEventListener('keydown', (e) => { if (!searchOpen && !helpOpen && !isTyping()) onKey(e, true); });
document.addEventListener('keyup', (e) => onKey(e, false));

function updateHint() {
  if (!hintEl) return;
  hintEl.style.opacity = (started && !searchOpen && !helpOpen && hintTimer < 8) ? '1' : '0';
}
// Esc 指南：复活原先从未显示的暂停层，给出常驻操作说明与星图统计
function openHelp() {
  if (!started) return;
  if (searchOpen) closeSearch();
  helpOpen = true;
  if (helpStatEl) {
    helpStatEl.textContent = '星图共 ' + (clusterInfo.length - urlClusters.length) +
      ' 分类 · ' + bookByUrl.size + ' 站点';
  }
  pauseOv.classList.remove('hidden');
  updateHint();
}
function closeHelp() {
  helpOpen = false;
  pauseOv.classList.add('hidden');
  updateHint();
}
resumeBtn.addEventListener('click', closeHelp);
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || searchOpen || helpOpen) return;
  pointerActive = true; dragMoved = false; downX = e.clientX; downY = e.clientY;
  // 抓单个节点：优先指着的那本；没指到就抓球内屏幕最近的一本
  dragIdx = pickNodeAt(e.clientX, e.clientY);
  if (dragIdx >= 0) {
    resettingCi.delete(bookCluster[dragIdx]);   // 手动接管这一团，取消它的归位
    camera.getWorldDirection(dragNormal);
    dragPlane.setFromNormalAndCoplanarPoint(dragNormal, bookSprites[dragIdx].position);
    const ndc = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
    _pickRay.setFromCamera(ndc, camera);
    if (_pickRay.ray.intersectPlane(dragPlane, dragHit)) {
      dragOffset.copy(bookSprites[dragIdx].position).sub(dragHit);
    } else {
      dragOffset.set(0, 0, 0);
    }
    dragTarget.copy(bookSprites[dragIdx].position);
    dragTargetSet = false;      // 等真正拖过 6px 再启用
    clusterInfo[bookCluster[dragIdx]].glow = 1;
    blip(440, 0.08, 0.03);
  }
});
window.addEventListener('pointermove', (e) => {
  mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  mouseX = e.clientX; mouseY = e.clientY;
  // 准星默认跟随光标；命中书卷后由 updateReticle 磁吸到书卷中心
  reticle.style.left = mouseX + 'px';
  reticle.style.top = mouseY + 'px';
  if (!pointerActive || searchOpen || helpOpen) return;
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) dragMoved = true;
  if (dragIdx >= 0 && dragMoved) {
    // 拖单个节点：只设它自己的目标点，其余完全独立；视角不动
    _pickRay.setFromCamera(mouseNDC, camera);
    if (_pickRay.ray.intersectPlane(dragPlane, dragHit)) {
      dragTarget.copy(dragHit).add(dragOffset);
      dragTargetSet = true;
    }
    return;
  }
  if (e.shiftKey) {
    // Shift + 拖空地：抓住整片天空平移，像拖动一张星图，哪里都能去
    camera.getWorldDirection(_panF);
    _panR.crossVectors(_panF, _UP);
    if (_panR.lengthSq() < 1e-4) _panR.set(1, 0, 0); else _panR.normalize();
    _panU.crossVectors(_panR, _panF).normalize();
    const scale = 0.10 + camTarget.length() * 0.0018;
    camTarget.addScaledVector(_panR, -(e.movementX || 0) * scale);
    camTarget.addScaledVector(_panU, (e.movementY || 0) * scale);
    clampTarget();
  } else {
    yaw   -= (e.movementX || 0) * 0.0024;
    pitch -= (e.movementY || 0) * 0.0024;
    pitch = Math.max(-1.54, Math.min(1.54, pitch));
  }
  gliding = false;
});
window.addEventListener('pointerup', () => {
  if (!pointerActive) return;
  pointerActive = false;
  if (dragIdx >= 0) {
    clusterInfo[bookCluster[dragIdx]].glow = 0;
    if (dragMoved) blip(360, 0.1, 0.03);
    dragIdx = -1;
    dragTargetSet = false;      // 松手后物理转入「晃悠归位」
  }
  if (dragMoved || searchOpen || helpOpen) return;
  updatePick(true);
  if (hoveredIdx >= 0) {
    const bp = bookSprites[hoveredIdx].position;
    if (camera.position.distanceTo(bp) <= OPEN_DIST) openBook(hoveredIdx);
    else teleportToBook(hoveredIdx, true);
  } else {
    walkRemaining = Math.max(-WALK_CLAMP, Math.min(WALK_CLAMP, walkRemaining + STEP));
  }
});
window.addEventListener('wheel', (e) => {
  if (!started || searchOpen || helpOpen) return;
  e.preventDefault();
  const f = new THREE.Vector3();
  camera.getWorldDirection(f);
  // 拉得越远，一格滚得越多，才走得出这片大天空
  camTarget.addScaledVector(f, -e.deltaY * 0.13 * (1 + camTarget.length() / 220));
  clampTarget();
  gliding = false;
}, { passive: false });

function clampTarget() { if (camTarget.length() > MAX_R) camTarget.setLength(MAX_R); }
function faceFromTo(from, to) {
  const d = to.clone().sub(from).normalize();
  return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.asin(Math.max(-1, Math.min(1, d.y))) };
}
function glideTo(pos, lookAt) {
  camTarget.copy(pos);
  clampTarget();
  const a = faceFromTo(pos, lookAt);
  tYaw = a.yaw;
  tPitch = Math.max(-1.54, Math.min(1.54, a.pitch));
  gliding = true;
}
// ---------- hash 路由：刷新保持、前进后退、可分享 ----------
let routing = false;
function setHash(h, push) {
  if (routing) return;
  try {
    const url = h || (location.pathname + location.search);
    if (push) history.pushState(null, '', url);
    else history.replaceState(null, '', url);
  } catch (e) {}
}
// 书卷用 URL 编码做稳定标识：nav.json 顺序变化或空槽位增减都不会让分享链接失效
function bookHashOf(inst) {
  const u = bookData[inst] && bookData[inst].url;
  return u ? '#site-' + encodeURIComponent(u) : '';
}
function applyHash() {
  const hash = location.hash;
  const cat = /^#cat-(\d+)$/.exec(hash);
  const site = hash.indexOf('#site-') === 0 ? hash.slice(6) : '';
  const legacy = /^#book-(\d+)$/.exec(hash);   // 兼容旧链接
  if (!cat && !site && !legacy) return;
  routing = true;
  introPush = 0;   // 有直达目标就跳过慢速入场推镜，否则要七八秒才飞到位
  if (cat && clusterInfo[+cat[1]]) teleportToCluster(+cat[1]);
  else if (site) {
    let url = site;
    try { url = decodeURIComponent(site); } catch (e) {}
    const idx = bookData.findIndex((d) => d && d.url === url);
    if (idx >= 0 && bookSprites[idx] && bookSprites[idx].visible) teleportToBook(idx);
  } else if (legacy && bookSprites[+legacy[1]]) teleportToBook(+legacy[1]);
  // 直达链接 / 刷新：直接落到目标，不做飞入动画（正常进入仍保留入场推镜）
  camera.position.copy(camTarget);
  yaw = tYaw; pitch = tPitch; gliding = false;
  routing = false;
}
window.addEventListener('popstate', applyHash);

function goHome() {
  setHash('');
  blip(300, 0.2, 0.035);
  pendingOpen = -1;
  glideTo(HOME_POS.clone(), new THREE.Vector3(0, 4, 0));
  mouseNDC.set(0, 0);
  hoveredIdx = -1;
  cardShown = false;
}

function enterNow() {
  if (!started || entered) return;
  entered = true;
  introOv.style.transition = 'opacity .6s ease';
  introOv.style.opacity = '0';
  setTimeout(() => introOv.classList.add('hidden'), 620);
  muteBtn.style.display = 'block';
  searchBtn.style.display = 'block';
  reticle.classList.add('active');
  reticle.style.left = (window.innerWidth / 2) + 'px';
  reticle.style.top = (window.innerHeight / 2) + 'px';
  catrailEl.classList.add('show');
  whereEl.classList.add('show');
  overviewEl.classList.add('show');
  anchorsEl.style.display = 'block';
  startAudio();
  hintTimer = 0;
  updateHint();
}
enterBtn.addEventListener('click', enterNow);

// ---------- 拾取 ----------
const raycaster = new THREE.Raycaster();
function updatePick() {
  if (!bookSprites.length) return;
  raycaster.setFromCamera(mouseNDC, camera);
  const hits = raycaster.intersectObjects(bookSprites, false);
  let nh = -1;
  for (const h of hits) {
    const oi = h.object.userData.idx;
    if (bookSprites[oi].visible && bookData[oi] && bookData[oi].url) { nh = oi; break; }
  }
  if (nh !== hoveredIdx) {
    if (hoveredIdx >= 0 && bookSprites[hoveredIdx]) {
      bookSprites[hoveredIdx].scale.set(baseScale.x, baseScale.y, 1);
    }
    hoveredIdx = nh;
    cardKey = '';
    if (nh >= 0) blip(680, 0.05, 0.016);
  }
  if (hoveredIdx >= 0) {
    const d = bookData[hoveredIdx];
    const col = bookColor[hoveredIdx];
    const bp = bookSprites[hoveredIdx].position;
    const dist = camera.position.distanceTo(bp);
    const twoStep = (pendingOpen === hoveredIdx || dist > OPEN_DIST);
    const isFav = favSet.has(d.url);
    const key = hoveredIdx + '|' + (twoStep ? '再' : '开') + '|' + (isFav ? '★' : '☆');
    if (cardKey !== key) {
      cardKey = key;
      const desc = (d.sub ? '「' + d.sub + '」 ' : '') + d.desc;
      const hint = (twoStep ? '再次单击 · 展卷' : '单击 · 展卷') +
        (isFav ? '  ·  ★ 已收藏 (F 取消)' : '  ·  F 收藏');
      const cat = clusterInfo[bookCluster[hoveredIdx]] ? clusterInfo[bookCluster[hoveredIdx]].name : '';
      const t = makeCardTexture(d.title, desc, '#' + col.getHexString(), hint, cat);
      if (cardSprite.material.map) cardSprite.material.map.dispose();
      cardSprite.material.map = t;
      cardSprite.material.needsUpdate = true;
      const sh = 1.8;
      cardBase.set(sh * t.aspect, sh);
      cardSprite.scale.set(cardBase.x, cardBase.y, 1);
    }
    placeCard(bp);
    reticle.classList.add('hot');
    cardShown = true;
  } else {
    reticle.classList.remove('hot');
    cardShown = false;
  }
}
function openBook(idx) {
  const d = bookData[idx];
  if (d && d.url) {
    const bp = bookSprites[idx].position;
    const col = bookColor[idx].clone();
    burstAt(bp, col, 20, 0.72);
    burstAt(bp, col, 11, 0.45);
    blip(760, 0.18, 0.05);
    window.open(d.url, '_blank', 'noopener');
    recordVisit(d.url);
  }
}

// ---------- 环境音 ----------
let audioCtx = null, audioGain = null, audioOn = false;
function blip(freq, dur, vol) {
  if (!audioCtx || !audioOn) return;
  try {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    const now = audioCtx.currentTime;
    o.type = 'sine'; o.frequency.setValueAtTime(freq, now);
    o.frequency.exponentialRampToValueAtTime(freq * 1.35, now + dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(now); o.stop(now + dur + 0.02);
  } catch (e) {}
}
function startAudio() {
  if (audioCtx) { audioCtx.resume(); audioGain.gain.value = 0.05; audioOn = true; muteBtn.textContent = '♪ 声音'; return; }
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioGain = audioCtx.createGain(); audioGain.gain.value = 0.05;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 300;
    const o1 = audioCtx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 52;
    const o2 = audioCtx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 52.5;
    const o3 = audioCtx.createOscillator(); o3.type = 'triangle'; o3.frequency.value = 104;
    const g3 = audioCtx.createGain(); g3.gain.value = 0.3;
    o1.connect(filter); o2.connect(filter); o3.connect(g3); g3.connect(filter);
    filter.connect(audioGain); audioGain.connect(audioCtx.destination);
    o1.start(); o2.start(); o3.start();
    audioOn = true;
  } catch (e) {}
}
// 自动进入时 AudioContext 可能处于 suspended，首次真实交互再唤醒
document.addEventListener('pointerdown', () => {
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
});

muteBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!audioCtx) return;
  if (audioOn) { audioGain.gain.value = 0; audioOn = false; muteBtn.textContent = '✕ 静音'; }
  else { audioGain.gain.value = 0.05; audioOn = true; muteBtn.textContent = '♪ 声音'; }
});

// ---------- 分类直达栏 / 当前位置 ----------
function buildCatRail() {
  catrailEl.innerHTML = '';
  const home = document.createElement('button');
  home.className = 'cr-chip cr-home';
  home.textContent = '⌂ 归位';
  home.addEventListener('click', (e) => { e.stopPropagation(); goHome(); });
  catrailEl.appendChild(home);
  clusterInfo.forEach((c, ci) => {
    const b = document.createElement('button');
    b.className = 'cr-chip';
    b.textContent = c.name;
    b.dataset.ci = ci;
    if ((c.name === '最近访问' && recents.count === 0) || (c.name === '我的收藏' && favs.count === 0)) {
      b.classList.add('empty');
      b.title = '暂无记录，点此可看看';
    }
    b.addEventListener('click', (e) => { e.stopPropagation(); teleportToCluster(ci, true); });
    catrailEl.appendChild(b);
  });
}
let whereCi = -2, whereTick = 0, whereText = '';
function updateWhere(dt) {
  whereTick -= dt;
  if (whereTick > 0) return;
  whereTick = 0.3;
  let best = -1, bd = Infinity;
  for (let i = 0; i < clusterInfo.length; i++) {
    const d = camera.position.distanceToSquared(clusterInfo[i].center);
    if (d < bd) { bd = d; best = i; }
  }
  const far = Math.sqrt(bd) > 62;
  const label = far ? '星图全景' : (best >= 0 ? clusterInfo[best].name : '');
  if (label !== whereText) {
    whereText = label;
    whereEl.textContent = label ? '当前 · ' + label : '';
  }
  const active = far ? -1 : best;
  if (active !== whereCi) {
    whereCi = active;
    catrailEl.querySelectorAll('.cr-chip').forEach((el) => {
      el.classList.toggle('active', el.dataset.ci !== undefined && +el.dataset.ci === active);
    });
  }
}

// ---------- 搜索 ----------
const searchBtn = $('searchBtn');
const searchOv = $('searchOv');
const searchInput = $('searchInput');
const searchResults = $('searchResults');
const searchClose = $('searchClose');
const searchCount = $('searchCount');
// 拼音表与 2D 站共用同一份构建产物；加载完成后重建索引并重渲染，首字母才不会漏
const PINYIN_PROMISE = new Promise((resolve) => {
  if (window.PINYIN_MAP) { resolve(); return; }
  const s = document.createElement('script');
  s.src = 'assets/js/pinyin-map.js'; s.async = true;
  s.onload = resolve; s.onerror = resolve;
  document.head.appendChild(s);
});
PINYIN_PROMISE.then(() => {
  if (!searchIndexBuilt) return;        // 索引还没建，finishSky 会直接用已就绪的拼音表
  buildSearchIndex();
  if (searchOpen) renderSearch();
  if (quickInput.value.trim()) renderQuick();
});
function escHtml(s) {
  return (s || '').replace(/[&<>^"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
// 两个搜索框共用同一个键盘内核：↑↓ 选择、Enter 打开、Esc 收起
const searchKeys = Core.bindKeys(searchInput, {
  results: searchResults, itemSel: '.res',
  isOpen: () => searchOpen,
  enterDefaultFirst: true,
  onActivate: (el) => el.click(),
  onEscape: (e) => { e.stopPropagation(); closeSearch(); }
});
function openSearch() {
  if (!started) return;
  if (helpOpen) closeHelp();
  searchOpen = true;
  hoveredIdx = -1; cardShown = false;
  searchOv.classList.remove('hidden');
  updateHint();
  // 常驻搜索框里已经打了字，就顺手带进全屏搜索，不必重敲一遍
  searchInput.value = quickInput.value.trim();
  quickResEl.classList.remove('show');
  renderSearch();
  setTimeout(() => searchInput.focus(), 30);
}
function closeSearch() {
  searchOpen = false;
  searchOv.classList.add('hidden');
  updateHint();
}
function renderSearch() {
  const q = searchInput.value.trim();
  const all = Core.search(searchIndex, q);
  const list = all.slice(0, 40);
  searchResults.innerHTML = '';
  searchCount.textContent = q
    ? (all.length
        ? '匹配 ' + all.length + ' 项' + (all.length > 40 ? ' · 显示前 40' : '') + ' · 支持拼音首字母'
        : '无匹配 · 试试拼音首字母')
    : '输入即搜 · 支持拼音首字母';
  if (!list.length) {
    searchResults.innerHTML = '<div class="rd" style="opacity:.5">' +
      (q ? '无匹配 · 试试拼音首字母，或换个关键词' : '输入关键词开始搜索') + '</div>';
    searchKeys.reset();
    return;
  }
  for (const r of list) {
    const div = document.createElement('div');
    div.className = 'res';
    if (r.type === 'cat') {
      const n = clusterInfo[r.cluster] ? clusterInfo[r.cluster].count : 0;
      div.innerHTML = '<div class="rt">' + Core.highlight(r.name, q) + '<span class="rk">分类</span></div>' +
        '<div class="rd">' + n + ' 个站点 · 飞至此分类星团</div>';
    } else {
      div.innerHTML = '<div class="rt">' + Core.highlight(r.title, q) + '<span class="rk">网站</span></div>' +
        '<div class="rd">' + (r.sub ? '「' + escHtml(r.sub) + '」 ' : '') + Core.highlight(r.desc || '', q) + '</div>';
    }
    div.addEventListener('click', () => goToResult(r));
    searchResults.appendChild(div);
  }
  searchKeys.reset();
}
function goToResult(r) {
  if (r.type === 'cat') teleportToCluster(r.cluster, true);
  else teleportToBook(r.inst, true);
  closeSearch();
}
function teleportToCluster(ci, push) {
  const c = clusterInfo[ci];
  const dir = c.center.clone();
  if (dir.lengthSq() < 1) dir.set(0, 0, 1);
  dir.normalize();
  const pos = c.center.clone().addScaledVector(dir, 24);
  pos.y += 5;
  glideTo(pos, c.center);
  setHash('#cat-' + ci, push);
  pendingOpen = -1;
  mouseNDC.set(0, 0);
  hoveredIdx = -1;
  cardShown = false;
}
function teleportToBook(inst, push) {
  const ci = bookCluster[inst];
  const c = clusterInfo[ci];
  const bp = bookSprites[inst].position.clone();
  const out = bp.clone().sub(c.center);
  if (out.lengthSq() < 1) out.set(0, 0, 1);
  out.normalize();
  // 书卷落在星团正上/正下方时，纯垂直会让俯仰角撞到 clamp，书卷偏离准星；改从斜侧接近
  if (Math.abs(out.y) > 0.75) {
    out.x += 0.85; out.z += 0.55; out.normalize();
  }
  const pos = bp.clone().addScaledVector(out, 10);
  pos.y += 1.5;
  glideTo(pos, bp);
  setHash(bookHashOf(inst), push);
  mouseNDC.set(0, 0);
  pendingOpen = inst;
  hoveredIdx = -1;
  cardShown = false;
}
searchBtn.addEventListener('click', openSearch);
searchClose.addEventListener('click', closeSearch);
searchInput.addEventListener('input', renderSearch);

// ---------- 常驻快捷搜索（首页高频动作，不必按 / 调出全屏） ----------
const quickKeys = Core.bindKeys(quickInput, {
  results: quickResEl, itemSel: '.qres',
  isOpen: () => quickResEl.classList.contains('show'),
  enterDefaultFirst: true,
  onActivate: (el) => el.click(),
  onEscape: (e) => {
    e.stopPropagation();
    quickInput.value = ''; quickResEl.classList.remove('show'); quickInput.blur();
  }
});
function renderQuick() {
  const q = quickInput.value.trim();
  if (!q) { quickResEl.classList.remove('show'); quickResEl.innerHTML = ''; return; }
  const list = Core.search(searchIndex, q).slice(0, 8);
  quickResEl.innerHTML = '';
  if (!list.length) {
    quickResEl.innerHTML = '<div class="qres-empty">无匹配 · 试试拼音首字母</div>';
    quickResEl.classList.add('show');
    quickKeys.reset();
    return;
  }
  for (const r of list) {
    const div = document.createElement('div');
    div.className = 'qres';
    div.innerHTML = Core.highlight(r.type === 'cat' ? r.name : r.title, q) +
      '<span class="qk">' + (r.type === 'cat' ? '分类' : '网站') + '</span>';
    div.addEventListener('click', () => {
      if (r.type === 'cat') teleportToCluster(r.cluster, true);
      else teleportToBook(r.inst, true);
      quickInput.value = '';
      quickResEl.classList.remove('show');
      quickInput.blur();
    });
    quickResEl.appendChild(div);
  }
  quickResEl.classList.add('show');
  quickKeys.reset();
}
quickInput.addEventListener('input', renderQuick);
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest || !e.target.closest('#quickWrap')) quickResEl.classList.remove('show');
});
let keyboardIdx = -1;
function focusNextBook(dir) {
  if (!bookData.length) return;
  const n = bookData.length;
  let i = keyboardIdx < 0 ? (dir > 0 ? -1 : 0) : keyboardIdx;
  for (let step = 0; step < n; step++) {
    i = (i + dir + n) % n;
    if (bookSprites[i] && bookSprites[i].visible && bookData[i] && bookData[i].url) {
      keyboardIdx = i;
      // 即时反馈：选中处先炸开一圈光，再飞过去
      burstAt(bookSprites[i].position, bookColor[i].clone(), 9, 0.5);
      blip(520, 0.07, 0.05);
      teleportToBook(i);
      return;
    }
  }
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (searchOpen) closeSearch();
    else if (helpOpen) closeHelp();
    else openHelp();
    return;
  }
  if (helpOpen || isTyping()) return;   // 在搜索框里打字时，别触发 3D 的飞行 / 展卷快捷键
  if (e.key === '/' && started && !searchOpen && document.activeElement !== quickInput) { e.preventDefault(); openSearch(); }
  else if (e.key === 'Tab' && started && !searchOpen) { e.preventDefault(); focusNextBook(e.shiftKey ? -1 : 1); }
  else if (e.key === 'Enter' && started && !searchOpen) {
    e.preventDefault();
    const idx = hoveredIdx >= 0 ? hoveredIdx : keyboardIdx;
    if (idx < 0) return;
    const bp = bookSprites[idx].position;
    if (camera.position.distanceTo(bp) <= OPEN_DIST) openBook(idx);
    else teleportToBook(idx);
  }
  else if ((e.key === 'Home' || e.key === 'h' || e.key === 'H') && started && !searchOpen) { goHome(); }
  else if ((e.key === 'f' || e.key === 'F') && started && !searchOpen && hoveredIdx >= 0) {
    const d = bookData[hoveredIdx];
    if (d && d.url) toggleFavUrl(d.url);
  }
});

// ---------- 主循环 ----------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.05);
  const t = clock.elapsedTime;
  // 高 DPR 若拖慢帧率，自动回落到 1.25；只在完整星图就绪后测，避免误判
  if (started && !perfChecked) {
    perfFrames++; perfReal += rawDt;
    if (perfReal > 2.5) {
      perfChecked = true;
      if (perfFrames / perfReal < 40 && DPR_HIGH > 1.25) {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
    }
  }

  if (started && !searchOpen && !helpOpen) {
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    const right = new THREE.Vector3().crossVectors(fwd, _UP);
    if (right.lengthSq() < 1e-4) right.set(1, 0, 0); else right.normalize();
    const mv = new THREE.Vector3();
    if (keys['KeyW'] || keys['ArrowUp'])    mv.add(fwd);
    if (keys['KeyS'] || keys['ArrowDown'])  mv.sub(fwd);
    if (keys['KeyD'] || keys['ArrowRight']) mv.add(right);
    if (keys['KeyA'] || keys['ArrowLeft'])  mv.sub(right);
    const sprint = (keys['ShiftLeft'] || keys['ShiftRight']) ? 1.8 : 1.0;
    if (mv.lengthSq() > 0) {
      mv.normalize().multiplyScalar(MOVE_SPEED * sprint * dt);
      camTarget.add(mv); clampTarget();
    }
    let step = 0;
    if (walkRemaining > 0) step = Math.min(walkRemaining, MOVE_SPEED * dt);
    else if (walkRemaining < 0) step = -Math.min(-walkRemaining, MOVE_SPEED * dt);
    walkRemaining -= step;
    if (step !== 0) { camTarget.addScaledVector(fwd, step); clampTarget(); }
    if (!(dragIdx >= 0 && dragMoved)) updatePick();   // 拖节点时名牌停在抓住的那本，不跟着乱跳
    if (hintTimer < 8) {
      hintTimer += dt;
      if (hintTimer >= 8) hintEl.style.opacity = '0';
    }
  }

  // 阻尼相机：位置追随 + 自动转向
  const pushK = introPush > 0 ? 1.6 : POS_LERP;
  camera.position.lerp(camTarget, 1 - Math.exp(-pushK * dt));
  if (introPush > 0) introPush = Math.max(0, introPush - dt / 1.8);
  if (gliding) {
    const a = 1 - Math.exp(-ANG_LERP * dt);
    yaw   += (tYaw - yaw) * a;
    pitch += (tPitch - pitch) * a;
    if (Math.abs(tYaw - yaw) < 0.0015 && Math.abs(tPitch - pitch) < 0.0015) {
      yaw = tYaw; pitch = tPitch; gliding = false;
    }
  }
  euler.set(pitch, yaw, 0, 'YXZ');
  camera.quaternion.setFromEuler(euler);

  // 书卷漂浮 + 微光呼吸：所有球始终同亮度常驻，不再折叠 / 压暗其他团
  focusCi = -1;
  let bestD = Infinity, bestCi = -1;
  for (let ci = 0; ci < clusterInfo.length; ci++) {
    const dd = camera.position.distanceTo(clusterInfo[ci].center);
    if (dd < bestD) { bestD = dd; bestCi = ci; }
  }
  if (bestD < 36) focusCi = bestCi;   // 仅用于「飞近冻结该团自转」，不再影响亮度
  // 累积自转角度而非 t*spin：飞近该团时冻结，暂停/恢复都不会跳变，落点也不漂移
  for (let ci = 0; ci < clusterInfo.length; ci++) {
    const c = clusterInfo[ci];
    if (c.spin && focusCi !== ci) c.angle += dt * c.spin;
    if (c.shell) {
      const u = c.shell.material.uniforms.uGlow;
      u.value += ((c.glow || 0) - u.value) * Math.min(1, dt * 8);
      // 飞进 / 贴近这颗球时本球壳淡出，避免巨大边缘光糊脸；其他球不受影响
      const fade = Math.max(0, Math.min(1,
        (camera.position.distanceTo(c.center) - (c.radius || 20) * 0.9) / 28));
      c.shell.material.uniforms.uFade.value = fade;
      // 球壳跟着该团节点的平均位移，避免书卷被拖走后留下一个空壳
      _shellOff.set(0, 0, 0);
      const mem = clusterMembers[ci];
      if (mem) {
        let n = 0;
        for (const i of mem) {
          if (bookSprites[i] && bookSprites[i].visible && bookData[i] && bookData[i].url && nodeOffset[i]) {
            _shellOff.add(nodeOffset[i]); n++;
          }
        }
        if (n) _shellOff.multiplyScalar(1 / n);
      }
      c.shell.position.copy(c.center).add(_shellOff);
      if (c.pick) c.pick.position.copy(c.shell.position);
    }
  }
  // 书卷逐个构建时同步补齐节点物理数组
  if (nodeBase.length !== bookSprites.length) {
    while (nodeBase.length < bookSprites.length) {
      nodeOffset.push(new THREE.Vector3());
      nodeVel.push(new THREE.Vector3());
      nodeBase.push(new THREE.Vector3());
      nodeScatter.push(new THREE.Vector3(
        Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1
      ).normalize());
    }
  }
  for (let i = 0; i < bookSprites.length; i++) {
    const d = driftData[i];
    const ci = bookCluster[i];
    const c = clusterInfo[ci];
    let bx = d.base.x, by = d.base.y, bz = d.base.z;
    if (c) {
      // 慢自转：在星盘平面内绕 Z 轴流转，盘始终正对相机、书卷轮流换位
      // 已被拖走 / 碰开的书卷停在世界里，不再绕原团心慢慢荡回来
      if (c.spin && c.angle && (!nodeOffset[i] || nodeOffset[i].lengthSq() < 0.5)) {
        const ca = Math.cos(c.angle), sa = Math.sin(c.angle);
        const dx = bx - c.center.x, dy = by - c.center.y;
        bx = c.center.x + dx * ca - dy * sa;
        by = c.center.y + dx * sa + dy * ca;
      }
    }
    nodeBase[i].set(
      bx + Math.sin(t * d.speed + d.phase) * d.amp,
      by + Math.cos(t * d.speed * 0.8 + d.phase) * d.amp,
      bz + Math.sin(t * d.speed * 1.1 + d.phase) * d.amp * 0.6
    );
    bookSprites[i].position.copy(nodeBase[i]);
    if (i !== hoveredIdx) {
      bookSprites[i].material.opacity = 0.9 + 0.1 * Math.sin(t * 1.5 + d.phase);
      bookSprites[i].scale.set(baseScale.x, baseScale.y, 1);
    }
  }
  updateNodePhysics(Math.min(rawDt, 0.12));   // 节点黏性物理：先出最终位置
  updateNet();      // 再按最终位置重连星座网（拖一个节点，一串线跟着变形）

  // 悬停：放大 + 光晕 + 名牌
  if (hoveredIdx >= 0 && bookSprites[hoveredIdx]) {
    const p = 1 + 0.045 * Math.sin(t * 6);
    bookSprites[hoveredIdx].scale.set(baseScale.x * HOVER_SCALE * p, baseScale.y * HOVER_SCALE * p, 1);
    bookSprites[hoveredIdx].material.opacity = 1;
    const bp = bookSprites[hoveredIdx].position;
    halo.position.copy(bp);
    halo.scale.set(baseScale.x * 2.7, baseScale.y * 2.7, 1);
    halo.material.color.copy(bookColor[hoveredIdx]);
    halo.material.opacity += (0.5 - halo.material.opacity) * Math.min(1, dt * 10);
    hoverRing.position.copy(bp);
    hoverRing.scale.set(baseScale.x * 2.15, baseScale.y * 2.15, 1);
    hoverRing.material.color.copy(bookColor[hoveredIdx]);
    hoverRing.material.opacity += (0.40 - hoverRing.material.opacity) * Math.min(1, dt * 10);
    hoverRing.material.rotation += dt * 0.8;
    placeCard(bp);
  } else {
    halo.material.opacity += (0 - halo.material.opacity) * Math.min(1, dt * 10);
    hoverRing.material.opacity += (0 - hoverRing.material.opacity) * Math.min(1, dt * 10);
  }
  halo.visible = halo.material.opacity > 0.02;
  hoverRing.visible = hoverRing.material.opacity > 0.02;

  updateBursts(dt);
  updateFlow(dt);
  cardAlpha += ((cardShown ? 1 : 0) - cardAlpha) * Math.min(1, dt * 12);
  if (cardAlpha < 0.02) cardSprite.visible = false;
  else {
    cardSprite.visible = true;
    cardSprite.material.opacity = cardAlpha;
    const k = 0.86 + 0.14 * cardAlpha;
    cardSprite.scale.set(cardBase.x * k, cardBase.y * k, 1);
  }

  // 飞近星团时分类标题淡出，避免巨型标题糊在眼前
  for (let ci = 0; ci < clusterInfo.length; ci++) {
    const c = clusterInfo[ci];
    if (!c.titleSpr) continue;
    const d = camera.position.distanceTo(c.center);
    c.titleSpr.material.opacity = Math.max(0, Math.min(1, (d - 20) / 26));
  }
  // 空态提示常驻，不折叠
  for (const cl of urlClusters) {
    if (cl.emptySpr) cl.emptySpr.visible = cl.count === 0;
  }

  // 星海呼吸与缓转
  starsFar.material.opacity  = 0.80 + 0.18 * Math.sin(t * 1.2);
  starsNear.material.opacity = 0.40 + 0.16 * Math.sin(t * 2.0 + 1.0);
  starsFar.rotation.y  += dt * 0.004;
  starsNear.rotation.y -= dt * 0.002;
  nebulaGroup.rotation.y += dt * 0.006;
  armillary.rotation.y += dt * 0.01;
  updateMeteors(dt);
  updateWhere(dt);

  renderer.render(scene, camera);
  updateReticle();
  updateAnchors();
}

// 分类锚点卡随 3D 投影移动；选中 / 拖动某个球时其他球也不折叠
const anchorProj = new THREE.Vector3();
function updateAnchors() {
  if (!entered) return;
  const show = !searchOpen && !helpOpen;
  for (let ci = 0; ci < clusterInfo.length; ci++) {
    const c = clusterInfo[ci];
    if (!c.anchorEl) continue;
    let ok = show;
    let x = 0, y = 0, clamped = false;
    if (ok) {
      anchorProj.copy(c.center);
      anchorProj.y += 18;
      anchorProj.project(camera);
      x = (anchorProj.x * 0.5 + 0.5) * window.innerWidth;
      y = (-anchorProj.y * 0.5 + 0.5) * window.innerHeight;
      ok = anchorProj.z <= 1;
      if (ok) {
        // 透视下边缘分类会跑出视野：收拢到屏幕内并淡化，保证 12 类都可见可点
        if (x < 62) { x = 62; clamped = true; }
        if (x > window.innerWidth - 62) { x = window.innerWidth - 62; clamped = true; }
        if (y < 92) { y = 92; clamped = true; }
        if (y > window.innerHeight - 92) { y = window.innerHeight - 92; clamped = true; }
      }
    }
    c.anchorEl.style.opacity = ok ? (clamped ? '0.32' : '0.72') : '0';
    c.anchorEl.style.pointerEvents = ok ? 'auto' : 'none';
    if (ok) { c.anchorEl.style.left = x + 'px'; c.anchorEl.style.top = y + 'px'; }
  }
}

// 命中的书卷会把准星「吸」到自己的屏幕中心，明确点的是哪一本
function updateReticle() {
  if (hoveredIdx >= 0 && bookSprites[hoveredIdx]) {
    const p = bookSprites[hoveredIdx].position.clone().project(camera);
    reticle.style.left = ((p.x * 0.5 + 0.5) * window.innerWidth) + 'px';
    reticle.style.top = ((-p.y * 0.5 + 0.5) * window.innerHeight) + 'px';
  } else {
    reticle.style.left = mouseX + 'px';
    reticle.style.top = mouseY + 'px';
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 与 2D 站双向同步：另一页面/标签页改动记录时即时刷新星团
window.addEventListener('storage', (e) => {
  if (!bookSprites.length) return;
  if (e.key === RECENT_KEY) refreshCluster(recents);
  else if (e.key === FAV_KEY) { reloadFavs(); refreshCluster(favs); }
  else return;
  buildCatRail();
  whereCi = -2;
});

// ---------- 启动 ----------
async function boot() {
  try {
    const data = await NAV_PROMISE;
    const nav = (data.navigation || []).filter((c) => collectItems(c).length);
    if (!nav.length) throw new Error('nav.json 为空');
    const a = faceFromTo(HOME_POS, new THREE.Vector3(0, 4, 0));
    yaw = tYaw = a.yaw; pitch = tPitch = a.pitch;
    camera.quaternion.setFromEuler(euler.set(pitch, yaw, 0, 'YXZ'));
    // 入场推镜：星海在遮罩后就从远处缓缓推近
    camera.position.copy(PUSH_START);
    camTarget.copy(HOME_POS);
    introPush = 1;
    animate();                       // 星空先动起来，不等书卷
    clusterCenters = computeClusterCenters(nav.length);
    for (let i = 0; i < nav.length; i++) {
      buildCategoryAt(nav[i], i, nav.length);
      loadingEl.textContent = '正在铺展星海… ' + (i + 1) + '/' + nav.length;
      if (i % 2 === 1) await new Promise((r) => setTimeout(r, 0));
    }
    finishSky();
    buildCatRail();
    applyHash();               // 支持 #cat-N / #site-<URL> 直达（兼容旧 #book-N）
    const totalText = (clusterInfo.length - urlClusters.length) + ' 类 · ' + bookByUrl.size + ' 站点';
    if (introTotal) introTotal.textContent = '集思阁 · ' + totalText;
    overviewEl.textContent = totalText;
    loadingEl.textContent = '星海已列';
    enterBtn.disabled = false;
    started = true;
    // 当首页：星海列毕后自动入阁，不必多点一次
    setTimeout(enterNow, 1200);
  } catch (err) {
    console.error(err);
    loadingEl.textContent = '天书未显：' + err.message;
    enterBtn.textContent = '无 法 进 入';
  }
}
boot();

