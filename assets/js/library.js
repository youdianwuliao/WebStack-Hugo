import * as THREE from '../three/three.module.min.js';

/* ============================================================
 * 集思阁 · 天书 —— 星图式三维导航
 * 数据共用 nav.json，与 2D 站完全独立、互不影响。
 *   · 阻尼相机：所有位移与转向都平滑过渡，不再瞬移
 *   · 分类直达栏 + 当前位置：永远知道自己在哪、随时归位
 *   · 浑天仪坐标环、流星、星闪、星云：更耐看的星海
 *   · 悬停：书卷放大、光晕浮起、名牌展开全名与简介（默认仅一字）
 *   · 最近访问：本地留存，独立星团
 * ============================================================ */

const NAV_URL = 'nav.json';
const RECENT_KEY = 'tianshuRecents';
const RECENT_SLOTS = 12;
const RECENTS_CENTER = new THREE.Vector3(0, 12, 64);

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const canvas      = $('scene');
const reticle     = $('reticle');
const hintEl      = $('hint');
const introOv     = $('overlay-intro');
const pauseOv     = $('overlay-pause');
const unsupported = $('unsupported');
const enterBtn    = $('enter');
const muteBtn     = $('mute');
const loadingEl   = $('loading');
const catrailEl   = $('catrail');
const whereEl     = $('where');

canvas.style.touchAction = 'none';

const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
  || navigator.maxTouchPoints > 0;
if (isTouch) {
  introOv.classList.add('hidden');
  unsupported.style.display = 'flex';
  throw new Error('touch device: skip 3D');
}

// ---------- 渲染器 / 场景 / 相机 ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04050b);
scene.fog = new THREE.FogExp2(0x04050b, 0.0032);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 1800);
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const HOME_POS = new THREE.Vector3(0, 26, 152);
camera.position.copy(HOME_POS);

// ---------- 通用贴图工具 ----------
const CN = '"PingFang SC","Microsoft YaHei","Kaiti SC",serif';
function clipText(s, n) {
  s = (s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n) + '…' : s;
}
function radialTexture(stops, size) {
  size = size || 256;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach((s) => grd.addColorStop(s[0], s[1]));
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
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
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
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

// ---------- 流星 ----------
const meteors = [];
function createMeteor() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const m = new THREE.LineBasicMaterial({ color: 0xd6e4ff, transparent: true, opacity: 0,
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
      const tail = m.head.clone().addScaledVector(m.dir, -m.len);
      p[0] = m.head.x; p[1] = m.head.y; p[2] = m.head.z;
      p[3] = tail.x;  p[4] = tail.y;  p[5] = tail.z;
      m.line.geometry.attributes.position.needsUpdate = true;
      m.head.addScaledVector(m.dir, m.speed * dt);
      m.line.material.opacity = 0.75 * Math.min(1, Math.max(0, m.life * 2.6));
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
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold ' + fs + 'px ' + CN;
  g.shadowColor = 'rgba(255,200,120,0.9)'; g.shadowBlur = 26;
  g.fillStyle = 'rgba(255,214,140,0.96)';
  g.fillText(name, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.aspect = w / h;
  return t;
}
// 中枢地标
const hubTex = makeTitleTexture('集思阁 · 天书', 760, 150, 66);
const hub = new THREE.Sprite(new THREE.SpriteMaterial({ map: hubTex, transparent: true, depthWrite: false, fog: false }));
hub.position.set(0, 52, 0);
hub.scale.set(46, 46 / hubTex.aspect, 1);
scene.add(hub);

// ---------- 书卷贴图 ----------
function makeIconTexture(ch, color) {
  const s = 256;
  const c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  const r = (color.r * 255) | 0, gg = (color.g * 255) | 0, b = (color.b * 255) | 0;
  const hex = '#' + color.getHexString();
  const grd = g.createRadialGradient(s / 2, s / 2, 8, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(' + r + ',' + gg + ',' + b + ',0.34)');
  grd.addColorStop(0.6, 'rgba(' + r + ',' + gg + ',' + b + ',0.10)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  g.strokeStyle = hex; g.lineWidth = 10; g.shadowColor = hex; g.shadowBlur = 24;
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
  g.shadowColor = hex; g.shadowBlur = 14;
  g.fillText(ch, s / 2, s / 2 + 6);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// 悬停名牌：默认只一个字，悬停后全名 + 简介 + 操作提示都展开
function makeCardTexture(title, desc, hex, hint) {
  const fsT = 40, fsD = 23, fsH = 19, pad = 20, gap = 9;
  const ttl = clipText(title || '未命名', 22);
  const dtxt = clipText(desc, 28);
  const m = document.createElement('canvas').getContext('2d');
  m.font = 'bold ' + fsT + 'px ' + CN;
  const tw = Math.min(m.measureText(ttl).width, 700);
  m.font = fsD + 'px ' + CN;
  const dw = dtxt ? Math.min(m.measureText(dtxt).width, 700) : 0;
  const w = Math.ceil(Math.max(tw, dw, 200) + pad * 2);
  const hy = pad + fsT + (dtxt ? fsD + gap : 0) + gap + fsH / 2;
  const h = Math.ceil(hy + fsH / 2 + pad);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(8,10,22,0.88)';
  roundRect(g, 2, 2, w - 4, h - 4, 16); g.fill();
  g.strokeStyle = hex; g.lineWidth = 2.5; g.shadowColor = hex; g.shadowBlur = 16;
  roundRect(g, 2, 2, w - 4, h - 4, 16); g.stroke(); g.shadowBlur = 0;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#ffe6b4'; g.font = 'bold ' + fsT + 'px ' + CN;
  g.shadowColor = hex; g.shadowBlur = 10;
  g.fillText(ttl, w / 2, pad + fsT / 2); g.shadowBlur = 0;
  if (dtxt) {
    g.fillStyle = 'rgba(233,220,195,0.8)'; g.font = fsD + 'px ' + CN;
    g.fillText(dtxt, w / 2, pad + fsT + gap + fsD / 2);
  }
  g.fillStyle = 'rgba(255,214,140,0.92)'; g.font = fsH + 'px ' + CN;
  g.fillText(hint, w / 2, hy);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.aspect = w / h;
  return t;
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
const cardBase = new THREE.Vector2(1, 1);
let cardAlpha = 0, cardShown = false, cardKey = '';

// ---------- 数据 ----------
let bookSprites = [], bookData = [], bookColor = [], bookCluster = [], clusterInfo = [], searchIndex = [];
let hoveredIdx = -1, pendingOpen = -1;
const driftData = [];
const baseScale = new THREE.Vector2(2.7, 2.7);
const HOVER_SCALE = 1.45;
const OPEN_DIST = 15;
const CARD_OFFSET = 3.9;

let RECENT_CI = -1, recentBaseIdx = 0;
const recentOrder = [];
const recentSlotUrl = new Array(RECENT_SLOTS).fill('');
const recentByUrl = new Map();
let recentTitleSpr = null;

function catColor(i, n) {
  return new THREE.Color().setHSL((i * 0.13 + 0.05) % 1, 0.65, 0.62);
}

function buildSky(nav) {
  const cats = nav.filter((c) => c.items && c.items.length);
  const n = cats.length;
  const perRow = Math.ceil(Math.sqrt(n));
  const spacing = 46;

  cats.forEach((cat, ci) => {
    const cx = (ci % perRow - (perRow - 1) / 2) * spacing;
    const cz = (Math.floor(ci / perRow) - (Math.ceil(n / perRow) - 1) / 2) * spacing;
    const cy = Math.sin(ci * 1.3) * 10;
    const center = new THREE.Vector3(cx, cy, cz);
    const col = catColor(ci, n);

    const tt = makeTitleTexture('「' + cat.category + '」');
    const titleSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tt, transparent: true, depthWrite: false, fog: false }));
    titleSpr.scale.set(15, 15 / tt.aspect, 1);
    titleSpr.position.copy(center).add(new THREE.Vector3(0, 14, 0));
    scene.add(titleSpr);

    const items = cat.items;
    const k = items.length;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const pts = [];
    for (let j = 0; j < k; j++) {
      const yy = k > 1 ? 1 - (j / (k - 1)) * 2 : 0;
      const rad = Math.sqrt(Math.max(0, 1 - yy * yy));
      const theta = golden * j;
      const dir = new THREE.Vector3(Math.cos(theta) * rad, yy, Math.sin(theta) * rad);
      const R = 11 + Math.random() * 5;
      pts.push(center.clone().add(dir.multiplyScalar(R)));
    }
    const minDist = 4.8;
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
    const linePts = [];
    items.forEach((it, j) => {
      const p = pts[j].clone();
      if (p.y > center.y + 9) p.y = center.y + 6;
      const ch = (it.title || '·').trim().charAt(0) || '·';
      const tex = makeIconTexture(ch, col);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      spr.scale.set(baseScale.x, baseScale.y, 1);
      spr.position.copy(p);
      spr.userData.idx = bookData.length;
      scene.add(spr);
      bookSprites.push(spr);
      bookData.push({ url: it.url, title: it.title || '', desc: it.description || '' });
      bookColor.push(col.clone());
      bookCluster.push(ci);
      driftData.push({ base: p.clone(), phase: Math.random() * Math.PI * 2,
        amp: 0.2 + Math.random() * 0.3, speed: 0.2 + Math.random() * 0.3 });
      linePts.push(center.x, center.y, center.z, p.x, p.y, p.z);
    });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePts), 3));
    scene.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({
      color: col, transparent: true, opacity: 0.16, depthWrite: false, fog: false
    })));
    clusterInfo.push({ name: cat.category, center: center.clone() });
  });

  RECENT_CI = clusterInfo.length;
  clusterInfo.push({ name: '最近访问', center: RECENTS_CENTER.clone() });
  recentBaseIdx = bookData.length;
  for (let s = 0; s < RECENT_SLOTS; s++) {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
    spr.visible = false; spr.userData.idx = bookData.length;
    scene.add(spr);
    bookSprites.push(spr);
    bookData.push({ url: '', title: '', desc: '' });
    bookColor.push(new THREE.Color(0xffffff));
    bookCluster.push(RECENT_CI);
    driftData.push({ base: RECENTS_CENTER.clone(), phase: Math.random() * 6.28, amp: 0.15, speed: 0.3 });
    recentSlotUrl[s] = '';
  }
  loadRecents();

  searchIndex = [];
  clusterInfo.forEach((c, ci) => searchIndex.push({ type: 'cat', name: c.name, cluster: ci }));
  bookData.forEach((d, i) => {
    if (d && d.url) searchIndex.push({ type: 'item', title: d.title, desc: d.desc, url: d.url, inst: i });
  });
}

// ---------- 最近访问 ----------
function placeRecent(url, title, colorHex) {
  if (!url) return;
  let slot;
  if (recentByUrl.has(url)) {
    slot = recentByUrl.get(url);
  } else {
    slot = recentSlotUrl.indexOf('');
    if (slot === -1) {
      slot = recentOrder[recentOrder.length - 1];
      const old = recentSlotUrl[slot];
      if (old) recentByUrl.delete(old);
      recentSlotUrl[slot] = '';
      bookSprites[recentBaseIdx + slot].visible = false;
    }
  }
  recentSlotUrl[slot] = url;
  recentByUrl.set(url, slot);
  const idx = recentBaseIdx + slot;
  bookData[idx] = { url, title: title || '', desc: '' };
  bookColor[idx].set(colorHex);
  const spr = bookSprites[idx];
  if (spr.material.map) spr.material.map.dispose();
  spr.material.map = makeIconTexture((title || '·').trim().charAt(0) || '·', bookColor[idx]);
  spr.material.needsUpdate = true;
  spr.visible = true;
  spr.scale.set(baseScale.x, baseScale.y, 1);
  const oi = recentOrder.indexOf(slot);
  if (oi >= 0) recentOrder.splice(oi, 1);
  recentOrder.unshift(slot);
}
function relayoutRecents() {
  const k = recentOrder.length;
  if (!recentTitleSpr) {
    const t = makeTitleTexture('「最近访问」');
    recentTitleSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
    recentTitleSpr.scale.set(15, 15 / t.aspect, 1);
    recentTitleSpr.position.copy(RECENTS_CENTER).add(new THREE.Vector3(0, 13, 0));
    scene.add(recentTitleSpr);
  }
  recentTitleSpr.visible = k > 0;
  if (k === 0) { hoveredIdx = -1; cardShown = false; return; }
  const golden = Math.PI * (3 - Math.sqrt(5));
  const R = 8 + Math.min(4, k * 0.3);
  for (let i = 0; i < k; i++) {
    const slot = recentOrder[i];
    const yy = k > 1 ? 1 - (i / (k - 1)) * 2 : 0;
    const rad = Math.sqrt(Math.max(0, 1 - yy * yy));
    const theta = golden * i;
    const dir = new THREE.Vector3(Math.cos(theta) * rad, yy, Math.sin(theta) * rad);
    const p = RECENTS_CENTER.clone().add(dir.multiplyScalar(R));
    if (p.y > RECENTS_CENTER.y + 9) p.y = RECENTS_CENTER.y + 6;
    bookSprites[recentBaseIdx + slot].position.copy(p);
    driftData[recentBaseIdx + slot].base = p.clone();
  }
  hoveredIdx = -1; cardShown = false;
}
function saveRecents() {
  const arr = recentOrder.map((slot) => ({
    url: recentSlotUrl[slot], title: bookData[recentBaseIdx + slot].title,
    color: '#' + bookColor[recentBaseIdx + slot].getHexString()
  }));
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(arr)); } catch (e) {}
}
function loadRecents() {
  let arr = [];
  try { arr = JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch (e) {}
  (arr || []).slice(0, RECENT_SLOTS).forEach((r) => {
    if (r && r.url) placeRecent(r.url, r.title, r.color || '#ffffff');
  });
  relayoutRecents();
}
function addRecent(inst) {
  const d = bookData[inst];
  if (!d || !d.url) return;
  placeRecent(d.url, d.title, '#' + bookColor[inst].getHexString());
  relayoutRecents();
  saveRecents();
  buildCatRail();
  whereCi = -2;
}

// ---------- 控制：拖拽环顾 + 阻尼飞行 ----------
const keys = Object.create(null);
let yaw = 0, pitch = 0;
let tYaw = 0, tPitch = 0;
let gliding = false;
let started = false;
const camTarget = HOME_POS.clone();
let walkRemaining = 0;
let hintTimer = 0;
const STEP = 10, WALK_CLAMP = 50, MOVE_SPEED = 11.0, MAX_R = 520;
const POS_LERP = 8.5, ANG_LERP = 6.0;
let mouseNDC = new THREE.Vector2(0, 0);
let pointerActive = false, dragMoved = false, downX = 0, downY = 0;

function onKey(e, down) {
  const k = e.code;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'ShiftLeft', 'ShiftRight'].includes(k)) keys[k] = down;
}
document.addEventListener('keydown', (e) => { if (!searchOpen) onKey(e, true); });
document.addEventListener('keyup', (e) => onKey(e, false));

function updateHint() {
  if (!hintEl) return;
  hintEl.style.opacity = (started && !searchOpen && hintTimer < 8) ? '1' : '0';
}
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || searchOpen) return;
  pointerActive = true; dragMoved = false; downX = e.clientX; downY = e.clientY;
});
window.addEventListener('pointermove', (e) => {
  mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  if (!pointerActive || searchOpen) return;
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) dragMoved = true;
  yaw   -= (e.movementX || 0) * 0.0024;
  pitch -= (e.movementY || 0) * 0.0024;
  pitch = Math.max(-1.4, Math.min(1.4, pitch));
  gliding = false;
});
window.addEventListener('pointerup', () => {
  if (!pointerActive) return;
  pointerActive = false;
  if (dragMoved || searchOpen) return;
  updatePick(true);
  if (hoveredIdx >= 0) {
    const bp = bookSprites[hoveredIdx].position;
    if (camera.position.distanceTo(bp) <= OPEN_DIST) openBook(hoveredIdx);
    else teleportToBook(hoveredIdx);
  } else {
    walkRemaining = Math.max(-WALK_CLAMP, Math.min(WALK_CLAMP, walkRemaining + STEP));
  }
});
window.addEventListener('wheel', (e) => {
  if (!started || searchOpen) return;
  e.preventDefault();
  const f = new THREE.Vector3();
  camera.getWorldDirection(f);
  camTarget.addScaledVector(f, -e.deltaY * 0.13);
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
  tPitch = Math.max(-1.4, Math.min(1.4, a.pitch));
  gliding = true;
}
function goHome() {
  pendingOpen = -1;
  glideTo(HOME_POS.clone(), new THREE.Vector3(0, 4, 0));
  mouseNDC.set(0, 0);
  hoveredIdx = -1;
  cardShown = false;
}

enterBtn.addEventListener('click', () => {
  if (!started) return;
  introOv.classList.add('hidden');
  muteBtn.style.display = 'block';
  searchBtn.style.display = 'block';
  reticle.classList.add('active');
  catrailEl.classList.add('show');
  whereEl.classList.add('show');
  startAudio();
  hintTimer = 0;
  updateHint();
});

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
  }
  if (hoveredIdx >= 0) {
    const d = bookData[hoveredIdx];
    const col = bookColor[hoveredIdx];
    const bp = bookSprites[hoveredIdx].position;
    const dist = camera.position.distanceTo(bp);
    const twoStep = (pendingOpen === hoveredIdx || dist > OPEN_DIST);
    const key = hoveredIdx + '|' + (twoStep ? '再' : '开');
    if (cardKey !== key) {
      cardKey = key;
      const t = makeCardTexture(d.title, d.desc, '#' + col.getHexString(),
        twoStep ? '再次单击 · 展卷' : '单击 · 展卷');
      if (cardSprite.material.map) cardSprite.material.map.dispose();
      cardSprite.material.map = t;
      cardSprite.material.needsUpdate = true;
      const sh = 1.8;
      cardBase.set(sh * t.aspect, sh);
      cardSprite.scale.copy(cardBase);
    }
    cardSprite.position.set(bp.x, bp.y - CARD_OFFSET, bp.z);
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
    window.open(d.url, '_blank', 'noopener');
    addRecent(idx);
  }
}

// ---------- 环境音 ----------
let audioCtx = null, audioGain = null, audioOn = false;
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
    if (c.name === '最近访问' && recentOrder.length === 0) return;
    const b = document.createElement('button');
    b.className = 'cr-chip';
    b.textContent = c.name;
    b.dataset.ci = ci;
    b.addEventListener('click', (e) => { e.stopPropagation(); teleportToCluster(ci); });
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
let searchOpen = false;
function escHtml(s) {
  return (s || '').replace(/[&<>^"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function openSearch() {
  if (!started) return;
  searchOpen = true;
  hoveredIdx = -1; cardShown = false;
  pauseOv.classList.add('hidden');
  searchOv.classList.remove('hidden');
  updateHint();
  searchInput.value = '';
  renderSearch();
  setTimeout(() => searchInput.focus(), 30);
}
function closeSearch() {
  searchOpen = false;
  searchOv.classList.add('hidden');
  updateHint();
}
function renderSearch() {
  const q = searchInput.value.trim().toLowerCase();
  let list = searchIndex;
  if (q) {
    list = searchIndex.filter((r) =>
      (r.name && r.name.toLowerCase().includes(q)) ||
      (r.title && r.title.toLowerCase().includes(q)) ||
      (r.desc && r.desc.toLowerCase().includes(q)) ||
      (r.url && r.url.toLowerCase().includes(q))
    );
  }
  list = list.slice(0, 40);
  searchResults.innerHTML = '';
  if (!list.length) { searchResults.innerHTML = '<div class="rd" style="opacity:.5">无匹配</div>'; return; }
  for (const r of list) {
    const div = document.createElement('div');
    div.className = 'res';
    if (r.type === 'cat') {
      div.innerHTML = '<div class="rt">' + escHtml(r.name) + '<span class="rk">分类</span></div><div class="rd">飞至此分类星团</div>';
    } else {
      div.innerHTML = '<div class="rt">' + escHtml(r.title) + '<span class="rk">网站</span></div><div class="rd">' + escHtml(r.desc || '') + '</div>';
    }
    div.addEventListener('click', () => goToResult(r));
    searchResults.appendChild(div);
  }
}
function goToResult(r) {
  if (r.type === 'cat') teleportToCluster(r.cluster);
  else teleportToBook(r.inst);
  closeSearch();
}
function teleportToCluster(ci) {
  const c = clusterInfo[ci];
  const dir = c.center.clone();
  if (dir.lengthSq() < 1) dir.set(0, 0, 1);
  dir.normalize();
  const pos = c.center.clone().addScaledVector(dir, 24);
  pos.y += 5;
  glideTo(pos, c.center);
  pendingOpen = -1;
  mouseNDC.set(0, 0);
  hoveredIdx = -1;
  cardShown = false;
}
function teleportToBook(inst) {
  const ci = bookCluster[inst];
  const c = clusterInfo[ci];
  const bp = bookSprites[inst].position.clone();
  const out = bp.clone().sub(c.center);
  if (out.lengthSq() < 1) out.set(0, 0, 1);
  out.normalize();
  const pos = bp.clone().addScaledVector(out, 10);
  pos.y += 1.5;
  glideTo(pos, bp);
  mouseNDC.set(0, 0);
  pendingOpen = inst;
  hoveredIdx = -1;
  cardShown = false;
}
searchBtn.addEventListener('click', openSearch);
searchClose.addEventListener('click', closeSearch);
searchInput.addEventListener('input', renderSearch);
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && started && !searchOpen) { e.preventDefault(); openSearch(); }
  else if (e.key === 'Escape' && searchOpen) { closeSearch(); }
  else if ((e.key === 'Home' || e.key === 'h' || e.key === 'H') && started && !searchOpen) { goHome(); }
});

// ---------- 主循环 ----------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (started && !searchOpen) {
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
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
    updatePick();
    if (hintTimer < 8) {
      hintTimer += dt;
      if (hintTimer >= 8) hintEl.style.opacity = '0';
    }
  }

  // 阻尼相机：位置追随 + 自动转向
  camera.position.lerp(camTarget, 1 - Math.exp(-POS_LERP * dt));
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

  // 书卷漂浮 + 微光呼吸
  for (let i = 0; i < bookSprites.length; i++) {
    const d = driftData[i];
    bookSprites[i].position.set(
      d.base.x + Math.sin(t * d.speed + d.phase) * d.amp,
      d.base.y + Math.cos(t * d.speed * 0.8 + d.phase) * d.amp,
      d.base.z + Math.sin(t * d.speed * 1.1 + d.phase) * d.amp * 0.6
    );
    if (i !== hoveredIdx) {
      bookSprites[i].material.opacity = 0.9 + 0.1 * Math.sin(t * 1.5 + d.phase);
      bookSprites[i].scale.set(baseScale.x, baseScale.y, 1);
    }
  }

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
    cardSprite.position.set(bp.x, bp.y - CARD_OFFSET, bp.z);
  } else {
    halo.material.opacity += (0 - halo.material.opacity) * Math.min(1, dt * 10);
  }
  halo.visible = halo.material.opacity > 0.02;
  cardAlpha += ((cardShown ? 1 : 0) - cardAlpha) * Math.min(1, dt * 12);
  if (cardAlpha < 0.02) cardSprite.visible = false;
  else {
    cardSprite.visible = true;
    cardSprite.material.opacity = cardAlpha;
    cardSprite.scale.copy(cardBase).multiplyScalar(0.86 + 0.14 * cardAlpha);
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
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- 启动 ----------
async function boot() {
  try {
    const res = await fetch(NAV_URL, { cache: 'no-cache' });
    const data = await res.json();
    const nav = (data.navigation || []).filter((c) => c.items && c.items.length);
    if (!nav.length) throw new Error('nav.json 为空');
    buildSky(nav);
    buildCatRail();
    const a = faceFromTo(HOME_POS, new THREE.Vector3(0, 4, 0));
    yaw = tYaw = a.yaw; pitch = tPitch = a.pitch;
    camera.quaternion.setFromEuler(euler.set(pitch, yaw, 0, 'YXZ'));
    loadingEl.textContent = '星海已列';
    enterBtn.disabled = false;
    started = true;
    animate();
  } catch (err) {
    console.error(err);
    loadingEl.textContent = '天书未显：' + err.message;
    enterBtn.textContent = '无 法 进 入';
  }
}
boot();

