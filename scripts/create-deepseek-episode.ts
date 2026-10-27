import { upsertEpisode } from "../lib/content-store";
import type { Episode } from "../lib/types";

const episode: Episode = {
  id: "episode-2026-10-26-deepseek-v4-1-flash-1017",
  slug: "2026-10-26-deepseek-v4-1-flash-1017",
  date: "2026-10-26",
  displayDate: "2026 年 10 月 26 日",
  editionLabel: "模型专题 · DeepSeek",
  title: "DeepSeek V4.1 Flash 1017：更强的 Agent，不等于更轻的部署",
  dek: "从 1017 更新、非对称架构到真实成本：拆解 DeepSeek 最新 Flash 模型适合谁，又有哪些数字仍需独立验证。",
  duration: "预计 5 分钟",
  status: "in_review",
  audioStatus: "not_started",
  scriptMarkdown: "大家好，欢迎收听《日更 AI》。今天做一期 DeepSeek 模型专题。\n\n先把名字说准。截至 2026 年 10 月 26 日，最新版本是 10 月 17 日发布的 DeepSeek V4.1 Flash 1017。它是九月版的小版本更新，网页、App 和 API 都已切换，API 模型名仍是 deepseek-flash。\n\n第一，1017 更新了什么。官方称它在推理、编程、Agent 和视觉任务上更强，同时输出更短、完成更快。它加入带自反馈的强化学习，重点改善从零完成游戏、三维场景和较长软件项目的能力。\n\n官方模型卡里，Humanity's Last Exam 无工具成绩从 36.8 升到 42.6；Terminal Bench 4.0 从 31.2 升到 42.3；DeepSWE 1.1 从 74.2 升到 77.0。不过这些都是厂商测试。Artificial Analysis 测得的 Humanity's Last Exam 是 43.33，接近官方；Terminal Bench 则是 33.84，低于官方。两边使用的 Agent 框架和推理设置不同，不能直接判定谁对谁错。更可靠的做法，是在自己的仓库、工具和提示词上复测。\n\n第二，它为什么适合长任务。V4.1 Flash 是多模态混合专家模型，支持文字、图片和一百万 token 上下文。技术报告使用五千五百二十亿参数的 backbone 口径，Hugging Face 仓库显示约七千六百三十亿参数；两者统计范围不同。更关键的是，每个 token 在输入阶段约激活八十亿参数，生成阶段约一百六十亿。\n\n它用二十层因果编码器加二十层解码器，并压缩全局 KV cache。官方称持久化缓存约为上一代的八分之一。对长代码库或 Agent 历史来说，这比总参数量更直接影响显存和并发。\n\n模型采用 MIT 许可证，可以商用，但开放权重不等于普通电脑能跑。完整仓库约五百一十 GB，原始版本仍需要高端多卡服务器。生产团队还要测试量化损失、首 token 延迟、并发和运维。\n\n第三，价格和适用人群。官方 API 的 deepseek-flash 目前就是 1017，支持一百万 token 上下文和最高三十八万四千 token 输出。非高峰时段，每百万未缓存输入 token 是零点一五美元，输出是零点六美元；高峰翻倍，缓存命中输入最低是零点零零三美元。\n\n但便宜的 token 不一定等于便宜的任务。一个早于 1017 的独立案例用四张 H200 自托管，按需服务器每天约四百四十一美元，高于同等用量的 API 估算。它不能证明新版能力高低，只说明硬件、安全和运维必须一起算。\n\n如果你在做代码 Agent、长文档分析、图片自动化，或能重复利用缓存，1017 值得试。已有多卡基础设施并要求数据留在本地的团队，可以评估开放权重；个人和中小团队更适合先用 API。\n\n最后关注三件事：相同框架下能否复现 Agent 基准；一百万 token 场景的检索和稳定性；以及按真实任务成功率计算的总成本。\n\n总结：DeepSeek V4.1 Flash 1017 把更强的项目开发能力、超长上下文、开放权重和低价 API 放在一起，但最终判断仍要回到你的代码库和成本表。来源和口径都在节目页面。这里是《日更 AI》，我们下期见。",
  stories: [
    {
      id: "deepseek-1017-update",
      rank: 1,
      slug: "deepseek-1017-update",
      topic: "模型更新",
      company: "DeepSeek",
      title: "正式型号是 DeepSeek‑V4.1‑Flash‑1017",
      kicker: "2026-10-17",
      happened: "DeepSeek 在 10 月 17 日把 V4.1 Flash 更新到 1017 版本，网页、App 与 API 已同步；API 模型名保持 deepseek-flash。官方称它提升推理、编程、Agent 与视觉能力，同时缩短输出和任务时间。",
      whyImportant: "它不是只刷新参数，而是针对完整项目开发和 Agent 工作流做小版本优化。对生产用户来说，输出长度和完成时间与能力分数同样影响总成本。",
      watchNext: "在相同代码仓库、工具和 harness 下复测项目成功率；区分官方基准、第三方数据与自己的业务评测。",
      claims: [
        { text: "1017 于 2026-10-17 发布并已进入网页、App 和 API。", certainty: "fact" },
        { text: "官方基准显示 HLE、Terminal-Bench 与 DeepSWE 均提升。", certainty: "analysis" },
        { text: "项目开发能力是否普遍提升仍需业务环境验证。", certainty: "projection" }
      ],
      sources: [
        {
          id: "deepseek-1017-release",
          title: "DeepSeek-V4.1-Flash-1017: Wish-Driven Programming Made Real",
          publisher: "DeepSeek API Docs",
          url: "https://api-docs.deepseek.com/news/news261017/",
          publishedAt: "2026-10-17",
          kind: "primary",
          supports: "发布日期、上线范围、自反馈强化学习和产品开发定位。",
          checkedAt: "2026-10-26T20:10:00+08:00"
        },
        {
          id: "deepseek-1017-card",
          title: "DeepSeek-V4.1-Flash-1017 Model Card",
          publisher: "DeepSeek / Hugging Face",
          url: "https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash-1017",
          publishedAt: "2026-10-17",
          kind: "primary",
          supports: "MIT 许可、1M 上下文、官方基准、harness 和推理入口。",
          checkedAt: "2026-10-26T20:12:00+08:00"
        },
        {
          id: "deepseek-independent-benchmarks",
          title: "DeepSeek V4.1 Flash benchmarks & pricing",
          publisher: "The Model Gap",
          url: "https://themodelgap.com/models/deepseek-v4-1-flash",
          publishedAt: "2026-10-19",
          kind: "independent",
          supports: "汇总 Artificial Analysis 的 1017 数据，并解释不同 harness 不可直接比较。",
          checkedAt: "2026-10-26T20:15:00+08:00"
        }
      ],
      verification: {
        status: "verified",
        note: "型号、发布日期和上线范围由官方公告与模型卡确认；能力提升同时保留第三方不同口径。",
        checkedBy: "DailyBoke 编辑",
        checkedAt: "2026-10-26T20:18:00+08:00"
      }
    },
    {
      id: "deepseek-architecture-deployment",
      rank: 2,
      slug: "deepseek-architecture-deployment",
      topic: "架构与部署",
      company: "DeepSeek",
      title: "1M 上下文和压缩 KV cache，但完整权重仍约 510 GB",
      kicker: "架构拆解",
      happened: "V4.1 Flash 是多模态 MoE，采用 20 层因果编码器加 20 层解码器。官方称预填充每 token 激活约 8B 参数、生成约 16B，并把持久化 KV cache 压缩到上一代约八分之一。",
      whyImportant: "对长代码库和多步 Agent，KV cache、激活参数和并发比总参数更直接影响推理成本。MIT 开放权重增加了部署选择，但不代表消费级硬件即可运行原始版本。",
      watchNext: "评估量化后的能力损失、真实显存、首 token 延迟、并发和 1M 长上下文检索稳定性。",
      claims: [
        { text: "模型卡确认 1M 上下文、MIT 许可和约 510 GB 仓库。", certainty: "fact" },
        { text: "8B/16B 激活量与 KV cache 压缩来自官方技术报告。", certainty: "analysis" },
        { text: "多数团队自托管仍需要高端多卡基础设施。", certainty: "projection" }
      ],
      sources: [
        {
          id: "deepseek-v41-base-card",
          title: "DeepSeek-V4.1-Flash: Pushing the Limits of KV Cache Compression",
          publisher: "DeepSeek / Hugging Face",
          url: "https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash",
          publishedAt: "2026-09-10",
          kind: "primary",
          supports: "552B backbone、8B/16B 激活、CED、CSA2、SWA replay 与 KV cache 声明。",
          checkedAt: "2026-10-26T20:20:00+08:00"
        },
        {
          id: "deepseek-1017-repository",
          title: "DeepSeek-V4.1-Flash-1017 repository",
          publisher: "DeepSeek / Hugging Face",
          url: "https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash-1017/tree/main",
          publishedAt: "2026-10-17",
          kind: "primary",
          supports: "完整仓库体积、权重格式、许可证与部署说明。",
          checkedAt: "2026-10-26T20:22:00+08:00"
        },
        {
          id: "deepseek-vllm-recipe",
          title: "DeepSeek-V4.1-Flash vLLM deployment recipe",
          publisher: "vLLM Project",
          url: "https://github.com/vllm-project/recipes/blob/main/models/deepseek-ai/DeepSeek-V4.1-Flash.yaml",
          publishedAt: "2026-10-17",
          kind: "independent",
          supports: "独立推理框架的硬件支持与高级部署配置。",
          checkedAt: "2026-10-26T20:24:00+08:00"
        }
      ],
      verification: {
        status: "verified",
        note: "架构来自官方技术资料；部署门槛由仓库体积与独立 vLLM 配方交叉确认。",
        checkedBy: "DailyBoke 编辑",
        checkedAt: "2026-10-26T20:26:00+08:00"
      }
    },
    {
      id: "deepseek-price-and-fit",
      rank: 3,
      slug: "deepseek-price-and-fit",
      topic: "成本与选型",
      company: "DeepSeek",
      title: "API 很便宜，自托管却未必更省",
      kicker: "生产成本",
      happened: "官方 API 非高峰未缓存输入为每百万 token 0.15 美元、输出 0.60 美元，高峰翻倍；缓存命中输入最低 0.003 美元。官方 deepseek-flash 已指向 1017。",
      whyImportant: "Agent 成本由多轮调用、缓存命中、成功率和重试共同决定。一个独立案例中，四张 H200 的按需自托管费用高于等量 DeepSeek API 估算，说明开放权重不等于低运维成本。",
      watchNext: "用真实业务的任务成功率、总 token、重试次数和人工复核成本计算每任务价格。",
      claims: [
        { text: "API 型号、上下文、输出上限和当前价格来自官方价格页。", certainty: "fact" },
        { text: "第三方自托管案例发生在 1017 之前，只能说明成本结构。", certainty: "analysis" },
        { text: "中小团队通常更适合先从 API 验证。", certainty: "projection" }
      ],
      sources: [
        {
          id: "deepseek-pricing",
          title: "Models & Pricing",
          publisher: "DeepSeek API Docs",
          url: "https://api-docs.deepseek.com/quick_start/pricing/",
          publishedAt: "2026-10-26",
          kind: "primary",
          supports: "deepseek-flash 对应 1017、1M 上下文、384K 输出、峰谷价格与并发。",
          checkedAt: "2026-10-26T20:28:00+08:00"
        },
        {
          id: "deepseek-self-host-cost",
          title: "Firm rents four Nvidia H200s to test '80x cheaper' DeepSeek claim",
          publisher: "Tom's Hardware",
          url: "https://www.tomshardware.com/tech-industry/artificial-intelligence/firm-rents-four-nvidia-h200s-to-test-80x-cheaper-deepseek-claim-usd13-200-monthly-gpu-rental-doubles-claude-bill-while-security-flaws-keep-code-offline",
          publishedAt: "2026-10-01",
          kind: "independent",
          supports: "独立自托管成本案例、API 成本对比及安全隔离限制。",
          checkedAt: "2026-10-26T20:30:00+08:00"
        }
      ],
      verification: {
        status: "verified",
        note: "当前价格由官方页面确认；独立案例明确标注为 1017 之前的运维成本观察。",
        checkedBy: "DailyBoke 编辑",
        checkedAt: "2026-10-26T20:32:00+08:00"
      }
    }
  ],
  production: {
    generatedAt: "2026-10-26T20:35:00+08:00",
    providerSummary: "DeepSeek 官方公告与模型卡 + 独立评测与成本案例",
    reviewerNotes: "型号已从用户口述校正为最新版 DeepSeek-V4.1-Flash-1017；厂商基准与第三方数据分开呈现。",
    qualityChecks: [
      { label: "型号、发布日期与当前 API 映射已核对", passed: true },
      { label: "架构、许可、上下文与价格可追溯", passed: true },
      { label: "厂商基准与第三方结果明确区分", passed: true },
      { label: "自托管案例已注明并非 1017 性能验证", passed: true }
    ]
  }
};

async function main() {
  await upsertEpisode(episode);
  console.log(`Created review-ready episode: ${episode.id}`);
}

void main();
