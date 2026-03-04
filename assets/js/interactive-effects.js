/**
 * 🎪 星汉灿烂 - 交互特效增强
 * Author: CodeArts Agent
 * Version: 1.0.0
 */

(function() {
    'use strict';

    // ========================================
    // ✨ 点击波纹效果
    // ========================================
    class RippleEffect {
        constructor() {
            this.init();
        }

        init() {
            document.addEventListener('click', (e) => {
                this.createRipple(e.clientX, e.clientY);
            });
        }

        createRipple(x, y) {
            const ripple = document.createElement('div');
            ripple.style.cssText = `
                position: fixed;
                width: 20px;
                height: 20px;
                background: radial-gradient(circle, rgba(0, 255, 255, 0.8), transparent);
                border-radius: 50%;
                pointer-events: none;
                z-index: 99999;
                transform: translate(-50%, -50%);
                animation: rippleExpand 0.6s ease-out forwards;
            `;

            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;

            document.body.appendChild(ripple);

            setTimeout(() => ripple.remove(), 600);
        }
    }

    // ========================================
    // 🌟 悬浮粒子跟随
    // ========================================
    class FloatingParticles {
        constructor() {
            this.particles = [];
            this.maxParticles = 15;
            this.init();
        }

        init() {
            document.addEventListener('mousemove', (e) => {
                if (Math.random() > 0.9) {
                    this.createParticle(e.clientX, e.clientY);
                }
            });
        }

        createParticle(x, y) {
            const particle = document.createElement('div');
            const colors = ['#00ffff', '#ff0080', '#ffff00', '#00ff80'];
            const color = colors[Math.floor(Math.random() * colors.length)];

            particle.style.cssText = `
                position: fixed;
                width: ${Math.random() * 6 + 2}px;
                height: ${Math.random() * 6 + 2}px;
                background: ${color};
                border-radius: 50%;
                pointer-events: none;
                z-index: 99997;
                box-shadow: 0 0 10px ${color}, 0 0 20px ${color};
                animation: floatUp 1s ease-out forwards;
            `;

            particle.style.left = `${x}px`;
            particle.style.top = `${y}px`;

            document.body.appendChild(particle);
            this.particles.push(particle);

            setTimeout(() => {
                particle.remove();
                const index = this.particles.indexOf(particle);
                if (index > -1) {
                    this.particles.splice(index, 1);
                }
            }, 1000);
        }
    }

    // ========================================
    // 🎭 元素磁吸效果
    // ========================================
    class MagneticEffect {
        constructor() {
            this.elements = [];
            this.init();
        }

        init() {
            // 初始化已有元素
            this.initElements('.btn');
            this.initElements('.url-card .card');
            this.initElements('.sidebar-item a');

            // 监听新元素
            const observer = new MutationObserver(() => {
                this.initElements('.btn');
                this.initElements('.url-card .card');
                this.initElements('.sidebar-item a');
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }

        initElements(selector) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                if (!this.elements.includes(el)) {
                    this.elements.push(el);
                    this.addMagneticEffect(el);
                }
            });
        }

        addMagneticEffect(element) {
            element.addEventListener('mousemove', (e) => {
                const rect = element.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;

                element.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
            });

            element.addEventListener('mouseleave', () => {
                element.style.transform = 'translate(0, 0)';
            });
        }
    }

    // ========================================
    // 🔮 文字故障效果
    // ========================================
    class GlitchTextEffect {
        constructor() {
            this.init();
        }

        init() {
            const titles = document.querySelectorAll('h1, h2, h3, h4, .neon-text');
            titles.forEach(title => {
                this.addGlitchEffect(title);
            });
        }

        addGlitchEffect(element) {
            const originalText = element.textContent;
            const glitchChars = '!@#$%^&*()_+-=[]{}|;:,.<>?~';

            element.addEventListener('mouseenter', () => {
                let iterations = 0;
                const maxIterations = 10;

                const interval = setInterval(() => {
                    element.textContent = originalText
                        .split('')
                        .map((char, index) => {
                            if (index < iterations) {
                                return originalText[index];
                            }
                            return glitchChars[Math.floor(Math.random() * glitchChars.length)];
                        })
                        .join('');

                    iterations += 1 / 2;

                    if (iterations >= maxIterations) {
                        clearInterval(interval);
                        element.textContent = originalText;
                    }
                }, 50);
            });
        }
    }

    // ========================================
    // 🌈 渐变边框动画
    // ========================================
    class GradientBorderAnimation {
        constructor() {
            this.init();
        }

        init() {
            const cards = document.querySelectorAll('.url-card .card');
            cards.forEach(card => {
                this.addGradientBorder(card);
            });
        }

        addGradientBorder(element) {
            element.addEventListener('mouseenter', () => {
                element.style.setProperty('--gradient-angle', Math.random() * 360 + 'deg');
            });
        }
    }

    // ========================================
    // 🎯 悬浮提示增强
    // ========================================
    class EnhancedTooltip {
        constructor() {
            this.init();
        }

        init() {
            const tooltips = document.querySelectorAll('[data-toggle="tooltip"]');
            tooltips.forEach(tooltip => {
                this.enhanceTooltip(tooltip);
            });
        }

        enhanceTooltip(element) {
            const originalTitle = element.getAttribute('data-original-title') || element.getAttribute('title');

            element.addEventListener('mouseenter', (e) => {
                const tooltip = document.createElement('div');
                tooltip.className = 'enhanced-tooltip';
                tooltip.textContent = originalTitle;
                tooltip.style.cssText = `
                    position: fixed;
                    padding: 8px 16px;
                    background: linear-gradient(135deg, rgba(0, 255, 255, 0.9), rgba(255, 0, 128, 0.9));
                    color: white;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    pointer-events: none;
                    z-index: 100000;
                    box-shadow: 0 0 20px rgba(0, 255, 255, 0.5);
                    animation: tooltipFadeIn 0.3s ease;
                    backdrop-filter: blur(10px);
                `;

                const rect = element.getBoundingClientRect();
                tooltip.style.left = `${rect.left + rect.width / 2}px`;
                tooltip.style.top = `${rect.top - 40}px`;
                tooltip.style.transform = 'translateX(-50%)';

                document.body.appendChild(tooltip);
                element._tooltip = tooltip;
            });

            element.addEventListener('mouseleave', () => {
                if (element._tooltip) {
                    element._tooltip.style.animation = 'tooltipFadeOut 0.3s ease';
                    setTimeout(() => element._tooltip.remove(), 300);
                }
            });
        }
    }

    // ========================================
    // 🎪 滚动触发动画
    // ========================================
    class ScrollTriggerAnimation {
        constructor() {
            this.elements = [];
            this.init();
        }

        init() {
            // 初始化元素
            this.initElements('.url-card');
            this.initElements('h4');

            // 监听滚动
            window.addEventListener('scroll', () => this.onScroll());

            // 监听新元素
            const observer = new MutationObserver(() => {
                this.initElements('.url-card');
                this.initElements('h4');
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }

        initElements(selector) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                if (!this.elements.includes(el)) {
                    this.elements.push(el);
                    el.style.opacity = '0';
                    el.style.transform = 'translateY(30px)';
                    el.style.transition = 'all 0.6s ease';
                }
            });
        }

        onScroll() {
            const windowHeight = window.innerHeight;

            this.elements.forEach(element => {
                const elementTop = element.getBoundingClientRect().top;
                const elementVisible = 150;

                if (elementTop < windowHeight - elementVisible) {
                    element.style.opacity = '1';
                    element.style.transform = 'translateY(0)';
                }
            });
        }
    }

    // ========================================
    // 🌟 键盘快捷键提示
    // ========================================
    class KeyboardShortcuts {
        constructor() {
            this.shortcuts = {
                'Ctrl+K': '打开搜索',
                'Ctrl+Q': '打开搜索',
                'Escape': '关闭模态框',
                'Ctrl+B': '切换侧边栏',
                'Ctrl+D': '切换夜间模式',
                'Ctrl+Home': '回到顶部'
            };

            this.init();
        }

        init() {
            this.showShortcutsHint();

            document.addEventListener('keydown', (e) => {
                // Ctrl+B - 切换侧边栏
                if (e.ctrlKey && e.keyCode === 66) {
                    e.preventDefault();
                    const sidebar = document.querySelector('#sidebar');
                    if (sidebar) {
                        sidebar.classList.toggle('show');
                    }
                }

                // Ctrl+D - 切换夜间模式
                if (e.ctrlKey && e.keyCode === 68) {
                    e.preventDefault();
                    if (typeof switchNightMode === 'function') {
                        switchNightMode();
                    }
                }

                // Ctrl+Home - 回到顶部
                if (e.ctrlKey && e.keyCode === 36) {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        }

        showShortcutsHint() {
            const hint = document.createElement('div');
            hint.className = 'shortcuts-hint';
            hint.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 15px;
                background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95));
                border: 1px solid rgba(0, 255, 255, 0.3);
                border-radius: 12px;
                color: #e2e8f0;
                font-size: 12px;
                z-index: 99999;
                backdrop-filter: blur(10px);
                box-shadow: 0 0 30px rgba(0, 255, 255, 0.2);
                opacity: 0;
                transform: translateY(20px);
                transition: all 0.3s ease;
            `;

            const shortcutsHtml = Object.entries(this.shortcuts)
                .map(([key, action]) => `
                    <div style="display: flex; align-items: center; margin: 5px 0;">
                        <span style="
                            background: rgba(0, 255, 255, 0.2);
                            padding: 2px 8px;
                            border-radius: 4px;
                            margin-right: 10px;
                            border: 1px solid rgba(0, 255, 255, 0.3);
                            color: #00ffff;
                            font-family: monospace;
                        ">${key}</span>
                        <span>${action}</span>
                    </div>
                `).join('');

            hint.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 10px; color: #00ffff;">⌨️ 快捷键</div>
                ${shortcutsHtml}
                <div style="margin-top: 10px; color: #64748b; font-size: 10px;">按 ? 显示/隐藏</div>
            `;

            document.body.appendChild(hint);

            // 按 ? 键显示/隐藏
            document.addEventListener('keydown', (e) => {
                if (e.key === '?') {
                    hint.style.opacity = hint.style.opacity === '1' ? '0' : '1';
                    hint.style.transform = hint.style.opacity === '1' ? 'translateY(0)' : 'translateY(20px)';
                }
            });

            // 初始显示3秒后隐藏
            setTimeout(() => {
                hint.style.opacity = '0';
                hint.style.transform = 'translateY(20px)';
            }, 3000);
        }
    }

    // ========================================
    // 🎪 音效反馈系统
    // ========================================
    class SoundFeedback {
        constructor() {
            this.audioContext = null;
            this.enabled = true;
            this.init();
        }

        init() {
            // 首次用户交互后初始化音频上下文
            document.addEventListener('click', () => {
                if (!this.audioContext) {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                }
            }, { once: true });

            // 为按钮添加音效
            document.addEventListener('click', (e) => {
                if (e.target.closest('.btn') || e.target.closest('.url-card .card')) {
                    this.playClickSound();
                }
            });
        }

        playClickSound() {
            if (!this.enabled || !this.audioContext) return;

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

        toggle() {
            this.enabled = !this.enabled;
        }
    }

    // ========================================
    // 🌟 性能监控器
    // ========================================
    class PerformanceMonitor {
        constructor() {
            this.fps = 0;
            this.lastTime = performance.now();
            this.frameCount = 0;
            this.init();
        }

        init() {
            this.updateFPS();
        }

        updateFPS() {
            const currentTime = performance.now();
            this.frameCount++;

            if (currentTime - this.lastTime >= 1000) {
                this.fps = this.frameCount;
                this.frameCount = 0;
                this.lastTime = currentTime;

                // 在控制台显示FPS
                if (this.fps < 30) {
                    console.warn(`⚠️ FPS较低: ${this.fps}`);
                }
            }

            requestAnimationFrame(() => this.updateFPS());
        }

        getFPS() {
            return this.fps;
        }
    }

    // ========================================
    // 🎯 主初始化函数
    // ========================================
    class InteractiveEffects {
        constructor() {
            this.features = {
                ripple: true,
                floatingParticles: true,
                magnetic: true,
                glitch: true,
                gradientBorder: true,
                tooltip: true,
                scrollTrigger: true,
                shortcuts: true,
                sound: false, // 默认关闭音效
                performance: true
            };

            this.init();
        }

        init() {
            // 检查是否为移动设备
            const isMobile = window.innerWidth <= 768;

            // 初始化各个特效
            if (this.features.ripple) {
                new RippleEffect();
            }

            if (this.features.floatingParticles && !isMobile) {
                new FloatingParticles();
            }

            if (this.features.magnetic && !isMobile) {
                new MagneticEffect();
            }

            if (this.features.glitch) {
                new GlitchTextEffect();
            }

            if (this.features.gradientBorder) {
                new GradientBorderAnimation();
            }

            if (this.features.tooltip) {
                new EnhancedTooltip();
            }

            if (this.features.scrollTrigger) {
                new ScrollTriggerAnimation();
            }

            if (this.features.shortcuts && !isMobile) {
                new KeyboardShortcuts();
            }

            if (this.features.sound) {
                new SoundFeedback();
            }

            if (this.features.performance) {
                window.performanceMonitor = new PerformanceMonitor();
            }

            console.log('🎪 交互特效增强系统已启动');
        }

        // 动态启用/禁用特效
        toggleFeature(featureName, enabled) {
            if (this.features.hasOwnProperty(featureName)) {
                this.features[featureName] = enabled;
                console.log(`${featureName} ${enabled ? 'enabled' : 'disabled'}`);
            }
        }
    }

    // ========================================
    // 🚀 启动交互特效系统
    // ========================================
    document.addEventListener('DOMContentLoaded', () => {
        // 延迟启动，确保页面加载完成
        setTimeout(() => {
            window.interactiveEffects = new InteractiveEffects();
        }, 800);
    });

    // 导出到全局
    window.InteractiveEffects = InteractiveEffects;

})();
