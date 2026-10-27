# DailyBoke 只读音频网关

地址：`https://dailyboke-media.wangfugui1799.workers.dev`。Worker 直接绑定专用 R2 桶 `dailyboke-podcast-audio`，无需购买或绑定自有域名。

只开放 `published/episodes/<episode-id>/<sha256>.wav` 或 `.mp3`，其他 key、目录和桶列表返回 404。支持 GET、HEAD、单段/后缀 Range、206、416、ETag/304、If-Range 和 CORS；POST/PUT/PATCH/DELETE 全部返回 405。音频以流传输，大小来自 R2 元数据。私有预览不上传到这个前缀，旧测试目录也不会被网关提供。

当前部署在已授权账号中，未执行任何套餐升级或账单写入。根据 [Workers 官方定价](https://developers.cloudflare.com/workers/platform/pricing/)，Free 计划含每天 100,000 次请求、每次 10ms CPU，流传输等待不等于 CPU 执行时间；实际配额以账户套餐为准。OAuth 连接不含账单读取权限，因此这里不声明该账户的付费订阅状态。Cloudflare 将 [workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/) 定位为个人/兴趣项目地址，适合先运行当前播客；业务关键或更高流量时可再选自有域名，代码不自动升级套餐。

在仓库根目录运行：

```bash
npm install
npx wrangler types media-worker/worker-configuration.d.ts --config media-worker/wrangler.jsonc --include-runtime=false
npx tsc --project media-worker/tsconfig.json
npx wrangler deploy --config media-worker/wrangler.jsonc --dry-run
# 已完成 Wrangler 授权、核对账号后才部署。
npx wrangler deploy --config media-worker/wrangler.jsonc
```

使用官方 Wrangler OAuth（账号读取、R2/Worker 写入、Workers 脚本权限），或者经用户明确配置的适当限权 API token。Worker 本身不含 API key：读取通过 R2 binding 完成。配置中的公开路由、桶名不是凭据。

源码只读校验与范围解析由单元测试覆盖，线上已验证 HEAD 200、GET 206、越界 416、写入 405、私有及旧测试路径 404。域名可更换；替换时更新本地 `.env` 的 `R2_PUBLIC_BASE_URL` 并审查已发布节目的迁移与公开快照。
