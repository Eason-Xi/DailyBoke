# R2 验证记录 · 2026-10-27

## 已完成

- Cloudflare 插件已安装。最初通过官方 Wrangler 4.152.0 完成联调；随后连接器工具加载完成，已核对连接器与 Wrangler 是同一账号，并读回确认媒体 Worker 的绑定和公开路由。
- 通过官方浏览器 OAuth 完成登录，并由 Wrangler 使用 OS keyring 保存凭据。项目没有读取、复制或输出 OAuth token。
- 确认账号已开通 R2；创建专用桶 `dailyboke-podcast-audio`，保留账号原有两个桶。
- 已部署只读媒体 Worker `dailyboke-media`，地址为 `https://dailyboke-media.wangfugui1799.workers.dev`。未购买/绑定自有域名，未执行付费套餐升级；Cloudflare 返回的 usage_model 为 standard，不等同于已经确认账单套餐。
- 一秒静音测试对象（16,044 字节）与一份当时已发布的 DeepSeek 音频（1,313,324 字节）均完成真实上传、完整文件读回、内容核对和公开 Range 校验。
- 实测已发布音频公开地址：HEAD `200`、`Content-Type: audio/wav`、`Content-Length: 1313324`、`Accept-Ranges: bytes`；GET `Range: bytes=1000-1999` 返回 `206`、`Content-Range: bytes 1000-1999/1313324` 和 1,000 字节。
- 最初试传未改变节目记录；之后只将当前已发布的 DeepSeek 音频迁移到 `published/episodes/` 前缀和 Worker 地址，保留原始音频、文稿及发布状态。其余节目状态未修改，没有调用 MiMo 或发布新稿。
- 已关闭该桶的 r2.dev 公开访问，外部只通过只读 Worker 获取已发布前缀。写入方法返回 405，私有路径和旧测试目录返回 404，越界 Range 返回 416。

已验证的音频地址：

[DeepSeek 稳定媒体地址](https://dailyboke-media.wangfugui1799.workers.dev/published/episodes/episode-2026-10-26-deepseek-v4-1-flash-1017/cdceb06e7de037aeb0e2ce557070d555ac84a81a1cfea6e3dc40e99964e6aced.wav)

音频实际时长 27.36 秒，节目及 RSS 使用 27 秒，未沿用旧长稿时长。Cloudinary 备选连接也已由根任务完成一次相同已发布音频的试传与 206 验证，仅作为连接测试，没有切换主存储方案。

## 代码验证

28 项测试覆盖 S3 上传/HEAD/完整校验、Wrangler 远程上传与读回、Range/HEAD/416 预览、访问控制、媒体网关前缀、真实 enclosure 长度、稳定 HTTPS RSS 地址、临时签名 URL 拒绝、上传失败保持原状态、修订/回退、回收站/恢复，以及合成或上传期间编辑的并发保护。类型检查、Lint、Worker 类型/部署预检与应用生产构建通过。本地 RSS 已包含 Worker HTTPS 地址和准确的 1,313,324 字节 enclosure。

应用已按本机配置启用 Wrangler 上传模式。新 MiMo 音频在本机私有目录生成预览，用户明确发布后才上传 R2。服务器部署可以切换为限权 S3 模式；配置与默认 dry-run 的迁移入口见 [存储说明](r2-storage.md)。

## 仍未完成

- 自有媒体域名是可选项：当前个人播客已可用 workers.dev，无需先购买域名；更高流量或业务关键使用时再评估域名与适合的套餐。没有新增付费订阅。
- 独立服务器的 S3 Access Key / Secret：本机 OAuth 上传已工作，因此它们不是本机开发的阻塞。迁移到没有本机 Wrangler 登录的服务器时再配置。
- 其余既有音频没有批量迁移。一份已发布节目已完成媒体地址切换，公开快照已同步；GitHub Pages 更新仅需发布该公开快照。
