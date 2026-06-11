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
  4. **编辑 nav.json**：在对应分类的 `items` 数组中添加新项
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
  - 项目类型：静态导航网站（WebStack-Hugo 主题）
  - 技术栈：HTML/CSS/JavaScript + Bootstrap 4
  - 数据源：`nav.json` 存储所有导航链接
  - 图标目录：`assets/images/logos/`
  - 本地预览：`python3 -m http.server 8080`
  - 分支：`staticV4`
