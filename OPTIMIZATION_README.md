# 静态导航网站

纯静态站点，无构建步骤。本地预览：

```bash
python3 -m http.server 8080
```

或 `npm run serve`（`package.json` 仅有这一条脚本）。

`scripts/optimize-images.js` 依赖 imagemin，当前未安装、也未接入 npm scripts。图标压缩用 sharp，见 `NAV_ADDITION_GUIDE.md`。
