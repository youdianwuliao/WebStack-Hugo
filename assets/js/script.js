class MatrixRain {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.drops = [];
        this.columnWidth = 80;
        this.texts = ['胡', '无', '人', '汉', '道', '昌', '明', '犯', '强', '汉', '者', '虽', '远', '必', '诛'];
        this.init();
        this.animate();
        window.addEventListener('resize', () => this.init());
    }

    init() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        const columns = Math.floor(this.canvas.width / this.columnWidth);
        this.drops = [];
        for (let i = 0; i < columns; i++) {
            this.drops[i] = Math.random() * -100;
        }
    }

    animate() {
        this.ctx.fillStyle = 'rgba(10, 10, 15, 0.1)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.font = 'bold 18px Orbitron';
        this.ctx.textAlign = 'center';
        
        for (let i = 0; i < this.drops.length; i++) {
            const char = this.texts[Math.floor(Math.random() * this.texts.length)];
            const x = i * this.columnWidth + this.columnWidth / 2;
            const y = this.drops[i] * 30;

            const colors = ['#7C3AED', '#F43F5E', '#00F5FF', '#A78BFA'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = color;
            this.ctx.fillStyle = color;
            this.ctx.globalAlpha = 0.5 + Math.random() * 0.3;
            this.ctx.fillText(char, x, y);

            if (y > this.canvas.height && Math.random() > 0.98) {
                this.drops[i] = 0;
            }
            this.drops[i] += 0.5;
        }

        this.ctx.globalAlpha = 1;
        this.ctx.shadowBlur = 0;
        requestAnimationFrame(() => this.animate());
    }
}

class NavigationApp {
    constructor() {
        this.sites = [];
        this.currentCategory = 'all';
        this.searchQuery = '';
        this.isLoading = true;
        this.currentEngine = {
            name: 'bing',
            url: 'https://www.bing.com/search?q='
        };
        this.categoryNames = {
            'all': '全部节点',
            '常用推荐': '常用推荐',
            'ai未来': 'AI未来',
            '科研办公': '科研办公',
            '丫丫喜欢玩游戏': '游戏天地',
            '开发设计': '开发设计',
            '影音视频': '影音视频',
            '网盘资源': '网盘资源'
        };
        this.init();
    }

    async init() {
        await this.loadData();
        this.bindEvents();
        this.render();
        this.startTimeDisplay();
        this.triggerRandomGlitch();
    }

    async loadData() {
        try {
            const response = await fetch('nav.json');
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            this.sites = data.navigation.reduce((acc, cat) => {
                if (cat.items && cat.items.length > 0) {
                    cat.items.forEach(item => {
                        acc.push({
                            ...item,
                            category: cat.category,
                            sidebarIcon: cat.sidebarIcon
                        });
                    });
                }
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
                this.updateCategoryTitle();
                this.render();
                this.triggerGlitch();
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

        const engineBtn = document.getElementById('search-engine-btn');
        const dropdown = document.getElementById('search-dropdown');
        
        engineBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });

        document.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const engine = item.dataset.engine;
                const url = item.dataset.url;
                const icon = item.querySelector('i').className;
                
                this.currentEngine = { name: engine, url: url };
                engineBtn.innerHTML = `<i class="${icon}"></i>`;
                
                document.querySelectorAll('.dropdown-item').forEach(d => d.classList.remove('active'));
                item.classList.add('active');
                
                dropdown.classList.remove('show');
            });
        });

        document.addEventListener('click', () => {
            dropdown.classList.remove('show');
        });
    }

    updateCategoryTitle() {
        const titleEl = document.getElementById('category-title');
        titleEl.textContent = this.categoryNames[this.currentCategory] || '全部节点';
    }

    startTimeDisplay() {
        const updateTime = () => {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            document.getElementById('time-display').textContent = `${hours}:${minutes}:${seconds}`;
        };
        updateTime();
        setInterval(updateTime, 1000);
    }

    triggerGlitch() {
        const overlay = document.getElementById('glitch-overlay');
        overlay.classList.add('active');
        setTimeout(() => overlay.classList.remove('active'), 300);
    }

    triggerRandomGlitch() {
        setInterval(() => {
            if (Math.random() > 0.97) {
                this.triggerGlitch();
            }
        }, 3000);
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
        } else {
            window.open(this.currentEngine.url + encodeURIComponent(query), '_blank');
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

    getCategoryIcon(category) {
        const icons = {
            '常用推荐': 'fa-star',
            'ai未来': 'fa-robot',
            '科研办公': 'fa-flask',
            '丫丫喜欢玩游戏': 'fa-gamepad',
            '开发设计': 'fa-tools',
            '影音视频': 'fa-play-circle',
            '网盘资源': 'fa-folder-open'
        };
        return icons[category] || 'fa-server';
    }

    render() {
        const container = document.getElementById('sites-container');
        const countEl = document.getElementById('node-count');

        if (this.isLoading) {
            container.innerHTML = `
                <div class="loading">
                    <i class="fas fa-cog"></i>
                    <p class="loading-text">LOADING_NODES...</p>
                </div>
            `;
            countEl.textContent = '[---]';
            return;
        }

        const sites = this.getFilteredSites();
        countEl.textContent = `[${String(sites.length).padStart(3, '0')}]`;

        if (sites.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <p class="empty-title">NODE_NOT_FOUND</p>
                    <p class="empty-sub">${this.searchQuery ? '尝试其他搜索指令' : '该分类下暂无节点'}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = sites.map(site => `
            <div class="site-card" onclick="window.open('${site.url}', '_blank')">
                <div class="site-card-header">
                    <div class="site-icon">
                        <img class="site-icon-img" src="${site.icon}" alt="${site.title}"
                             onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=\\'fas ${this.getCategoryIcon(site.category)}\\' style=\\'font-size:20px;color:var(--primary)\\'></i>'">
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
    const canvas = document.createElement('canvas');
    canvas.id = 'matrix-canvas';
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-2;opacity:0.4;';
    document.body.insertBefore(canvas, document.body.firstChild);
    
    new MatrixRain(canvas);
    new NavigationApp();
});