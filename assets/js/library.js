import * as THREE from '../three/three.module.min.js';

/* ============================================================
 * 集思阁 · 天书  (书卷悬浮于虚空，可飞览、可搜索；含「最近访问」)
 * 数据共用 nav.json，与 2D 站完全独立、互不影响。
 * ============================================================ */

const NAV_URL = 'nav.json';
const RECENT_KEY = 'tianshuRecents';
const RECENT_SLOTS = 12;
const RECENTS_CENTER = new THREE.Vector3(0, 12, 64);

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const canvas      = $('scene');
const reticle     = $('reticle');
const infoEl      = $('info');
const infoTitle   = infoEl.querySelector('.t');
const infoDesc    = infoEl.querySelector('.d');
const infoGo      = infoEl.querySelector('.go');
const hintEl      = $('hint');
const introOv     = $('overlay-intro');
const pauseOv     = $('overlay-pause');
const unsupported = $('unsupported');
const enterBtn    = $('enter');
const resumeBtn   = $('resume');
const muteBtn     = $('mute');
const loadingEl   = $('loading');

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
scene.fog = new THREE.FogExp2(0x04050b, 0.0038);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 1600);
camera.position.set(0, 8, 96);

// ---------- 渐变天穹 ----------
function makeSky() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0.0, '#0c0a22');
  grd.addColorStop(0.45, '#0a0918');
  grd.addColorStop(1.0, '#04030a');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 512);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, fog: false });
  return new THREE.Mesh(new THREE.SphereGeometry(1100, 32, 16), mat);
}
scene.add(makeSky());

// ---------- 星空 ----------
function makeStars(count, size, opacity) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const r = 350 + Math.random() * 900;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i*3]   = r * Math.sin(ph) * Math.cos(th);
    pos[i*3+1] = r * Math.cos(ph);
    pos[i*3+2] = r * Math.sin(ph) * Math.sin(th);
    c.setHSL(0.58 + Math.random() * 0.16, 0.55, 0.55 + Math.random() * 0.4);
    col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, opacity, depthWrite: false });
  m.fog = false;
  return new THREE.Points(g, m);
}
const starsFar  = makeStars(2200, 1.3, 0.95);
const starsNear = makeStars(600, 2.8, 0.5);
scene.add(starsFar, starsNear);

// ---------- 星云 + 远处光核 ----------
const nebulaGroup = new THREE.Group();
scene.add(nebulaGroup);
function makeGlow(hex, alpha) {
  const s = 256;
  const c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
  grd.addColorStop(0, hex);
  grd.addColorStop(0.4, hex.replace(/,[0-9.]+\)$/, ',' + (alpha * 0.4) + ')'));
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  return new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
}
const nebDefs = [
  ['rgba(120,90,220,0.55)', 520, 420],
  ['rgba(40,140,180,0.5)', 640, 520],
  ['rgba(180,80,200,0.45)', 470, 380],
  ['rgba(70,110,200,0.5)', 760, 600],
  ['rgba(200,120,90,0.35)', 560, 460],
  ['rgba(90,200,170,0.4)', 680, 540]
];
nebDefs.forEach((d, i) => {
  const n = makeGlow(d[0], 0.5);
  const ang = i * 1.05 + 0.4;
  const R = 560;
  n.position.set(Math.cos(ang) * R, (i - 2.5) * 110, Math.sin(ang) * R - 160);
  n.scale.set(d[2], d[2], 1);
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

// ---------- 书卷（图标勋章）----------
let bookSprites = [];
let bookData = [];
let bookColor = [];
let bookCluster = [];
let clusterInfo = [];
let searchIndex = [];
let hoveredIdx = -1;
let pendingOpen = -1;
const driftData = [];
const baseScale = new THREE.Vector2(2.7, 2.7);
const HOVER_SCALE = 1.4;
const OPEN_DIST = 14;

// 悬停标签（图标下方浮出文字）
const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
labelSprite.visible = false; labelSprite.renderOrder = 1000;
scene.add(labelSprite);
const labelBaseScale = new THREE.Vector2(1, 1);
let labelAlpha = 0, labelShown = false, labelText = '';

// 最近访问（保留固定槽位，避免改动其它索引）
let RECENT_CI = -1, recentBaseIdx = 0;
const recentOrder = [];            // 槽位下标，最近在前
const recentSlotUrl = new Array(RECENT_SLOTS).fill('');
const recentByUrl = new Map();
let recentTitleSpr = null;

function catColor(i, n) {
  return new THREE.Color().setHSL((i * 0.13 + 0.05) % 1, 0.65, 0.62);
}

function buildSky(nav) {
  const cats = nav.filter(c => c.items && c.items.length);
  const n = cats.length;
  const perRow = Math.ceil(Math.sqrt(n));
  const spacing = 42;

  cats.forEach((cat, ci) => {
    const cx = (ci % perRow - (perRow - 1) / 2) * spacing;
    const cz = (Math.floor(ci / perRow) - (Math.ceil(n / perRow) - 1) / 2) * spacing;
    const cy = Math.sin(ci * 1.3) * 11;
    const center = new THREE.Vector3(cx, cy, cz);
    const col = catColor(ci, n);

    const titleTex = makeTitleTexture(cat.category);
    const titleSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: titleTex, transparent: true, depthWrite: false }));
    titleSpr.scale.set(13, 3.2, 1);
    titleSpr.position.copy(center).add(new THREE.Vector3(0, 13, 0));
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
    const minDist = 4.6;
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
      driftData.push({ base: p.clone(), phase: Math.random() * Math.PI * 2, amp: 0.2 + Math.random() * 0.3, speed: 0.2 + Math.random() * 0.3 });
      linePts.push(center.x, center.y, center.z, p.x, p.y, p.z);
    });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePts), 3));
    const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.07, depthWrite: false }));
    scene.add(lines);
    clusterInfo.push({ name: cat.category, center: center.clone() });
  });

  // 预留「最近访问」槽位
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

// ---------- 最近访问：存取与布局 ----------
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
    recentTitleSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeTitleTexture('最近访问'), transparent: true, depthWrite: false }));
    recentTitleSpr.scale.set(13, 3.2, 1);
    recentTitleSpr.position.copy(RECENTS_CENTER).add(new THREE.Vector3(0, 13, 0));
    scene.add(recentTitleSpr);
  }
  recentTitleSpr.visible = k > 0;
  if (k === 0) { hoveredIdx = -1; labelShown = false; return; }
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
    const spr = bookSprites[recentBaseIdx + slot];
    spr.position.copy(p);
    driftData[recentBaseIdx + slot].base = p.clone();
  }
  hoveredIdx = -1; labelShown = false;
}
function saveRecents() {
  const arr = recentOrder.map(slot => ({ url: recentSlotUrl[slot], title: bookData[recentBaseIdx + slot].title, color: '#' + bookColor[recentBaseIdx + slot].getHexString() }));
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(arr)); } catch (e) {}
}
function loadRecents() {
  let arr = [];
  try { arr = JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch (e) {}
  (arr || []).slice(0, RECENT_SLOTS).forEach(r => { if (r && r.url) placeRecent(r.url, r.title, r.color || '#ffffff'); });
  relayoutRecents();
}
function addRecent(inst) {
  const d = bookData[inst];
  if (!d || !d.url) return;
  placeRecent(d.url, d.title, '#' + bookColor[inst].getHexString());
  relayoutRecents();
  saveRecents();
}

// ---------- 控制：拖拽环顾（像平板/触控，光标常驻，悬停显名）----------
const keys = Object.create(null);
let yaw = 0, pitch = 0;
let started = false;
let walkRemaining = 0;
const STEP = 10, WALK_CLAMP = 50, MOVE_SPEED = 10.0, MAX_R = 500;
let mouseNDC = new THREE.Vector2(0, 0);
let pointerActive = false, dragMoved = false, downX = 0, downY = 0;

function onKey(e, down) {
  const k = e.code;
  if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(k)) keys[k] = down;
}
document.addEventListener('keydown', (e) => { if (!searchOpen) onKey(e, true); });
document.addEventListener('keyup',   (e) => onKey(e, false));

function updateHint() {
  if (!hintEl) return;
  hintEl.style.opacity = (started && !searchOpen) ? '1' : '0';
}
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || searchOpen) return;
  pointerActive = true; dragMoved = false; downX = e.clientX; downY = e.clientY;
});
window.addEventListener('pointermove', (e) => {
  // 光标位置用于悬停拾取
  mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  if (!pointerActive) return;
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) dragMoved = true;
  yaw   -= (e.movementX || 0) * 0.0024;
  pitch -= (e.movementY || 0) * 0.0024;
  pitch = Math.max(-1.4, Math.min(1.4, pitch));
});
window.addEventListener('pointerup', () => {
  if (!pointerActive) return;
  pointerActive = false;
  if (dragMoved) return;   // 拖拽=环顾，松手即停，不触发点击
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
  camera.position.addScaledVector(f, -e.deltaY * 0.12);
  clampPos();
}, { passive: false });

function clampPos() { if (camera.position.length() > MAX_R) camera.position.setLength(MAX_R); }

enterBtn.addEventListener('click', () => {
  if (!started) return;
  introOv.classList.add('hidden');
  muteBtn.style.display = 'block';
  searchBtn.style.display = 'block';
  reticle.classList.add('active');
  startAudio();
  updateHint();
});

// ---------- 拾取（锁定=中心准星；未锁定=鼠标指针）----------
const raycaster = new THREE.Raycaster();
function updatePick(force) {
  if (!bookSprites.length) return;
  raycaster.setFromCamera(mouseNDC, camera);
  const hits = raycaster.intersectObjects(bookSprites, false);
  let nh = -1;
  for (const h of hits) {
    const oi = h.object.userData.idx;
    if (bookSprites[oi].visible && bookData[oi] && bookData[oi].url) { nh = oi; break; }
  }
  if (nh !== hoveredIdx) {
    if (hoveredIdx >= 0 && bookSprites[hoveredIdx]) bookSprites[hoveredIdx].scale.set(baseScale.x, baseScale.y, 1);
    hoveredIdx = nh;
  }
  if (hoveredIdx >= 0) {
    const d = bookData[hoveredIdx];
    const col = bookColor[hoveredIdx];
    const bp = bookSprites[hoveredIdx].position;
    const dist = camera.position.distanceTo(bp);
    infoTitle.textContent = d.title;
    infoDesc.textContent = d.desc;
    infoGo.textContent = (pendingOpen === hoveredIdx || dist > OPEN_DIST) ? '再次单击 · 展卷' : '单击 · 展卷';
    infoEl.classList.add('show');
    reticle.classList.add('hot');
    if (labelText !== d.title) {
      labelText = d.title;
      const t = makeLabelTexture(d.title, col);
      if (labelSprite.material.map) labelSprite.material.map.dispose();
      labelSprite.material.map = t;
      labelSprite.material.needsUpdate = true;
      const sh = 0.85;
      labelBaseScale.set(sh * t.aspect, sh);
      labelSprite.scale.copy(labelBaseScale);
    }
    labelSprite.position.set(bp.x, bp.y - baseScale.y * 1.5 - 0.3, bp.z);
    labelShown = true;
  } else {
    infoEl.classList.remove('show');
    reticle.classList.remove('hot');
    labelShown = false;
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
    audioGain = audioCtx.createGain();
    audioGain.gain.value = 0.05;
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
    if (mv.lengthSq() > 0) { mv.normalize().multiplyScalar(MOVE_SPEED * sprint * dt); camera.position.add(mv); }
    let step = 0;
    if (walkRemaining > 0) step = Math.min(walkRemaining, MOVE_SPEED * dt);
    else if (walkRemaining < 0) step = -Math.min(-walkRemaining, MOVE_SPEED * dt);
    walkRemaining -= step;
    if (step !== 0) camera.position.addScaledVector(fwd, step);
    clampPos();
    updatePick(false);
  }

  for (let i = 0; i < bookSprites.length; i++) {
    const d = driftData[i];
    bookSprites[i].position.set(
      d.base.x + Math.sin(t * d.speed + d.phase) * d.amp,
      d.base.y + Math.cos(t * d.speed * 0.8 + d.phase) * d.amp,
      d.base.z + Math.sin(t * d.speed * 1.1 + d.phase) * d.amp * 0.6
    );
  }
  if (hoveredIdx >= 0 && bookSprites[hoveredIdx]) {
    const p = 1 + 0.05 * Math.sin(t * 6);
    bookSprites[hoveredIdx].scale.set(baseScale.x * HOVER_SCALE * p, baseScale.y * HOVER_SCALE * p, 1);
    const bp = bookSprites[hoveredIdx].position;
    labelSprite.position.set(bp.x, bp.y - baseScale.y * 1.5 - 0.3, bp.z);
  }
  labelAlpha += ((labelShown ? 1 : 0) - labelAlpha) * Math.min(1, dt * 12);
  if (labelAlpha < 0.02) labelSprite.visible = false;
  else { labelSprite.visible = true; labelSprite.material.opacity = labelAlpha; labelSprite.scale.copy(labelBaseScale).multiplyScalar(0.82 + 0.18 * labelAlpha); }

  const e = new THREE.Euler(pitch, yaw, 0, 'YXZ');
  camera.quaternion.setFromEuler(e);
  starsFar.rotation.y  += dt * 0.004;
  starsNear.rotation.y -= dt * 0.002;
  nebulaGroup.rotation.y += dt * 0.006;
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- 贴图工具 ----------
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function makeIconTexture(ch, color) {
  const s = 256;
  const c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  const r = (color.r * 255) | 0, gg = (color.g * 255) | 0, b = (color.b * 255) | 0;
  const grd = g.createRadialGradient(s/2, s/2, 8, s/2, s/2, s/2);
  grd.addColorStop(0, 'rgba(' + r + ',' + gg + ',' + b + ',0.32)');
  grd.addColorStop(0.6, 'rgba(' + r + ',' + gg + ',' + b + ',0.10)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  const hex = '#' + color.getHexString();
  g.strokeStyle = hex; g.lineWidth = 10; g.shadowColor = hex; g.shadowBlur = 22;
  g.beginPath(); g.arc(s/2, s/2, 96, 0, Math.PI * 2); g.stroke();
  g.shadowBlur = 0;
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
  g.beginPath(); g.arc(s/2, s/2, 80, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#f5eede'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = 150;
  g.font = 'bold ' + fs + 'px "PingFang SC","Microsoft YaHei",serif';
  while (g.measureText(ch).width > s - 90 && fs > 60) {
    fs -= 8; g.font = 'bold ' + fs + 'px "PingFang SC","Microsoft YaHei",serif';
  }
  g.fillText(ch, s/2, s/2 + 6);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function makeLabelTexture(title, color) {
  const fs = 38, pad = 20;
  const m = document.createElement('canvas').getContext('2d');
  m.font = 'bold ' + fs + 'px "PingFang SC","Microsoft YaHei",sans-serif';
  const tw = Math.min(m.measureText(title).width, 900);
  const w = Math.ceil(tw + pad * 2), h = fs + pad * 2;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const hex = '#' + color.getHexString();
  g.fillStyle = 'rgba(8,10,20,0.82)';
  roundRect(g, 2, 2, w - 4, h - 4, 16); g.fill();
  g.strokeStyle = hex; g.lineWidth = 3; g.shadowColor = hex; g.shadowBlur = 14;
  roundRect(g, 2, 2, w - 4, h - 4, 16); g.stroke(); g.shadowBlur = 0;
  g.fillStyle = '#f3ecd8'; g.font = 'bold ' + fs + 'px "PingFang SC","Microsoft YaHei",sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(title, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.aspect = w / h;
  return tex;
}
function makeTitleTexture(name) {
  const w = 512, h = 128;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,212,132,0.96)';
  g.font = 'bold 64px "PingFang SC","Microsoft YaHei",sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(255,200,120,0.9)'; g.shadowBlur = 22;
  g.fillText('「' + name + '」', w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- 搜索 ----------
const searchBtn = $('searchBtn');
const searchOv = $('searchOv');
const searchInput = $('searchInput');
const searchResults = $('searchResults');
const searchClose = $('searchClose');
let searchOpen = false;

function escHtml(s) { return (s || '').replace(/[&<>^"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function openSearch() {
  if (!started) return;
  searchOpen = true;
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
function setYawPitchFromCamera() {
  const f = new THREE.Vector3();
  camera.getWorldDirection(f);
  yaw = Math.atan2(-f.x, -f.z);
  pitch = Math.asin(Math.max(-1, Math.min(1, f.y)));
}
function teleportToCluster(ci) {
  const c = clusterInfo[ci];
  const dir = c.center.clone();
  if (dir.lengthSq() < 1) dir.set(0, 0, 1);
  dir.normalize();
  camera.position.copy(c.center).addScaledVector(dir, 22);
  camera.position.y += 4;
  camera.lookAt(c.center);
  setYawPitchFromCamera();
  pendingOpen = -1;
}
function teleportToBook(inst) {
  const ci = bookCluster[inst];
  const c = clusterInfo[ci];
  const bp = bookSprites[inst].position.clone();
  const out = bp.clone().sub(c.center);
  if (out.lengthSq() < 1) out.set(0, 0, 1);
  out.normalize();
  camera.position.copy(bp).addScaledVector(out, 9);
  camera.position.y += 1.5;
  camera.lookAt(bp);
  setYawPitchFromCamera();
  mouseNDC.set(0, 0);
  pendingOpen = inst;
  hoveredIdx = -1;
}

searchBtn.addEventListener('click', openSearch);
searchClose.addEventListener('click', closeSearch);
searchInput.addEventListener('input', renderSearch);
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && started && !searchOpen) { e.preventDefault(); openSearch(); }
  else if (e.key === 'Escape' && searchOpen) { closeSearch(); }
});

// ---------- 启动 ----------
async function boot() {
  try {
    const res = await fetch(NAV_URL, { cache: 'no-cache' });
    const data = await res.json();
    const nav = (data.navigation || []).filter(c => c.items && c.items.length);
    if (!nav.length) throw new Error('nav.json 为空');
    buildSky(nav);
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
