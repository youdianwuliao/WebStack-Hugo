# 导航链接新增规范

## 执行流程

每次新增导航链接时，**必须按顺序执行以下步骤**：

### 1. 选择分类
- 分析新链接的类型和主题
- 在 `nav.json` 中找到最匹配的**现有分类**
- **禁止新建分类**，除非确实没有合适的分类

### 2. 下载并压缩图标
```bash
# 下载图标
curl -sL "图标 URL" -o assets/images/logos/{网站名}.png

# 检查大小
ls -lh assets/images/logos/{网站名}.png

# 如果 > 10KB，必须压缩
node -e "const sharp = require('sharp'); sharp('assets/images/logos/{网站名}.png').resize(64, 64).jpeg({quality: 75}).toFile('assets/images/logos/{网站名}_icon.png');"
```

**要求**：
- 图标必须下载到 `assets/images/logos/` 目录
- 文件大小必须 ≤ 10KB
- 命名规范：`{网站名}.png` 或 `{网站名}_icon.png`

### 3. 编辑 nav.json
在对应分类的 `items` 数组第一项位置添加：
```json
{
  "title": "网站名称",
  "icon": "/assets/images/logos/{图标文件}",
  "url": "https://example.com/",
  "description": "简短描述"
}
```

### 4. 测试预览
```bash
# 启动服务器
python3 -m http.server 8080

# 验证页面加载正常，新链接和图标显示正确
```

### 5. 提交推送
```bash
# 添加文件
git add nav.json assets/images/logos/{新图标文件}

# 提交
git commit -m "feat: 新增{网站名}导航链接"

# 推送
git push
```

---

## 快速命令参考

```bash
# 检查所有图标大小
ls -lh assets/images/logos/*.png | awk '{print $9, $5}'

# 查找大于 10K 的图标
find assets/images/logos -type f -name "*.png" -exec ls -lh {} \; | awk '$5 ~ /K/ && int($5) > 10'

# 压缩单个图标
node -e "const sharp = require('sharp'); sharp('input.png').resize(64, 64).jpeg({quality: 75}).toFile('output.png');"

# 查看分类列表
node -e "const nav = require('./nav.json'); nav.navigation.forEach((c, i) => console.log((i+1) + '. ' + c.category));"
```

---

**最后更新**: 2026-06-05
