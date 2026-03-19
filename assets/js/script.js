class ParticleBackground {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.particleCount = 60;
        this.mouse = { x: null, y: null };

        this.resize();
        this.init();
        this.animate();

        window.addEventListener('resize', () => this.resize());
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    init() {
        this.particles = [];
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                size: Math.random() * 2 + 0.5,
                color: Math.random() > 0.5 ? '#00ff9d' : '#00d4ff'
            });
        }
    }

    randomColor() {
        const colors = ['#00ff9d', '#00d4ff', '#ff006e', '#ffff00'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    animate() {
        this.ctx.fillStyle = 'rgba(13, 13, 13, 0.15)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.particles.forEach((p, i) => {
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0 || p.x > this.canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > this.canvas.height) p.vy *= -1;

            if (this.mouse.x && this.mouse.y) {
                const dx = this.mouse.x - p.x;
                const dy = this.mouse.y - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 100) {
                    p.x -= dx * 0.02;
                    p.y -= dy * 0.02;
                }
            }

            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color;
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = p.color;
            this.ctx.fill();

            for (let j = i + 1; j < this.particles.length; j++) {
                const p2 = this.particles[j];
                const dx = p.x - p2.x;
                const dy = p.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 100) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(p.x, p.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    this.ctx.strokeStyle = `rgba(0, 255, 157, ${0.15 - dist / 700})`;
                    this.ctx.lineWidth = 0.5;
                    this.ctx.stroke();
                }
            }
        });

        requestAnimationFrame(() => this.animate());
    }
}

class NavigationApp {
    constructor() {
        this.sites = [];
        this.currentCategory = 'all';
        this.searchQuery = '';
        this.isLoading = true;
        this.init();
    }

    async init() {
        await this.loadData();
        this.bindEvents();
        this.render();
    }

    async loadData() {
        try {
            const response = await fetch('nav.json');
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            this.sites = data.navigation.reduce((acc, cat) => {
                cat.items.forEach(item => {
                    acc.push({
                        ...item,
                        category: cat.category,
                        sidebarIcon: cat.sidebarIcon
                    });
                });
                if (cat.subcategories) {
                    cat.subcategories.forEach(sub => {
                        sub.items.forEach(item => {
                            acc.push({
                                ...item,
                                category: cat.category,
                                sidebarIcon: cat.sidebarIcon,
                                subcategory: sub.name
                            });
                        });
                    });
                }
                return acc;
            }, []);
            this.isLoading = false;
        } catch (error) {
            console.error('Failed to load nav.json:', error);
            this.isLoading = false;
        }
    }

    bindEvents() {
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentCategory = btn.dataset.category;
                this.render();
            });
        });

        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.trim();
            this.render();
        });
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });

        document.getElementById('search-btn').addEventListener('click', () => this.handleSearch());
    }

    handleSearch() {
        const query = this.searchQuery;
        if (!query) return;

        const matched = this.sites.find(site =>
            site.title.toLowerCase().includes(query.toLowerCase()) ||
            site.description.toLowerCase().includes(query.toLowerCase())
        );

        if (matched && matched.url) {
            window.open(matched.url, '_blank');
        }
    }

    getFilteredSites() {
        let filtered = this.sites;

        if (this.currentCategory !== 'all') {
            filtered = filtered.filter(site => site.category === this.currentCategory);
        }

        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(site =>
                site.title.toLowerCase().includes(query) ||
                site.description.toLowerCase().includes(query)
            );
        }

        return filtered;
    }

    render() {
        const container = document.getElementById('sites-container');

        if (this.isLoading) {
            container.innerHTML = `
                <div class="loading" style="grid-column: 1/-1;">
                    <i class="fas fa-spinner"></i>
                    <p style="margin-top: 15px;">加载中...</p>
                </div>
            `;
            return;
        }

        const sites = this.getFilteredSites();

        if (sites.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 80px 20px; color: var(--text-dim);">
                    <i class="fas fa-folder-open" style="font-size: 48px; margin-bottom: 20px; opacity: 0.3;"></i>
                    <p style="font-size: 16px;">没有找到匹配的导航</p>
                    ${this.searchQuery ? '<p style="font-size: 13px; margin-top: 10px; opacity: 0.6;">尝试其他关键词</p>' : ''}
                </div>
            `;
            return;
        }

        container.innerHTML = sites.map(site => `
            <div class="site-card" onclick="window.open('${site.url}', '_blank')">
                <div class="site-card-header">
                    <div class="site-icon">
                        <img class="site-icon-img" src="${site.icon}" alt="${site.title}"
                             onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=\\'fas fa-globe\\' style=\\'font-size:20px;color:var(--primary)\\'></i>'">
                    </div>
                    <div class="site-title">${site.title}</div>
                </div>
                <div class="site-desc">${site.description}</div>
                <span class="category-tag">${site.category}</span>
            </div>
        `).join('');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ParticleBackground(document.getElementById('bg-canvas'));
    new NavigationApp();
});
