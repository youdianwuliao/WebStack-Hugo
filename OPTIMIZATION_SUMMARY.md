# 优化记录（历史）

2026-03-03 清理过旧 Xenon/jQuery/Bootstrap 与未用背景图。

当前站点：
- CSS 内联在各页面，无独立构建流水线
- 图标在 `assets/images/logos/`，单文件 ≤ 10KB
- 离线缓存由 `sw.js` 的 `CACHE` 版本号控制，改首页或核心页后必须递增
- 本地预览：`python3 -m http.server 8080`
