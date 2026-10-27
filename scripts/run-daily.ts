import { getProviders } from "../lib/providers";
import { getEpisodes, upsertEpisode } from "../lib/content-store";
import type { Episode } from "../lib/types";

const dateArgument = process.argv.find((argument) => argument.startsWith("--date="));
const date = dateArgument?.split("=")[1] ?? new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  throw new Error("日期格式必须是 YYYY-MM-DD，例如 --date=2026-10-27");
}

async function main() {
  const { news, editorial } = getProviders();
  const candidates = await news.collect(date);
  const providerSummary = await editorial.summarize(candidates);
  const episodes = await getEpisodes();
  const source = episodes.find((episode) => episode.id === "episode-2026-10-25");
  if (!source) throw new Error("缺少周回顾演示模板 episode-2026-10-25。");

  const displayDate = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00+08:00`));

  const draft: Episode = {
    ...source,
    id: `draft-${date}`,
    slug: `draft-${date}`,
    date,
    displayDate,
    editionLabel: "自动化流程演示草稿",
    title: `待审核：${date} 周回顾流程演示`,
    dek: "由 mock provider 复用已核对的周回顾，只用于验证采集、审核、MiMo 音频和发布状态流。",
    status: "draft",
    audioStatus: "not_started",
    audio: undefined,
    publication: undefined,
    scriptMarkdown: `注意：这是 ${date} 创建的流程演示草稿，内容截止 2026 年 10 月 25 日，不是当天实时新闻。\n\n${source.scriptMarkdown}`,
    stories: source.stories.map((story) => ({ ...story, id: `${date}-${story.id}` })),
    production: {
      generatedAt: new Date().toISOString(),
      providerSummary: `${news.name} + ${editorial.name} · ${providerSummary}`,
      reviewerNotes: "真实新闻 provider 尚未连接；TTS 优先使用 Xiaomi MiMo，缺少密钥时自动使用明确标注的本地演示音频。",
      qualityChecks: [
        { label: "候选具有一手来源与独立观察", passed: true },
        { label: "事实、分析与推测已区分", passed: true },
        { label: "实时新闻采集已连接", passed: false },
        { label: "需要人工审核", passed: false },
      ],
    },
  };

  await upsertEpisode(draft);
  console.log(`Created ${draft.id} with ${candidates.length} mock candidates.`);
  console.log("Open http://localhost:3000/review to continue the workflow.");
}

void main();
