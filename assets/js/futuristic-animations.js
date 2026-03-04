/**
 * 🌌 星汉灿烂 - 未来科技感动画引擎
 * Author: CodeArts Agent
 * Version: 1.0.0
 */

(function() {
    'use strict';

    // ========================================
    // 🎯 自定义科技感光标
    // ========================================
    class TechCursor {
        constructor() {
            this.primaryCursor = this.createCursor('primary');
            this.secondaryCursor = this.createCursor('secondary');
            this.trail = [];
            this.maxTrailLength = 10;
            this.mouseX = 0;
            this.mouseY = 0;
            this.init();
        }

        createCursor(type) {
            const cursor = document.createElement('div');
            cursor.className = `cursor-glow ${type}`;
            document.body.appendChild(cursor);
            return cursor;
        }

        init() {
            // 创建光标拖尾
            for (let i = 0; i < this.maxTrailLength; i++) {
                const trailDot = document.createElement('div');
                trailDot.className = 'cursor-trail';
                trailDot.style.opacity = (1 - i / this.maxTrailLength) * 0.5;
                trailDot.style.transform = `scale(${1 - i / this.maxTrailLength})`;
                document.body.appendChild(trailDot);
                this.trail.push({
                    element: trailDot,
                    x: 0,
                    y: 0
                });
            }

            // 鼠标移动事件
            document.addEventListener('mousemove', (e) => {
                this.mouseX = e.clientX;
                this.mouseY = e.clientY;
            });

            // 动画循环
            this.animate();
        }

        animate() {
            // 主光标跟随（带延迟）
            const primaryX = this.mouseX - 10;
            const primaryY = this.mouseY - 10;

            this.primaryCursor.style.transform = `translate(${primaryX}px, ${primaryY}px)`;
            this.secondaryCursor.style.transform = `translate(${primaryX + 5}px, ${primaryY + 5}px)`;

            // 拖尾效果
            for (let i = this.trail.length - 1; i > 0; i--) {
                this.trail[i].x = this.trail[i - 1].x;
                this.trail[i].y = this.trail[i - 1].y;
            }
            this.trail[0].x = this.mouseX;
            this.trail[0].y = this.mouseY;

            this.trail.forEach((trail, index) => {
                trail.element.style.transform = `translate(${trail.x - 4}px, ${trail.y - 4}px) scale(${1 - index / this.maxTrailLength})`;
            });

            requestAnimationFrame(() => this.animate());
        }
    }

    // ========================================
    // ✨ 粒子系统
    // ========================================
    class ParticleSystem {
        constructor() {
            this.container = this.createContainer();
            this.particles = [];
            this.maxParticles = 50;
            this.init();
        }

        createContainer() {
            const container = document.createElement('div');
            container.className = 'particles-container';
            document.body.appendChild(container);
            return container;
        }

        createParticle() {
            const particle = document.createElement('div');
            const types = ['type-1', 'type-2', 'type-3'];
            const type = types[Math.floor(Math.random() * types.length)];
            particle.className = `particle ${type}`;

            const size = Math.random() * 4 + 2;
            const startX = Math.random() * window.innerWidth;
            const duration = Math.random() * 10 + 10;
            const delay = Math.random() * 10;

            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.left = `${startX}px`;
            particle.style.animationDuration = `${duration}s`;
            particle.style.animationDelay = `${delay}s`;

            this.container.appendChild(particle);
            this.particles.push(particle);

            // 限制粒子数量
            if (this.particles.length > this.maxParticles) {
                const oldParticle = this.particles.shift();
                oldParticle.remove();
            }
        }

        init() {
            // 初始创建粒子
            for (let i = 0; i < 20; i++) {
                setTimeout(() => this.createParticle(), i * 200);
            }

            // 持续创建粒子
            setInterval(() => this.createParticle(), 1000);
        }
    }

    // ========================================
    // 🌌 星空系统
    // ========================================
    class Starfield {
        constructor() {
            this.container = this.createContainer();
            this.stars = [];
            this.maxStars = 200;
            this.init();
        }

        createContainer() {
            const container = document.createElement('div');
            container.className = 'starfield';
            document.body.appendChild(container);
            return container;
        }

        createStar() {
            const star = document.createElement('div');
            const sizes = ['small', 'medium', 'large'];
            const size = sizes[Math.floor(Math.random() * sizes.length)];
            star.className = `star ${size}`;

            const x = Math.random() * 100;
            const y = Math.random() * 100;
            const duration = Math.random() * 3 + 2;
            const delay = Math.random() * 5;

            star.style.left = `${x}%`;
            star.style.top = `${y}%`;
            star.style.animationDuration = `${duration}s`;
            star.style.animationDelay = `${delay}s`;

            this.container.appendChild(star);
            this.stars.push(star);

            if (this.stars.length > this.maxStars) {
                const oldStar = this.stars.shift();
                oldStar.remove();
            }
        }

        init() {
            for (let i = 0; i < this.maxStars; i++) {
                this.createStar();
            }
        }
    }

    // ========================================
    // ☄️ 流星系统
    // ========================================
    class MeteorSystem {
        constructor() {
            this.container = this.createContainer();
            this.meteors = [];
            this.init();
        }

        createContainer() {
            // 复用星空容器
            let container = document.querySelector('.starfield');
            if (!container) {
                container = document.createElement('div');
                container.className = 'starfield';
                document.body.appendChild(container);
            }
            return container;
        }

        createMeteor() {
            const meteor = document.createElement('div');
            meteor.className = 'meteor';

            const startX = Math.random() * (window.innerWidth + 200);
            const startY = Math.random() * (window.innerHeight / 2);
            const duration = Math.random() * 2 + 1;

            meteor.style.left = `${startX}px`;
            meteor.style.top = `${startY}px`;
            meteor.style.animationDuration = `${duration}s`;

            this.container.appendChild(meteor);
            this.meteors.push(meteor);

            // 动画结束后移除
            setTimeout(() => {
                meteor.remove();
                const index = this.meteors.indexOf(meteor);
                if (index > -1) {
                    this.meteors.splice(index, 1);
                }
            }, duration * 1000);
        }

        init() {
            // 随机创建流星
            setInterval(() => {
                if (Math.random() > 0.7) {
                    this.createMeteor();
                }
            }, 2000);
        }
    }

    // ========================================
    // 🕹️ 数字雨系统（黑客帝国风格）
    // ========================================
    class MatrixRain {
        constructor() {
            this.container = this.createContainer();
            this.columns = [];
            this.columnCount = Math.floor(window.innerWidth / 20);
            this.init();
        }

        createContainer() {
            const container = document.createElement('div');
            container.className = 'matrix-rain';
            document.body.appendChild(container);
            return container;
        }

        createColumn() {
            const column = document.createElement('div');
            column.className = 'matrix-column';

            const x = Math.random() * window.innerWidth;
            const duration = Math.random() * 5 + 5;
            const delay = Math.random() * 10;
            const chars = this.generateRandomChars();

            column.style.left = `${x}px`;
            column.style.animationDuration = `${duration}s`;
            column.style.animationDelay = `${delay}s`;
            column.textContent = chars;

            this.container.appendChild(column);
            this.columns.push(column);

            // 动画结束后重新创建
            setTimeout(() => {
                column.remove();
                const index = this.columns.indexOf(column);
                if (index > -1) {
                    this.columns.splice(index, 1);
                }
                this.createColumn();
            }, (duration + delay) * 1000);
        }

        generateRandomChars() {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()';
            let result = '';
            for (let i = 0; i < 50; i++) {
                result += chars[Math.floor(Math.random() * chars.length)] + '\n';
            }
            return result;
        }

        init() {
            for (let i = 0; i < this.columnCount; i++) {
                setTimeout(() => this.createColumn(), i * 100);
            }
        }
    }

    // ========================================
    // 🎭 3D 视差效果
    // ========================================
    class ParallaxEffect {
        constructor() {
            this.layers = [];
            this.mouseX = 0;
            this.mouseY = 0;
            this.init();
        }

        init() {
            // 创建视差层
            for (let i = 1; i <= 3; i++) {
                const layer = document.createElement('div');
                layer.className = `parallax-layer layer-${i}`;
                layer.dataset.speed = i * 0.5;
                document.body.appendChild(layer);
                this.layers.push(layer);
            }

            // 监听鼠标移动
            document.addEventListener('mousemove', (e) => {
                this.mouseX = (e.clientX - window.innerWidth / 2) / window.innerWidth;
                this.mouseY = (e.clientY - window.innerHeight / 2) / window.innerHeight;
                this.updateLayers();
            });
        }

        updateLayers() {
            this.layers.forEach(layer => {
                const speed = parseFloat(layer.dataset.speed);
                const x = -this.mouseX * 50 * speed;
                const y = -this.mouseY * 50 * speed;
                layer.style.transform = `translate(${x}px, ${y}px)`;
            });
        }
    }

    // ========================================
    // 🌊 波浪动画
    // ========================================
    class WaveAnimation {
        constructor() {
            this.container = this.createContainer();
            this.init();
        }

        createContainer() {
            const container = document.createElement('div');
            container.className = 'wave-container';
            document.body.appendChild(container);
            return container;
        }

        init() {
            for (let i = 0; i < 3; i++) {
                const wave = document.createElement('div');
                wave.className = 'wave';
                this.container.appendChild(wave);
            }
        }
    }

    // ========================================
    // 🔮 能量球效果
    // ========================================
    class EnergyOrbs {
        constructor() {
            this.orbs = [];
            this.init();
        }

        init() {
            const positions = [
                { class: 'orb-1' },
                { class: 'orb-2' },
                { class: 'orb-3' }
            ];

            positions.forEach(pos => {
                const orb = document.createElement('div');
                orb.className = `energy-orb ${pos.class}`;
                document.body.appendChild(orb);
                this.orbs.push(orb);
            });
        }
    }

    // ========================================
    // 🎯 卡片 3D 倾斜效果
    // ========================================
    class CardTiltEffect {
        constructor() {
            this.cards = [];
            this.init();
        }

        init() {
            // 初始化已有卡片
            this.initCards();

            // 监听新卡片
            const observer = new MutationObserver(() => {
                this.initCards();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }

        initCards() {
            const cards = document.querySelectorAll('.url-card .card');
            cards.forEach(card => {
                if (!this.cards.includes(card)) {
                    this.cards.push(card);
                    this.addTiltEffect(card);
                }
            });
        }

        addTiltEffect(card) {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                const rotateX = (y - centerY) / 10;
                const rotateY = (centerX - x) / 10;

                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px)`;
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
            });
        }
    }

    // ========================================
    // 🌟 主初始化函数
    // ========================================
    class FuturisticAnimations {
        constructor() {
            this.features = {
                cursor: true,
                particles: true,
                starfield: true,
                meteors: true,
                matrix: true,
                parallax: true,
                waves: true,
                energyOrbs: true,
                cardTilt: true
            };

            this.init();
        }

        init() {
            // 检查是否为移动设备
            const isMobile = window.innerWidth <= 768;

            // 初始化各个特效
            if (this.features.cursor && !isMobile) {
                new TechCursor();
            }

            if (this.features.particles) {
                new ParticleSystem();
            }

            if (this.features.starfield) {
                new Starfield();
            }

            if (this.features.meteors) {
                new MeteorSystem();
            }

            if (this.features.matrix && !isMobile) {
                new MatrixRain();
            }

            if (this.features.parallax && !isMobile) {
                new ParallaxEffect();
            }

            if (this.features.waves) {
                new WaveAnimation();
            }

            if (this.features.energyOrbs) {
                new EnergyOrbs();
            }

            if (this.features.cardTilt) {
                new CardTiltEffect();
            }

            // 性能优化：页面不可见时暂停动画
            this.handleVisibilityChange();
        }

        handleVisibilityChange() {
            document.addEventListener('visibilitychange', () => {
                const particles = document.querySelectorAll('.particle, .meteor, .matrix-column');
                particles.forEach(p => {
                    p.style.animationPlayState = document.hidden ? 'paused' : 'running';
                });
            });
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
    // 🚀 启动动画系统
    // ========================================
    document.addEventListener('DOMContentLoaded', () => {
        // 延迟启动，确保页面加载完成
        setTimeout(() => {
            window.futuristicAnimations = new FuturisticAnimations();
            console.log('🌌 星汉灿烂 - 未来科技感动画系统已启动');
        }, 500);
    });

    // 导出到全局
    window.FuturisticAnimations = FuturisticAnimations;

})();
