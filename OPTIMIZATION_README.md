# 站点说明与优化记录

纯静态站点，**无构建步骤**，源码即产物。

## 本地预览

```bash
python3 -m http.server 8080
```

或 `npm run serve`（`package.json` 仅有这一条脚本）。

## 当前架构要点

- CSS 内联在各页面，无独立构建流水线
- 图标放在 `assets/images/logos/`，命名一律 ASCII，单文件 ≤ 10KB（新增流程见 `NAV_ADDITION_GUIDE.md`）
- 离线缓存由 `sw.js` 的 `CACHE` 版本号控制，**改首页或核心页后必须递增该版本号**
- 站名/副标/印章方案与改名流程见 `BRANDING_PLAN.md`

## 依赖说明

- `scripts/optimize-images.js` 依赖 imagemin，**当前未安装、也未接入 npm scripts**，勿直接执行
- 图标压缩实际使用 sharp，用法见 `NAV_ADDITION_GUIDE.md`

## 历史优化记录

- 2026-03-03：删除未用 JS 库约 181KB、未用背景图 225KB，清理过旧 Xenon/jQuery/Bootstrap
