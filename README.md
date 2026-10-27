# DailyBoke / 日更 AI

一个可本地运行的 AI 每日新闻播客 MVP。它展示完整的编辑链路：可信来源采集、去重与排序、交叉核验、播客稿、人工审核、语音准备、网页发布和 RSS。

> 当前版本默认使用 **mock 新闻/编辑 provider**，并已接通 **Xiaomi MiMo TTS**。当前发布内容包含经来源核验的 DeepSeek V4.1 Flash 1017 专题；没有 `MIMO_API_KEY` 时会明确降级为仓库内的本地演示音频。

## 已实现

- 前台首页：节目播放器、三条新闻、“发生了什么 / 为什么重要 / 接下来关注”、完整逐字稿、原始来源和核验说明。
- 往期页：搜索完整节目与逐字稿，并按公司、主题筛选。
- 审核后台：来源核验、TTS 专用播报稿、MiMo 正式预览、两阶段发布，以及失败提醒。
- 已发布修订：线上旧版持续可用；修订稿可重生成音频或明确保留旧音频，通过后更新首页、往期与 RSS，并保留可回退版本。
- 内容管理：未发布内容移至可恢复回收站；已发布节目可下架并重新发布，破坏性操作均需二次确认。
- 状态流：`draft → in_review → ready → published`，并支持 `trashed / unlisted / failed`，操作会写入 `data/episodes.json`。
- RSS：`/rss.xml` 只输出已发布节目，并包含音频 enclosure。
- 自动化入口：`npm run pipeline:demo` 创建一份明确标注的流程演示草稿。
- 响应式布局、键盘焦点、跳转链接、语义结构和辅助文本。

## 本地启动

需要 Node.js 20.9 或更新版本。

```bash
npm install
cp .env.example .env
npm run dev
```

打开：

- 首页：<http://localhost:3000>
- 往期：<http://localhost:3000/archive>
- 审核台：<http://localhost:3000/review>
- RSS：<http://localhost:3000/rss.xml>

无需任何密钥即可体验：在审核台选择“流程演示草稿”，修改并保存文稿，然后依次通过审核和发布。缺少 `MIMO_API_KEY` 时，TTS provider 会安全降级到仓库内的演示音频，并在播放器中明确标注“未调用 Xiaomi MiMo”。

## 自动化任务

创建指定日期的演示草稿：

```bash
npm run pipeline:demo -- --date=2026-10-27
```

不传日期时，脚本按 `Asia/Taipei` 的当前日期生成。它只使用历史资料和 mock provider，不会联网抓取或调用模型。

在 macOS 上重新生成演示音频（需要系统 `say` 和 `ffmpeg`）：

```bash
npm run audio:demo
```

使用一次性标准输入生成首期 Xiaomi MiMo 音频（密钥不会写入文件或命令参数）：

```bash
npm run audio:mimo
# 看到提示后粘贴 MIMO_API_KEY 并回车
```

## 环境变量

本项目当前读取根目录的 `.env`：`/Users/apple/Documents/ChatGPT/DailyBoke/.env`。复制 `.env.example` 为 `.env` 后填写密钥；该文件已被 `.gitignore` 排除。Next.js 也支持 `.env.local`，但请避免在两个文件中重复定义同一变量。

| 变量 | 默认 | 用途 |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | RSS 中的绝对链接与音频 enclosure |
| `NEWS_PROVIDER` | `mock` | 新闻采集 provider；本版只实现 mock |
| `EDITORIAL_PROVIDER` | `mock` | 摘要与脚本 provider；本版只实现 mock |
| `TTS_PROVIDER` | `xiaomi-mimo` | `xiaomi-mimo` 优先调用 MiMo；也可显式设为 `mock` |
| `MIMO_API_KEY` | 空 | Xiaomi MiMo API 密钥；为空时安全降级，不会发送请求 |
| `MIMO_TTS_MODEL` | `mimo-v2.5-tts` | 标准预置音色模型 |
| `MIMO_TTS_VOICE` | `茉莉` | 中文知性女声；可改为 `白桦` 等官方预置音色 |
| `MIMO_TTS_BASE_URL` | `https://api.xiaomimimo.com/v1` | Xiaomi MiMo OpenAI 兼容 API 根地址 |
| `DAILYBOKE_DATA_FILE` | `data/episodes.json` | 本地内容存储路径 |
| `SIMULATE_PUBLISH_FAILURE` | 未设置 | 设为 `1` 可演示发布失败提醒与重试 |
| `NEWS_API_KEY` / `OPENAI_API_KEY` | 空 | 为后续真实新闻与编辑适配器预留；当前不会读取或发送 |

### Xiaomi MiMo TTS

第一版按 Xiaomi MiMo 官方 TTS 文档接入标准预置音色模型：

- 模型：`mimo-v2.5-tts`
- API：`POST https://api.xiaomimimo.com/v1/chat/completions`
- 文本放在 `assistant` 消息；`user` 消息用于导演提示。
- 默认音色：`茉莉`；默认风格是中文新闻主播，语速自然、克制、可信，段落间自然停顿约 0.4 秒。
- 页面显示稿保持原始数字；TTS 专用播报稿按语义处理版本号、日期代码和硬件编号，例如 `1017` 读作“十月十七日版”或逐位读，参数量、价格和百分比仍按正常数值朗读。
- 输出：WAV，保存到 `public/audio/<episode-id>-mimo.wav`。

服务端会区分缺少/无效密钥、HTTP 429 限流、网络超时和响应缺少音频。缺少密钥不会报假成功，而是使用清楚标注的本地演示音频；真实调用失败会把节目与音频状态设为 `failed` 并在审核台展示原因。生产部署时不要把 API Key 暴露给浏览器。

## 内容质量保障

`Episode → Story → Source / Claim` 数据模型保留每一条可发布陈述的来源和性质：

1. 每期目标三条，但数量服从质量；未证实或争议消息不进入主新闻。
2. 核心事实至少有一条一手来源和一条独立来源；示例数据的六个链接都保留发布日期与核验说明。
3. `Claim.certainty` 区分 `fact`、`analysis`、`projection`。
4. 审核台在发布前展示来源、核验备注、文稿和质量检查；人工可以修改、退回或通过。
5. 页面明确显示节目日期与“历史演示”标签，避免把旧资料当成实时新闻。

## 接入真实服务

Provider 协议位于 `lib/providers.ts`。建议按以下顺序实现，不要直接把抓取逻辑写进页面或脚本：

1. **新闻采集**：实现 `NewsProvider`，优先接公司公告、论文、监管机关 RSS/API，再补充可靠独立媒体。输出规范化候选、发布时间、来源类型和 canonical URL。
2. **去重与排序**：在管线层按事件聚类，综合影响范围、可信度、新颖性和受众相关性评分；低于阈值时允许少于三条。
3. **交叉核验**：事实级别建立 claim/source 对应关系；一手来源不能替代独立确认。对冲突、撤回和未证实状态设置硬门槛。
4. **编辑模型**：实现 `EditorialProvider`，要求结构化 JSON 输出，并在保存前通过 schema 校验。把提示词、模型版本和生成时间记录进 `production`。
5. **TTS**：`XiaomiMiMoTtsProvider` 已能按官方格式非流式调用标准音色；生产环境应把结果写入对象存储而不是 `public/`，记录真实时长，并在长稿超过模型输入限制时按自然段切分后拼接。审核通过前不得合成正式音频。
6. **持久化与部署**：本地 JSON 适合 MVP，不适合多实例部署。生产环境应把 `content-store` 替换为 Postgres/D1 等事务存储，音频放入 S3/R2，并为定时任务加锁和幂等键。
7. **告警**：将 `failed` 状态和错误内容接到邮件、Slack 或飞书；定时任务应监控“未生成草稿、TTS 超时、RSS 发布失败”。

真实自动化上线前还需用户提供：`MIMO_API_KEY`、选定的新闻/抓取服务与编辑模型、数据库/对象存储、部署平台与告警渠道凭据，以及最终确认的 MiMo 预置音色、节目封面和发行策略。

## 验证

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

项目使用 Next.js App Router、React、TypeScript 和原生 CSS；没有 UI 框架或运行时数据库依赖。
