# R2 音频存储

代码已接入 R2 S3 兼容 API 和官方 Wrangler OAuth 上传。2026-10-27 已完成真实上传、完整文件读回、公开 HTTPS Range 播放校验，包括一份当前已发布的 DeepSeek 音频；试传没有修改节目记录或现有播放链接。

当前本机使用 `AUDIO_STORAGE_PROVIDER=r2`、`R2_UPLOAD_MODE=wrangler`，专用桶为 `dailyboke-podcast-audio`，公开地址为 `https://dailyboke-media.wangfugui1799.workers.dev`。这个只读网关无需购买自有域名，只开放 `published/episodes/` 中符合格式的音频 key。桶的 r2.dev 公开访问已关闭。新安装仍默认 local 模式，服务器部署推荐使用限权 S3 密钥。

## 行为

- 新 MiMo 音频先存入 `.local/audio/`，不再直接写入 `public/`。预览接口支持 GET/HEAD、单段 Range、后缀 Range、206 和 416，且禁止缓存。
- 明确点击发布、更新发布、重新发布或回退时，才把目标音频传入发布存储。选择 `r2` 后配置或上传失败会阻止状态更新，显示错误，不会偷偷改回本地模式。
- 发布使用内容哈希作为 key：`published/episodes/<episode-id>/<sha256>.wav`。S3 模式用 `If-None-Match: *` 防止覆盖；Wrangler 模式先检查对象，已存在时验证完整内容一致并复用，不覆盖不一致的对象。记录 provider、key、大小、时长、校验和及上传时间；保留本地原件。
- S3 上传后检查对象 HEAD 的大小、类型和 SHA-256 元数据；没有自定义校验元数据的旧对象会下载核验完整 SHA-256。Wrangler 模式通过官方 CLI 完整读回验证，不读取 OAuth 存储文件。两种模式都检查公开 HTTPS 地址的 Range、Content-Type、Content-Length 与对应字节。公开 URL 失败也不会发布。
- 网站播放器可使用相对本地 URL 或稳定 HTTPS URL；RSS 保留 HTTPS 地址并使用真实 enclosure 字节长度，不拼接出重复域名，也不写入临时签名链接。
- 下架和回收站仅改变目录公开性，保留音频。已经公开分发过的媒体 URL 可能仍被用户/播放器缓存，不能用下架来撤回已下载的音频。
- 此接入不自动迁移、重新配音或修改现有节目。旧版生成于 `public/audio/` 的预览仍保留原文件；只有以后生成的新预览采用私有目录。

## 在本机填写配置

本机已完成的 Wrangler 方式不需要额外创建或粘贴 S3 密钥。登录命令为 `npx wrangler login --scopes account:read user:read workers:write zone:read --use-keyring`；登录状态用 `npx wrangler whoami` 检查。应用只调用官方 CLI 并设置明确的账号，不读取、打印或复制其 OAuth token。跨机器部署时请使用下面的 S3 方式。

1. 在 Cloudflare R2 控制台创建一个**只存已发布节目**的桶；本机已创建 `dailyboke-podcast-audio`。
2. 为该桶创建 **Object Read & Write** 权限的 R2 API token，限定到这个桶。记录生成的 Access Key ID 和 Secret Access Key；不需要账户管理权限，也不是全局 API Key。
3. 公开媒体可以使用已部署的只读 Worker，无需购买域名；部署说明见 [媒体网关](../media-worker/README.md)。自有域名是可选项，业务增长后可再绑定。新预览始终留在本地私有目录。
4. 用本地编辑器打开项目 `.env`，从 `.env.example` 添加下列项。不要覆盖现有 MiMo 密钥，也不需要把密钥发到聊天。

```dotenv
AUDIO_STORAGE_PROVIDER=r2
R2_UPLOAD_MODE=s3
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_BASE_URL=https://dailyboke-media.wangfugui1799.workers.dev
```

`R2_ENDPOINT` 正常留空，默认 `https://<account-id>.r2.cloudflarestorage.com`，region 为 `auto`；有区域限制的桶可以填写官方对应的 EU/FedRAMP 端点。私有预览目录可用 `DAILYBOKE_PRIVATE_AUDIO_DIR` 指向持久磁盘。密钥只由服务端或本地 CLI 读取。

本机 Wrangler 方式将 `R2_UPLOAD_MODE` 设为 `wrangler`，其余只需账号 ID、桶和公开媒体地址；S3 Access Key/Secret 可以留空。此模式需要本地已安装 Wrangler 并完成登录，适合当前单机审核服务。

仅测试时可用桶的 `https://pub-….r2.dev` 地址，并额外设 `R2_ALLOW_DEV_PUBLIC_URL=1`。当前已经切换到只读 Worker，`R2_ALLOW_DEV_PUBLIC_URL=0`；自有域名不是接入音频的前置条件。workers.dev 适合当前个人播客，受账号 Workers 请求与 CPU 配额约束；业务关键或更高流量可再使用自有域名和适合的套餐，不自动升级。

本地服务默认监听 `127.0.0.1`。将完整后台部署到外网时，必须设置 `REVIEW_ACCESS_TOKEN`，浏览器登录用户名为 `review`、密码为该值。它保护 `/review`、审核写入 API、全部节目 API 和新私有音频接口；生产模式没有配置会拒绝这些请求。公开 GitHub Pages 版本完全不包含这些路由。

只读 Worker 已设置 GET/HEAD 与 Range 的公开 CORS 响应。若未来绕过 Worker、改为桶绑定的自定义域名，可按需配置桶的 CORS（把域名改成实际站点）：

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://eason-xi.github.io"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range"],
    "ExposeHeaders": ["Content-Length", "Content-Range", "Accept-Ranges", "Content-Type", "ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

不使用 `public-read` ACL：R2 的公开访问由桶的域名设置控制。上传从服务端发出，浏览器没有 R2 上传凭据。自定义域名的缓存/访问规则需要允许 Range GET，不要把音频重写为 HTML 或 gzip 压缩音频；若验证收到 200 而非正确的 206，先修正域名/缓存设置。

## 联调与可选迁移

```bash
# 只显示配置是否存在，不展示值；默认不联网、不上传。
npm run storage:check
# 在当前媒体网关上试传一份已发布音频，验证上传、对象读回与 Range。
# 不调用 MiMo，不改任何节目记录或现有链接。
npm run storage:check -- --apply --episode-id=episode-2026-10-26-deepseek-v4-1-flash-1017

# 只预览当前已发布节目迁移计划，不上传、不写数据。
npm run audio:migrate
# 只迁移指定的已发布节目；也可以省略 --id 迁移全部已发布音频。
npm run audio:migrate -- --apply --id=episode-2026-10-26-deepseek-v4-1-flash-1017
```

迁移始终排除草稿、待审核、下架和回收站记录，不删除本地原件。迁移改变的是公开音频地址，不改变节目状态。GitHub Pages 使用提交过的公开快照；迁移后需重新运行 `npx tsx scripts/sync-pages.ts`、审查快照并提交发布更新，线上静态站才会使用 R2。

只读网关不会提供旧的 `episodes/` 测试目录、私有预览或桶列表。对直连 r2.dev 的独立测试环境，`storage:check --apply` 仍支持一秒静音；当前 workers.dev 配置必须指定已发布节目。

官方资料：[AWS SDK v3](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/)、[S3 API 与 Range/Content-Type](https://developers.cloudflare.com/r2/api/s3/api/)、[公开桶与开发地址](https://developers.cloudflare.com/r2/buckets/public-buckets/)、[R2 token 权限](https://developers.cloudflare.com/r2/api/tokens/)、[签名 URL](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)。
