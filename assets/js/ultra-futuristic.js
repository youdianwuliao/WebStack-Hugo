/**
 * 🌌 星汉灿烂 - 超级未来科技感动态效果
 * ========================================
 * 包含粒子系统、鼠标特效、动态背景等酷炫效果
 */

// ========================================
// 🌟 粒子系统
// ========================================
class ParticleSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.mouse = { x: null, y: null, radius: 150 };
        this.particleCount = 100;

        this.init();
        this.animate();
        this.addEventListeners();
    }

    init() {
        this.resize();
        this.createParticles();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createParticles() {
        this.particles = [];
        const colors = ['#00ffff', '#ff0080', '#ffff00', '#00ff00', '#ff6600'];

        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 3 + 1,
                speedX: (Math.random() - 0.5) * 0.5,
                speedY: (Math.random() - 0.5) * 0.5,
                color: colors[Math.floor(Math.random() * colors.length)],
                opacity: Math.random() * 0.5 + 0.5,
                pulse: Math.random() * Math.PI * 2,
                pulseSpeed: Math.random() * 0.02 + 0.01
            });
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.particles.forEach((particle, index) => {
            // 更新位置
            particle.x += particle.speedX;
            particle.y += particle.speedY;

            // 边界检查
            if (particle.x < 0 || particle.x > this.canvas.width) particle.speedX *= -1;
            if (particle.y < 0 || particle.y > this.canvas.height) particle.speedY *= -1;

            // 鼠标交互
            if (this.mouse.x !== null && this.mouse.y !== null) {
                const dx = this.mouse.x - particle.x;
                const dy = this.mouse.y - particle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < this.mouse.radius) {
                    const force = (this.mouse.radius - distance) / this.mouse.radius;
                    particle.x -= dx * force * 0.02;
                    particle.y -= dy * force * 0.02;
                }
            }

            // 脉冲效果
            particle.pulse += particle.pulseSpeed;
            const pulseSize = Math.sin(particle.pulse) * 0.5 + 1;

            // 绘制粒子
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size * pulseSize, 0, Math.PI * 2);
            this.ctx.fillStyle = particle.color;
            this.ctx.globalAlpha = particle.opacity;
            this.ctx.fill();

            // 绘制发光效果
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size * pulseSize * 2, 0, Math.PI * 2);
            this.ctx.fillStyle = particle.color;
            this.ctx.globalAlpha = particle.opacity * 0.3;
            this.ctx.fill();

            // 连线效果
            this.particles.slice(index + 1).forEach(otherParticle => {
                const dx = particle.x - otherParticle.x;
                const dy = particle.y - otherParticle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 120) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(particle.x, particle.y);
                    this.ctx.lineTo(otherParticle.x, otherParticle.y);
                    this.ctx.strokeStyle = particle.color;
                    this.ctx.globalAlpha = (1 - distance / 120) * 0.3;
                    this.ctx.lineWidth = 0.5;
                    this.ctx.stroke();
                }
            });
        });

        this.ctx.globalAlpha = 1;
        requestAnimationFrame(() => this.animate());
    }

    addEventListeners() {
        window.addEventListener('resize', () => {
            this.resize();
            this.createParticles();
        });

        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        window.addEventListener('mouseout', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });
    }
}

// ========================================
// 🔮 赛博朋克网格背景
// ========================================
class CyberGrid {
    constructor() {
        this.container = document.querySelector('.cyber-grid');
        if (!this.container) return;

        this.init();
    }

    init() {
        // 网格效果已通过CSS实现，这里可以添加额外的动态效果
        this.animateLines();
    }

    animateLines() {
        // 可以添加动态线条扫描效果
        setInterval(() => {
            const line = document.createElement('div');
            line.style.cssText = `
                position: absolute;
                top: 0;
                left: ${Math.random() * 100}%;
                width: 2px;
                height: 100%;
                background: linear-gradient(180deg, transparent, rgba(0, 255, 255, 0.5), transparent);
                animation: lineScan 2s linear;
                pointer-events: none;
            `;
            this.container.appendChild(line);

            setTimeout(() => line.remove(), 2000);
        }, 3000);
    }
}

// ========================================
// ⚡ 闪电效果
// ========================================
class LightningEffect {
    constructor() {
        this.container = document.querySelector('.lightning');
        if (!this.container) return;

        this.init();
    }

    init() {
        setInterval(() => {
            if (Math.random() > 0.7) {
                this.flash();
            }
        }, 5000);
    }

    flash() {
        this.container.classList.add('flash');
        setTimeout(() => {
            this.container.classList.remove('flash');
        }, 200);
    }
}

// ========================================
// 🌟 鼠标跟随光效
// ========================================
class MouseGlow {
    constructor() {
        this.mouseGlow = null;
        this.mouseTrail = [];
        this.init();
    }

    init() {
        this.createMouseGlow();
        this.addEventListeners();
        this.animateTrail();
    }

    createMouseGlow() {
        this.mouseGlow = document.createElement('div');
        this.mouseGlow.className = 'cursor-glow primary';
        this.mouseGlow.style.cssText = `
            position: fixed;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            pointer-events: none;
            z-index: 99999;
            background: radial-gradient(circle, rgba(0, 255, 255, 0.8) 0%, transparent 70%);
            box-shadow: 0 0 20px rgba(0, 255, 255, 0.8), 0 0 40px rgba(0, 255, 255, 0.4);
            transition: transform 0.1s ease;
        `;
        document.body.appendChild(this.mouseGlow);
    }

    addEventListeners() {
        document.addEventListener('mousemove', (e) => {
            this.updateMouseGlow(e.clientX, e.clientY);
            this.addTrail(e.clientX, e.clientY);
        });

        document.addEventListener('mousedown', () => {
            this.mouseGlow.style.transform = 'scale(1.5)';
        });

        document.addEventListener('mouseup', () => {
            this.mouseGlow.style.transform = 'scale(1)';
        });
    }

    updateMouseGlow(x, y) {
        this.mouseGlow.style.left = (x - 15) + 'px';
        this.mouseGlow.style.top = (y - 15) + 'px';
    }

    addTrail(x, y) {
        const trail = document.createElement('div');
        trail.style.cssText = `
            position: fixed;
            left: ${x - 5}px;
            top: ${y - 5}px;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(0, 255, 255, 0.6), transparent);
            pointer-events: none;
            z-index: 99998;
            animation: trailFade 0.5s ease forwards;
        `;
        document.body.appendChild(trail);

        setTimeout(() => trail.remove(), 500);
    }

    animateTrail() {
        // CSS动画定义
        const style = document.createElement('style');
        style.textContent = `
            @keyframes trailFade {
                0% {
                    opacity: 1;
                    transform: scale(1);
                }
                100% {
                    opacity: 0;
                    transform: scale(0);
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// ========================================
// 🎭 卡片3D效果
// ========================================
class Card3DEffect {
    constructor() {
        this.cards = document.querySelectorAll('.url-card .card');
        this.init();
    }

    init() {
        this.cards.forEach(card => {
            card.addEventListener('mousemove', (e) => this.handleMouseMove(e, card));
            card.addEventListener('mouseleave', (e) => this.handleMouseLeave(e, card));
        });
    }

    handleMouseMove(e, card) {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = (y - centerY) / 10;
        const rotateY = (centerX - x) / 10;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
    }

    handleMouseLeave(e, card) {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)';
    }
}

// ========================================
// 🌈 动态背景切换
// ========================================
class DynamicBackground {
    constructor() {
        this.bg = document.getElementById('search-bg');
        if (!this.bg) return;

        this.init();
    }

    init() {
        this.animateBackground();
    }

    animateBackground() {
        const gradients = [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
            'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
            'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)'
        ];

        let currentIndex = 0;

        setInterval(() => {
            currentIndex = (currentIndex + 1) % gradients.length;
            this.bg.style.transition = 'background 3s ease';
            this.bg.style.background = gradients[currentIndex];
        }, 10000);
    }
}

// ========================================
// 🎯 搜索引擎切换动画
// ========================================
class SearchEngineSwitch {
    constructor() {
        this.searchInputs = document.querySelectorAll('input[name="type"], input[name="type2"]');
        this.searchText = document.getElementById('search-text');
        this.mSearchText = document.getElementById('m_search-text');
        this.init();
    }

    init() {
        this.searchInputs.forEach(input => {
            input.addEventListener('change', (e) => this.handleSwitch(e));
        });
    }

    handleSwitch(e) {
        const placeholder = e.target.dataset.placeholder;
        if (placeholder) {
            if (this.searchText) {
                this.animatePlaceholder(this.searchText, placeholder);
            }
            if (this.mSearchText) {
                this.animatePlaceholder(this.mSearchText, placeholder);
            }
        }
    }

    animatePlaceholder(element, newPlaceholder) {
        element.style.transition = 'opacity 0.3s ease';
        element.style.opacity = '0';

        setTimeout(() => {
            element.placeholder = newPlaceholder;
            element.style.opacity = '1';
        }, 300);
    }
}

// ========================================
// 🎪 页面加载进度条
// ========================================
class LoadingProgress {
    constructor() {
        this.progress = 0;
        this.progressBar = null;
        // 禁用进度条，避免与原有加载动画冲突
        // this.init();
    }

    init() {
        this.createProgressBar();
        this.simulateLoading();
    }

    createProgressBar() {
        this.progressBar = document.createElement('div');
        this.progressBar.className = 'loading-progress';
        document.body.appendChild(this.progressBar);
    }

    simulateLoading() {
        const interval = setInterval(() => {
            this.progress += Math.random() * 10;
            if (this.progress >= 100) {
                this.progress = 100;
                clearInterval(interval);

                setTimeout(() => {
                    this.progressBar.style.opacity = '0';
                    setTimeout(() => this.progressBar.remove(), 300);
                }, 500);
            }
            this.progressBar.style.width = this.progress + '%';
        }, 100);
    }
}

// ========================================
// 🌟 能量球漂浮效果
// ========================================
class EnergyOrbs {
    constructor() {
        this.orbs = document.querySelectorAll('.energy-orb');
        if (this.orbs.length === 0) this.createOrbs();
    }

    createOrbs() {
        const container = document.body;
        for (let i = 1; i <= 3; i++) {
            const orb = document.createElement('div');
            orb.className = `energy-orb orb-${i}`;
            container.appendChild(orb);
        }
        this.orbs = document.querySelectorAll('.energy-orb');
    }
}

// ========================================
// 🎭 键盘快捷键增强
// ========================================
class KeyboardShortcuts {
    constructor() {
        this.init();
    }

    init() {
        document.addEventListener('keydown', (e) => {
            // Ctrl + K: 搜索
            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                this.focusSearch();
            }

            // Ctrl + /: 显示快捷键帮助
            if (e.ctrlKey && e.key === '/') {
                e.preventDefault();
                this.showShortcutsHelp();
            }
        });
    }

    focusSearch() {
        const searchText = document.getElementById('search-text');
        if (searchText) {
            searchText.focus();
        } else {
            const mSearchText = document.getElementById('m_search-text');
            if (mSearchText) {
                $('#search-modal').modal('show');
                setTimeout(() => mSearchText.focus(), 300);
            }
        }
    }

    showShortcutsHelp() {
        alert('🎯 快捷键帮助:\n\nCtrl + K: 聚焦搜索框\nCtrl + Q: 打开搜索模态框\nCtrl + /: 显示此帮助\nESC: 关闭模态框');
    }
}

// ========================================
// 🌈 文字打字机效果
// ========================================
class TypewriterEffect {
    constructor(element, text, speed = 100) {
        this.element = element;
        this.text = text;
        this.speed = speed;
        this.index = 0;
        this.init();
    }

    init() {
        this.type();
    }

    type() {
        if (this.index < this.text.length) {
            this.element.textContent += this.text.charAt(this.index);
            this.index++;
            setTimeout(() => this.type(), this.speed);
        }
    }
}

// ========================================
// 🎯 滚动触发动画
// ========================================
class ScrollAnimations {
    constructor() {
        this.init();
    }

    init() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                }
            });
        }, observerOptions);

        document.querySelectorAll('.url-card, h4').forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(el);
        });

        // 添加动画样式
        const style = document.createElement('style');
        style.textContent = `
            .animate-in {
                opacity: 1 !important;
                transform: translateY(0) !important;
            }
        `;
        document.head.appendChild(style);
    }
}

// ========================================
// 🔮 音效系统
// ========================================
class SoundEffects {
    constructor() {
        this.enabled = false;
        this.audioContext = null;
    }

    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.enabled = true;
        } catch (e) {
            console.log('Audio not supported');
        }
    }

    playHoverSound() {
        if (!this.enabled) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.1);
    }

    playClickSound() {
        if (!this.enabled) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = 1200;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.15);
    }
}

// ========================================
// 🌟 初始化所有效果
// ========================================
function initEffects() {
    try {
        console.log('🚀 开始初始化超级未来科技感效果...');

        // 粒子系统
        new ParticleSystem('particle-canvas');

        // 赛博朋克网格
        new CyberGrid();

        // 闪电效果
        new LightningEffect();

        // 鼠标跟随光效
        new MouseGlow();

        // 卡片3D效果
        new Card3DEffect();

        // 动态背景
        new DynamicBackground();

        // 搜索引擎切换
        new SearchEngineSwitch();

        // 加载进度条
        new LoadingProgress();

        // 能量球
        new EnergyOrbs();

        // 键盘快捷键
        new KeyboardShortcuts();

        // 滚动动画
        new ScrollAnimations();

        // 添加音效到交互元素
        const soundEffects = new SoundEffects();

        // 鼠标悬停音效
        document.querySelectorAll('a, button, .url-card .card').forEach(el => {
            el.addEventListener('mouseenter', () => soundEffects.playHoverSound());
            el.addEventListener('click', () => soundEffects.playClickSound());
        });

        // 点击页面任意位置初始化音频
        document.addEventListener('click', () => {
            if (!soundEffects.enabled) {
                soundEffects.init();
            }
        }, { once: true });

        console.log('🌌 星汉灿烂 - 超级未来科技感效果已启动！');
    } catch (error) {
        console.error('❌ 初始化效果时出错:', error);
    }
}

// 使用多种方式确保初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEffects);
} else {
    // 如果DOM已经加载完成，立即初始化
    initEffects();
}

// 备用方案：确保在window加载后也能初始化
window.addEventListener('load', () => {
    setTimeout(initEffects, 100);
});

// ========================================
// 🎭 额外的实用功能
// ========================================

// 性能优化：节流函数
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// 性能优化：防抖函数
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// 检测设备类型
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// 检测暗色模式
function isDarkMode() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// 平滑滚动到指定元素
function smoothScrollTo(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// 复制到剪贴板
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        console.log('复制成功！');
    }).catch(err => {
        console.error('复制失败:', err);
    });
}

// 随机生成颜色
function randomColor() {
    const colors = ['#00ffff', '#ff0080', '#ffff00', '#00ff00', '#ff6600', '#9400d3'];
    return colors[Math.floor(Math.random() * colors.length)];
}

// 获取当前时间
function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString('zh-CN');
}

// 获取当前日期
function getCurrentDate() {
    const now = new Date();
    return now.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    });
}

// 格式化数字（添加千位分隔符）
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// 生成随机字符串
function randomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// 深度克隆对象
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// 检查元素是否在视口中
function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// 添加CSS类
function addClass(element, className) {
    if (element && !element.classList.contains(className)) {
        element.classList.add(className);
    }
}

// 移除CSS类
function removeClass(element, className) {
    if (element && element.classList.contains(className)) {
        element.classList.remove(className);
    }
}

// 切换CSS类
function toggleClass(element, className) {
    if (element) {
        element.classList.toggle(className);
    }
}

// 获取元素的数据属性
function getDataAttribute(element, attribute) {
    return element ? element.dataset[attribute] : null;
}

// 设置元素的数据属性
function setDataAttribute(element, attribute, value) {
    if (element) {
        element.dataset[attribute] = value;
    }
}

// 显示元素
function showElement(element) {
    if (element) {
        element.style.display = 'block';
    }
}

// 隐藏元素
function hideElement(element) {
    if (element) {
        element.style.display = 'none';
    }
}

// 切换元素显示/隐藏
function toggleElement(element) {
    if (element) {
        element.style.display = element.style.display === 'none' ? 'block' : 'none';
    }
}

// 获取元素的CSS样式
function getElementComputedStyle(element, property) {
    return window.getComputedStyle(element)[property];
}

// 设置元素的CSS样式
function setStyle(element, styles) {
    if (element && typeof styles === 'object') {
        Object.assign(element.style, styles);
    }
}

// 添加事件监听器
function addElementEventListener(element, event, handler, options) {
    if (element && typeof element.addEventListener === 'function') {
        element.addEventListener(event, handler, options);
    }
}

// 移除事件监听器
function removeElementEventListener(element, event, handler, options) {
    if (element && typeof element.removeEventListener === 'function') {
        element.removeEventListener(event, handler, options);
    }
}

// 触发自定义事件
function dispatchEvent(element, eventName, detail) {
    if (element) {
        const event = new CustomEvent(eventName, { detail });
        element.dispatchEvent(event);
    }
}

// 等待指定时间
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 重试函数
async function retry(fn, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await wait(delay);
        }
    }
}

// 批量执行异步操作
async function batchAsync(asyncFns, concurrency = 5) {
    const results = [];
    for (let i = 0; i < asyncFns.length; i += concurrency) {
        const batch = asyncFns.slice(i, i + concurrency);
        const batchResults = await Promise.all(batch.map(fn => fn()));
        results.push(...batchResults);
    }
    return results;
}

// 缓存函数结果
function memoize(fn) {
    const cache = new Map();
    return function(...args) {
        const key = JSON.stringify(args);
        if (cache.has(key)) {
            return cache.get(key);
        }
        const result = fn.apply(this, args);
        cache.set(key, result);
        return result;
    };
}

// 检测网络连接状态
function isOnline() {
    return navigator.onLine;
}

// 获取网络类型
function getNetworkType() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return connection ? connection.effectiveType : 'unknown';
}

// 获取电池信息
function getBatteryInfo() {
    return navigator.getBattery ? navigator.getBattery() : Promise.reject('Battery API not supported');
}

// 获取地理位置
function getGeolocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject('Geolocation not supported');
            return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject);
    });
}

// 获取设备方向
function getDeviceOrientation() {
    return new Promise((resolve, reject) => {
        if (!window.DeviceOrientationEvent) {
            reject('Device orientation not supported');
            return;
        }
        window.addEventListener('deviceorientation', (event) => {
            resolve({
                alpha: event.alpha,
                beta: event.beta,
                gamma: event.gamma
            });
        }, { once: true });
    });
}

// 获取设备运动
function getDeviceMotion() {
    return new Promise((resolve, reject) => {
        if (!window.DeviceMotionEvent) {
            reject('Device motion not supported');
            return;
        }
        window.addEventListener('devicemotion', (event) => {
            resolve({
                acceleration: event.acceleration,
                accelerationIncludingGravity: event.accelerationIncludingGravity,
                rotationRate: event.rotationRate
            });
        }, { once: true });
    });
}

// 获取触摸事件
function getTouchEvents() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// 获取屏幕信息
function getScreenInfo() {
    return {
        width: window.screen.width,
        height: window.screen.height,
        availWidth: window.screen.availWidth,
        availHeight: window.screen.availHeight,
        colorDepth: window.screen.colorDepth,
        pixelDepth: window.screen.pixelDepth,
        orientation: window.screen.orientation ? window.screen.orientation.type : 'unknown'
    };
}

// 获取窗口信息
function getWindowInfo() {
    return {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        pageXOffset: window.pageXOffset,
        pageYOffset: window.pageYOffset
    };
}

// 获取文档信息
function getDocumentInfo() {
    return {
        title: document.title,
        URL: document.URL,
        domain: document.domain,
        referrer: document.referrer,
        cookie: document.cookie,
        lastModified: document.lastModified,
        readyState: document.readyState
    };
}

// 获取浏览器信息
function getBrowserInfo() {
    return {
        userAgent: navigator.userAgent,
        appName: navigator.appName,
        appVersion: navigator.appVersion,
        platform: navigator.platform,
        language: navigator.language,
        languages: navigator.languages,
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        javaEnabled: navigator.javaEnabled(),
        pdfViewerEnabled: navigator.pdfViewerEnabled,
        vendor: navigator.vendor,
        product: navigator.product,
        hardwareConcurrency: navigator.hardwareConcurrency,
        maxTouchPoints: navigator.maxTouchPoints,
        deviceMemory: navigator.deviceMemory
    };
}

// 获取性能信息
function getPerformanceInfo() {
    if (!window.performance) {
        return null;
    }
    const perf = window.performance;
    const timing = perf.timing || {};
    const navigation = perf.navigation || {};

    return {
        timing: {
            navigationStart: timing.navigationStart,
            unloadEventStart: timing.unloadEventStart,
            unloadEventEnd: timing.unloadEventEnd,
            redirectStart: timing.redirectStart,
            redirectEnd: timing.redirectEnd,
            fetchStart: timing.fetchStart,
            domainLookupStart: timing.domainLookupStart,
            domainLookupEnd: timing.domainLookupEnd,
            connectStart: timing.connectStart,
            connectEnd: timing.connectEnd,
            secureConnectionStart: timing.secureConnectionStart,
            requestStart: timing.requestStart,
            responseStart: timing.responseStart,
            responseEnd: timing.responseEnd,
            domLoading: timing.domLoading,
            domInteractive: timing.domInteractive,
            domContentLoadedEventStart: timing.domContentLoadedEventStart,
            domContentLoadedEventEnd: timing.domContentLoadedEventEnd,
            domComplete: timing.domComplete,
            loadEventStart: timing.loadEventStart,
            loadEventEnd: timing.loadEventEnd
        },
        navigation: {
            type: navigation.type,
            redirectCount: navigation.redirectCount
        },
        memory: perf.memory || null
    };
}

// 获取存储信息
function getStorageInfo() {
    return {
        localStorage: {
            length: localStorage.length,
            used: JSON.stringify(localStorage).length,
            quota: 5 * 1024 * 1024 // 5MB
        },
        sessionStorage: {
            length: sessionStorage.length,
            used: JSON.stringify(sessionStorage).length,
            quota: 5 * 1024 * 1024 // 5MB
        }
    };
}

// 清除存储
function clearStorage(type = 'all') {
    if (type === 'all' || type === 'localStorage') {
        localStorage.clear();
    }
    if (type === 'all' || type === 'sessionStorage') {
        sessionStorage.clear();
    }
}

// 获取存储项
function getStorageItem(key, type = 'localStorage') {
    const storage = type === 'sessionStorage' ? sessionStorage : localStorage;
    return storage.getItem(key);
}

// 设置存储项
function setStorageItem(key, value, type = 'localStorage') {
    const storage = type === 'sessionStorage' ? sessionStorage : localStorage;
    storage.setItem(key, value);
}

// 移除存储项
function removeStorageItem(key, type = 'localStorage') {
    const storage = type === 'sessionStorage' ? sessionStorage : localStorage;
    storage.removeItem(key);
}

// 获取所有存储键
function getStorageKeys(type = 'localStorage') {
    const storage = type === 'sessionStorage' ? sessionStorage : localStorage;
    return Object.keys(storage);
}

// 获取存储大小
function getStorageSize(type = 'localStorage') {
    const storage = type === 'sessionStorage' ? sessionStorage : localStorage;
    let size = 0;
    for (let key in storage) {
        if (storage.hasOwnProperty(key)) {
            size += (storage[key].length + key.length) * 2;
        }
    }
    return size;
}

// 导出所有工具函数
window.UltraFuturisticUtils = {
    throttle,
    debounce,
    isMobile,
    isDarkMode,
    smoothScrollTo,
    copyToClipboard,
    randomColor,
    getCurrentTime,
    getCurrentDate,
    formatNumber,
    randomString,
    deepClone,
    isInViewport,
    addClass,
    removeClass,
    toggleClass,
    getDataAttribute,
    setDataAttribute,
    showElement,
    hideElement,
    toggleElement,
    getElementComputedStyle,
    setStyle,
    addElementEventListener,
    removeElementEventListener,
    dispatchEvent,
    wait,
    retry,
    batchAsync,
    memoize,
    isOnline,
    getNetworkType,
    getBatteryInfo,
    getGeolocation,
    getDeviceOrientation,
    getDeviceMotion,
    getTouchEvents,
    getScreenInfo,
    getWindowInfo,
    getDocumentInfo,
    getBrowserInfo,
    getPerformanceInfo,
    getStorageInfo,
    clearStorage,
    getStorageItem,
    setStorageItem,
    removeStorageItem,
    getStorageKeys,
    getStorageSize
};

console.log('🎯 Ultra Futuristic Utils 已加载！');
