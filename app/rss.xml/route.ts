import { getPublishedEpisodes } from "@/lib/content-store";
import { publicAudioInfo } from "@/lib/audio-storage";

export const dynamic = "force-dynamic";

const escapeXml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

export async function GET() {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const episodes = await getPublishedEpisodes();
  const items = (await Promise.all(episodes.map(async (episode) => {
    const publishedAt = episode.publication?.publishedAt ?? `${episode.date}T00:00:00.000Z`;
    const audio = episode.audio;
    const info = audio ? await publicAudioInfo(audio, baseUrl) : undefined;
    return `
    <item>
      <title>${escapeXml(episode.title)}</title>
      <description>${escapeXml(episode.dek)}</description>
      <link>${baseUrl}/archive</link>
      <guid isPermaLink="false">${escapeXml(episode.publication?.rssGuid ?? `dailyboke:${episode.id}`)}</guid>
      <pubDate>${new Date(publishedAt).toUTCString()}</pubDate>
      <itunes:duration>${audio?.durationSec ?? 0}</itunes:duration>
      ${audio && info ? `<enclosure url="${escapeXml(info.url)}" type="${escapeXml(audio.mime)}" length="${info.sizeBytes}" />` : ""}
    </item>`;
  }))).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>日更 AI</title>
    <link>${baseUrl}</link>
    <description>每天只讲三条真正重要的 AI 新闻。</description>
    <language>zh-tw</language>
    <itunes:author>DailyBoke</itunes:author>
    <itunes:explicit>false</itunes:explicit>${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
