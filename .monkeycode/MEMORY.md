# 用户指令记忆

本文件记录了用户的指令、偏好和教导，用于在未来的交互中提供参考。

## 格式

### 用户指令条目
用户指令条目应遵循以下格式：

[用户指令摘要]
- Date: [YYYY-MM-DD]
- Context: [提及的场景或时间]
- Instructions:
  - [用户教导或指示的内容，逐行描述]

### 项目知识条目
Agent 在任务执行过程中发现的条目应遵循以下格式：

[项目知识摘要]
- Date: [YYYY-MM-DD]
- Context: Agent 在执行 [具体任务描述] 时发现
- Category: [运维部署 | 构建方法 | 测试方法 | 排错调试 | 工作流协作 | 环境配置]
- Instructions:
  - [具体的知识点，逐行描述]

## 去重策略
- 添加新条目前，检查是否存在相似或相同的指令
- 若发现重复，跳过新条目或与已有条目合并
- 合并时，更新上下文或日期信息
- 这有助于避免冗余条目，保持记忆文件整洁

## 条目

[新增导航链接工作流]
- Date: 2026-06-05
- Context: 导航网站添加新链接时的标准流程
- Instructions:
  1. **自动执行**：用户输入"新增链接"+URL 时，直接执行工作流，不要反问或确认
  2. **选择分类**：分析新链接的类型，选择合适的现有分类添加（不要新建分类）
  3. **下载图标**：
     - 下载图标到 `assets/images/logos/` 目录
     - 命名规范：`{网站名}.png` 或 `{网站名}_icon.png` 或 `{网站名}.svg`
     - 检查文件大小：必须 ≤ 10KB
     - 大于 10KB 必须压缩：
       ```bash
       node -e "const sharp = require('sharp'); sharp('input.png').resize(64, 64).jpeg({quality: 75}).toFile('output.png');"
       ```
  4. **编辑 nav.json**：在对应分类的 `items` 数组**末尾**添加新项（不放到第一项）
  5. **测试预览**：
     - 启动服务器：`python3 -m http.server 8080`
     - 检查新链接是否正常显示
     - 检查图标是否正确加载
  6. **提交推送**：
     ```bash
     git add nav.json assets/images/logos/{新图标文件}
     git commit -m "feat: 新增{网站名}导航链接"
     git push
     ```

[导航链接工作流 - 自动执行原则]
- Date: 2026-06-11
- Context: 用户首次输入新增链接时未自动执行的问题反思
- Instructions:
  - 当用户输入包含"新增链接"+URL 时，**立即自动执行完整工作流**
  - 不要反问用户"希望如何处理"或"需要我做什么"
  - 不要先访问网页分析内容再询问
  - 直接按记忆中的流程执行：分类选择 → 图标下载 → 编辑 JSON → 测试 → 提交

[新增导航位置 - 模块末尾]
- Date: 2026-08-06
- Context: 新增 AiToEarn 导航链接时用户明确要求
- Instructions:
  - 新增导航内容必须放到所属分类模块的**最后一项**，不要插入到第一项位置

[图标下载老问题 - 每次必现]
- Date: 2026-06-11
- Context: 新增 MuleRun 链接时再次遇到图标损坏问题
- Instructions:
  - **SVG 文件处理**：从网站下载的 SVG 文件经常损坏或格式不正确，下载后必须验证
  - **验证方法**：使用 `head` 命令查看文件开头，正常 SVG 应以 `<?xml` 或 `<svg` 开头
  - **备选方案**：优先下载 favicon.ico 或 PNG 格式图标
  - **快速修复流程**：
    1. 如果 SVG 损坏，改下载 favicon：`curl -sL "https://域名/favicon.ico" -o 图标文件.png`
    2. 更新 nav.json 中的 icon 路径为新文件名
    3. 删除损坏的 SVG 文件
  - **推荐优先级**：PNG > ICO > SVG（SVG 容易出问题）

[图标压缩工具]
- Date: 2026-06-05
- Context: 导航网站图标处理工具
- Category: 构建方法
- Instructions:
  - 使用 sharp 库压缩图标：
    ```bash
    npm install sharp --no-save  # 安装依赖
    node -e "const sharp = require('sharp'); sharp('input.png').resize(64, 64).jpeg({quality: 75}).toFile('output.png');"
    ```
  - 检查文件大小：
    ```bash
    ls -lh assets/images/logos/*.png | awk '{print $9, $5}'
    ```
  - 查找大于 10K 的文件：
    ```bash
    find assets/images/logos -type f -name "*.png" -exec ls -lh {} \; | awk '$5 ~ /K/ && int($5) > 10'
    ```

[导航网站项目结构]
- Date: 2026-06-05
- Context: 项目基础信息
- Category: 环境配置
- Instructions:
  - 项目类型：静态导航网站（纯 HTML/CSS/JS，无框架依赖）
  - 技术栈：HTML/CSS/JavaScript + 内联 SVG 图标
  - 数据源：`nav.json` 存储所有导航链接
  - 图标目录：`assets/images/logos/`
  - 本地预览：`python3 -m http.server 8080`
  - 离线缓存：`sw.js` Service Worker
  - 分支：`staticV4`

[记忆文件持久化 - 存放在 git 仓库内]
- Date: 2026-08-08
- Context: 用户提示当前环境是容器（非物理机器），/workspace 数据可能随容器重置丢失
- Instructions:
  - 记忆文件（MEMORY.md 等）必须存放在 git 仓库内（`/workspace/.monkeycode/MEMORY.md`），并随代码一起 commit + push 到远程，保证容器重置后仍可从远程恢复
  - 不要只依赖容器本地文件系统或 `/tmp` 等临时目录保存重要记忆/产物
  - 每次在 MEMORY.md 新增或更新条目后，及时 `git add .monkeycode/MEMORY.md && git commit && git push` 同步到远程

[电子书站点构建 - 毛选模式]
- Date: 2026-08-06
- Context: Agent 将《吴氏石头记》txt 整理成 shiji 电子书站点时发现
- Category: 构建方法
- Instructions:
  - 电子书阅读站的统一模式（参考 `maoxuan/`、`shiji/`）：
    - 独立子目录，`index.html` 目录页 + 每篇/每回一个 HTML 文件
    - 正文页复用 `gushi/gushi.css` 和 `gushi/gushi.js`，分页导航用 `.pager`（prev/next）
    - 目录页内联样式，引用 `../assets/favicon.svg`，并含 JSON-LD Book 结构化数据
    - 完成后需在首页 `index.html` 的 `.seo-links` 中加入口，并在 `sitemap.xml` 追加页面
    - 文件名规范：`maoxuan` 用 `volX-YY.html`，`shiji` 用 `hXXX.html`
  - **共享资源**：所有子站正文页（gushi/maoxuan/shiji/jiashen/nanmingshi 共 436 页）都复用 `gushi/gushi.css` + `gushi/gushi.js`，改一处全局生效；各站目录页 `index.html` 是独立内联样式
  - **阅读增强**（gushi.css/js 内已实现）：正文页自动带顶部阅读进度条 + 字号调节（A-/A+）+ 字体切换（宋/楷/黑），偏好存 localStorage；gushi.js 会用 `bookVisited_{子站名}` 记录访问足迹，供目录页统计已读进度

[中文图标生成 - 容器字体缺失]
- Date: 2026-08-08
- Context: Agent 生成南明史中文图标时发现环境限制
- Category: 环境配置
- Instructions:
  - 本容器无中文字体、无 ImageMagick/matplotlib、无 headless 浏览器，PIL 直接渲染中文会失败
  - 生成含中文的图标前先下载字体：`curl -sL -o /tmp/opencode/fonts/fandol-song.otf "https://mirrors.tuna.tsinghua.edu.cn/CTAN/fonts/fandol/FandolSong-Regular.otf"`，再用 `ImageFont.truetype(路径, 字号)` 加载绘制
  - 验证图标渲染是否成功：检查 PNG 中心区域是否有白色（文字）像素分布

[本地工具子站构建模式]
- Date: 2026-08-13
- Context: Agent 新增 JSON/二维码/Markdown/编码加密/图片 五个本地工具子站时发现
- Category: 构建方法
- Instructions:
  - 工具子站独立目录（`json/`、`qrcode/`、`markdown/`、`encode/`、`image/`），单文件 `index.html`，自包含内联 CSS/JS + 主题切换（dark/light 存 localStorage）
  - 新增工具子站后必须同步修改：`nav.json`（新分类或分类 items）、`sw.js`（CORE 缓存列表 + 升级 CACHE 版本号）、首页 `index.html` 的 `.seo-links`、`sitemap.xml`
  - **CSP 关键限制**：站点 `_headers` 的 CSP 为 `script-src 'self' 'unsafe-inline'`（无 `unsafe-eval`），工具代码禁止使用 `eval`/`new Function`/`Function()`，否则部署到 Cloudflare Pages 后会被 CSP 拦截
  - 第三方 JS 库必须下载到本地子站目录（CDN 会被 CSP `'self'` 拦截）
  - **去依赖策略（2026-08-13 定稿）**：允许使用三方库但注意版权合规；三方库必须本地化（不能引 CDN），若上游变化本地文件仍可继续使用。已用自研替换并删除：`qrcode-generator.js`（自研 `qr-encoder.js` 兼容 `window.qrcode()` API）、`marked.min.js`（自研渲染器暴露 `window.markdownParse()`）；仅保留 `jsqr.js`（图像解码，自研不现实，footer 已注明来源）
  - **新站技术选型**：`encode/` 用 Web Crypto 原生实现 RSA-OAEP（PEM 编解码自写）+ 自研 MD5（Web Crypto 无 MD5）；`image/` 全 canvas 处理，证件照用四角取色 + 颜色距离阈值做背景替换
  - 内联 JS 语法验证方法：`node -e "new Function(script)"`；函数引用完整性检查：提取所有 `onclick/onchange/oninput` 引用的函数名，与文件内 `window.xxx=` 声明比对（旧站用 IIFE 内 `function xxx(){}`，新站统一 `window.xxx=`）
   - **嵌入自研脚本陷阱**：`python .replace('</body>', ...)` 会误替换 JS 字符串字面量里的 `</body>`（如导出模板 `'...'+body+'\n</body>\n</html>'`），破坏字符串；正确做法是锚定文件末尾真实的 `</script>\n</body>\n</html>`，先剥离末尾 `</html>` 再拼接，且自研脚本内不得含 `</script>` 字面量

[canvas 大图处理边界 - 排错知识]
- Date: 2026-08-15
- Context: Agent 修复图片水印/裁剪"结果裂开"反馈时发现（2026-08-15 补充裁剪与证件照）
- Category: 排错调试
- Instructions:
  - **canvas 超限根因**：`canvas.toBlob` 在 canvas 尺寸超过浏览器限制（Chrome 面积上限约 16384×16384，经验阈值 3200 万像素内安全）时回调返回 `null`；对 `null` 调 `URL.createObjectURL(null)` 会抛 TypeError，中断后续代码 → 结果图 src 设置失败（显示裂开）、下载按钮逻辑卡死
  - **统一解法**：`image/` 站所有产出 canvas 的路径（水印 `makeCanvas(img)` 工厂、裁剪 `doCrop`、证件照临时画布 tmp）都按 `MAX_PIXELS=32000000` 等比缩放后再绘制（`scale=Math.min(1,Math.sqrt(MAX_PIXELS/(w*h)))`），缩放时 toast 提示；对 null blob 做兜底提示，禁止对 null 调 `URL.createObjectURL`
  - **裁剪框显示错位根因**：`.stage img` 有 `max-height:460px`，而旧 `initCrop` 的 `scale=min(1,560/max(natW,natH))` 在竖图时显示高度可达 560 > 460，img 被 CSS 压缩后与裁剪框 boxEl 尺寸不一致 → 裁剪框盖错位置（视觉"裂开"）；正确做法：`scale=min(1,(stage.clientWidth-2)/natW,456/natH)`，保证显示尺寸不触发 CSS 约束，且窄屏不溢出
  - **扩展名剥除陷阱**：`wmData.fileName=f.name.replace(/\.[^.]+$/,'')` 已去掉扩展名，后续再 `.match(/\.(jpg|jpeg)$/i)` 判断格式恒为 false；需另存 `wmData.origName=f.name` 用于格式判断，`fileName` 只作下载前缀
  - **验证方法**：puppeteer + `http://localhost` 实测（file:// 亦可）；下载验证用 CDP `Browser.setDownloadBehavior` 指定下载目录后点按钮，再对下载文件与原始输入做像素差分（>40 阈值计数）确认已绘制
