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
   - **视频GIF 集成 FFmpeg.wasm（2026-08-20）**：`image/` 站视频转 GIF 改用 FFmpeg.wasm，资源已本地化到 `image/ffmpeg/`（`@ffmpeg/ffmpeg@0.12.15` + `@ffmpeg/util@0.12.2` + `@ffmpeg/core@0.12.10` esm 版，约 31MB）；`@ffmpeg/core@0.12.10` 实测**支持 HEVC(H.265) 解码**；转 GIF 命令：`-i in -ss S -t D -filter_complex "fps=N,scale=W:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=256[p];[b][p]paletteuse=dither=sierra2_4a" -loop 0|-1 out.gif`（`-loop 0`=无限循环含 NETSCAPE 扩展，`-loop -1`=单次）
   - **CSP 新增 `'wasm-unsafe-eval'`**：`_headers` 的 `script-src 'self' 'unsafe-inline'` 已加 `'wasm-unsafe-eval'`（Emscripten/FFmpeg.wasm 编译 wasm 必需）；@ffmpeg/ffmpeg 用同源文件 URL 建 worker（`new URL('./worker.js', import.meta.url)`），`worker-src 'self'` 足够，**无需放宽 blob:**；加载核心时 coreURL/wasmURL 用基于 `document.baseURI` 的绝对相对路径，不用 toBlobURL
   - **FFmpeg.wasm 在 node 中验证的桩**：esm 版 ffmpeg-core.js 顶层引用 `self`/`location`，node 实测需注入 `globalThis.self=globalThis; globalThis.location={href:'file://...'}`；wasm 用 `wasmBinary` 直接传入可跳过 fetch；core 的 `exec(...args)` 需展开参数（非数组），结果读 `ffmpeg.ret`
    - **嵌入自研脚本陷阱**：`python .replace('</body>', ...)` 会误替换 JS 字符串字面量里的 `</body>`（如导出模板 `'...'+body+'\n</body>\n</html>'`），破坏字符串；正确做法是锚定文件末尾真实的 `</script>\n</body>\n</html>`，先剥离末尾 `</html>` 再拼接，且自研脚本内不得含 `</script>` 字面量

[FFmpeg.wasm wasm 加载 "BufferSource argument is empty" 排错]
- Date: 2026-08-27
- Context: Agent 排查 `image/` 视频转 GIF 生成失败（`RuntimeError: Aborted(CompileError: WebAssembly.instantiate(): BufferSource argument is empty)`）时发现
- Category: 排错调试
- Instructions:
  - **真正根因**：该错误 = Emscripten 实例化 wasm 时拿到 0 字节 buffer。根因是 `image/index.html` 的 vgLoadFFmpeg 用 `chain=chain.then((function(idx){ return fetchPart(idx, cb).then(cb2); })(k))` 把 **promise 传给了 `.then()`**（参数非函数被当 undefined 忽略），导致分片下载链与 chain 解耦：chain 立即 resolve，`blobs` 还是空数组 → 合并出 0 字节 wasm；旧代码把它做成空 blob URL 交给 worker 编译 → `BufferSource argument is empty`；新代码 `if(!total)throw` 抛"数据为空"，但 catch 提示随后又被后台仍在下载的 onBytes 进度（99%）覆盖，表现"卡在 99%"
  - **修复**：IIFE 必须返回**函数**再传给 `.then()`，即 `chain=chain.then((function(idx){ return function(){ return fetchPart(idx, cb).then(cb2); }; })(k))`，让下载链按序等待每个分片完成后再合并；浏览器实测 2 个分片完整合并（32232419 bytes）后 `ffmpeg.load` resolve、转 GIF 成功
  - **可靠性增强（非根因）**：主线程合并分片为 `Uint8Array` 后经 `ffmpeg.load({ coreURL, wasmBinary: merged })` 直传 worker（跳过 blob URL + worker fetch 链路）；`image/ffmpeg/worker.js` 透传 `wasmBinary`，`image/ffmpeg/classes.js` 把 `wasmBinary.buffer` 加入 transfer 数组减少 postMessage 拷贝
  - **sw.js 缓存陷阱**：sw.js 用 stale-while-revalidate 缓存 `./image/index.html`，部署后若不递增 `CACHE` 版本号，用户仍从缓存拿到旧代码、修复不生效；改 index.html 类关键页面必须同步 bump `CACHE`（v18→v19）
  - **验证**：node 模拟完整链路（合并 → wasmBinary → createFFmpegCore → `exec('-version')` 返回 0）；playwright + chromium headless shell 本地服务器实测上传 test.mp4 → 生成 240px/30 帧 100KB GIF 成功；线上分片与本地 md5 一致、HEAD/GET 正常
   - **FFmpeg.wasm 加载依赖注入**：测试需 `globalThis.self=globalThis; globalThis.location={href:'file:///...'}`；esm 版 ffmpeg-core.js 为 `export default createFFmpegCore`，`await ffmpeg.ready` 后 `exec` 需展开参数、结果读 `ffmpeg.ret`

[GIF 去水印（逐帧 inpaint + palette 合成）排错知识]
- Date: 2026-08-27
- Context: Agent 实现 `image/` GIF 去水印功能（单色半透明水印逐帧本地修复）时发现
- Category: 排错调试
- Instructions:
  - **流程**：`vgLoadFFmpeg` 单例加载 → `writeFile` 源 GIF → `exec(['-i','in.gif','-vsync','0','f_%03d.png'])` 拆帧 → 逐帧 `readFile` → 转 ImageData → `localInpaint` → `putImageData` → `toBlob` PNG → `writeFile('n_XXX.png')` → `exec` palettegen/paletteuse 合成动画 GIF（`-framerate F -i n_%03d.png -filter_complex 'split[a][b];[a]palettegen=max_colors=256[p];[b][p]paletteuse' -loop 0`），动画帧数保留
  - **主线程 `FFmpeg` 类实例没有 `FS` 属性**：文件系统操作必须用 `writeFile/readFile/deleteFile/listDir`（走 postMessage），不能用 `ffmpeg.FS.*`；`listDir('/')` 返回 node 数组
  - **writeFile 会 transfer 传入的 Uint8Array.buffer 给 worker → 原 buffer 被 detach**：同一份数据要写多次（解析+修复各写一次源 GIF）时必须传副本 `new Uint8Array(orig)`，否则二次写报 `An ArrayBuffer is detached and could not be cloned`
  - **localInpaint 对封闭涂抹区域失效的根因**：原实现 `todo` 数组只覆盖 mask 区域（内部像素全为 1），边界像素朝外越界、朝内邻居未填充，n 恒为 0 → 永不填充（涂抹矩形整块时水印毫无变化）。修复：`todo` 用 `(bw+2)*(bh+2)` 尺寸，mask 区域偏移 1，外围边框默认为 0 作为"外部可取色种子"，扩散从边框逐层向内
  - **清理函数不能删源帧**：若 `nomarkGifClearFrames` 连 `f_*.png` 一起删，随后逐帧 `readFile('f_XXX.png')` 报 `ErrnoError: FS error`；修复流程应在开头清理后**重新写源 GIF 并拆帧**，保持自洽
  - **浏览器端验证**：playwright 上传带水印 GIF → 涂抹矩形（fillRect mask）→ 点击修复 → 下载产物；ffmpeg.wasm node 桩验证输出帧数不变、水印区平均 RGB 由纯红变为填充色（testsrc drawbox red@0.9 水印 16,16 64×32）
  - **线上 wasm 加载 HTML 报错（magic word ... found 3c 21 44 4f）的根因与防护**：`<!DO` = HTML DOCTYPE。线上 wasm 单文件 `ffmpeg-core.wasm` 不存在（31MB > Cloudflare Pages 25MB 单文件限制，只能分片），core.js 的 `getBinary` 仅在 `Module.wasmBinary` 缺失时兜底 fetch 单文件 → 404 HTML → instantiate 报错。若 SW 缓存了旧版 classes.js/worker.js（wasmBinary 传递是 commit 2561671 才加的），wasmBinary 不传 → 触发兜底 fetch。防护：① sw.js fetch handler 排除 `/image/ffmpeg/`（不缓存不拦截，体积大更新频繁）；② 分片 URL 加版本参数 `?v=2` 绕过 HTTP 缓存；③ wasm 编译错误时自动清 `navsite*` 缓存并提示硬刷新（自愈）；④ worker.js 在 wasmBinary 缺失时直接抛中文报错而非让 core 去 fetch
  - **大图静态去水印性能与反馈**：`localInpaint` 是逐迭代同步扫描涂抹包围盒的算法（800 次上限，实测 mask 收敛迭代数 ≈ 中心到边框最短距离 ≈ min(bw,bh)/2）。大图（如 1200×1200 + 大涂抹区域）同步执行会冻结 UI 数秒到数十秒，用户感知为"一键修复没反应"。修复：新增 `localInpaintAsync`（相同算法、40 迭代/片分片 + `setTimeout(0)` 让出主线程 + 进度回调），静态图路径按钮实时显示"修复中 x%"；GIF 逐帧路径仍用同步版。headless 测试若异常慢是后台标签页 timer throttle（禁用 `--disable-background-timer-throttling` 后正常）

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
