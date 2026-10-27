# GitHub Pages 公开版本

这份 Next.js 静态导出与根目录的本地全栈 app 分开构建。它只有首页、往期、节目详情和 RSS；不包含审核台、写入 API、凭据或完整内容数据库。

公开数据来自经审查后提交的 `content/episodes.json` 快照。只有本地状态为 `published` 的当前版本会进入快照；编辑备注、待发布修订、历史版本、已下架/回收站内容和本地存储信息均不导出。工作流不会自动读取最新本地私有数据创建快照。

更新公开内容：

```bash
# 在仓库根目录运行；该命令不会发布/恢复/修改任何本地节目状态。
npx tsx scripts/sync-pages.ts
# 审查公开快照 diff 和引用的音频，再提交、推送。
git diff -- pages-site/content/episodes.json
npm ci --prefix pages-site
npm --prefix pages-site run build
```

构建会只复制快照引用的已发布音频到生成目录 `public/audio/`，并验证文件大小、RSS 绝对链接、`/DailyBoke/` 路径及输出中没有私有路由/字段。它不会修改或删除根目录的原始音频。新上传 R2 的已发布音频可直接保留稳定 HTTPS URL，无需复制。

输出目录：`pages-site/out/`。GitHub Actions 始终构建并提供 `dailyboke-public-site` 下载产物；只有仓库已启用 Pages 时才部署，所用权限分别是构建 `contents: read`/`pages: read` 与部署 `pages: write`/`id-token: write`。

DeepSeek 这一期已发布音频使用 R2 只读媒体 Worker 的稳定 HTTPS 地址；无需购买媒体域名。构建不会把云端音频再复制进 Pages，RSS 直接使用这个链接及真实字节长度。其他节目仍可使用 Pages 上的现有音频。

公开地址：`https://eason-xi.github.io/DailyBoke/`。Pages 已启用，站点会在工作流成功部署后更新。

仓库 `Eason-Xi/DailyBoke` 已由用户于 2026-10-27 授权改为公开，GitHub Pages 使用 GitHub Actions 发布。若以后改回私有，需要确认账号套餐支持私有仓库 Pages。

用户完成选择后，在 GitHub 仓库的 **Settings → Pages → Build and deployment → Source → GitHub Actions** 启用，再在 Actions 中手动运行 **Build and deploy public podcast** 即可。公开站点没有管理入口；编辑和 MiMo 合成继续在本机运行 `npm run dev` 使用。
