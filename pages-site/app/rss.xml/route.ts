import { absoluteAudioUrl, episodes, siteUrl } from "../../lib/content";

export const dynamic = "force-static";
const xml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");

export function GET() {
  const items = episodes.map(episode => `<item><title>${xml(episode.title)}</title><description>${xml(episode.dek)}</description><link>${siteUrl}/episodes/${encodeURIComponent(episode.slug)}/</link><guid isPermaLink="false">${xml(episode.rssGuid)}</guid><pubDate>${new Date(episode.publishedAt).toUTCString()}</pubDate><itunes:duration>${episode.audio?.durationSec ?? 0}</itunes:duration>${episode.audio ? `<enclosure url="${xml(absoluteAudioUrl(episode.audio.url))}" type="${xml(episode.audio.mime)}" length="${episode.audio.sizeBytes}" />` : ""}</item>`).join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>日更 AI</title><link>${siteUrl}/</link><description>AI 新闻播客、逐字稿与原始来源。</description><language>zh-cn</language><itunes:author>DailyBoke</itunes:author><itunes:explicit>false</itunes:explicit>${items}</channel></rss>`, { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
}
