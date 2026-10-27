import { promises as fs } from "node:fs";
import path from "node:path";
import type { PublicEpisode } from "../pages-site/lib/content";

type SourceEpisode = Omit<PublicEpisode, "publishedAt" | "rssGuid" | "audio"> & {
  status: string;
  publication?: { publishedAt?: string; rssGuid?: string };
  audio?: Omit<NonNullable<PublicEpisode["audio"]>, "sizeBytes"> & { sizeBytes?: number; storage?: { visibility: string } };
};

async function main() {
  const store = JSON.parse(await fs.readFile(path.join(process.cwd(), "data/episodes.json"), "utf8")) as { episodes: SourceEpisode[] };
  const published = store.episodes.filter(episode => episode.status === "published").toSorted((a, b) => b.date.localeCompare(a.date));
  const episodes: PublicEpisode[] = [];
  for (const episode of published) {
    if (!/^[a-zA-Z0-9_-]+$/.test(episode.id) || !/^[a-zA-Z0-9_-]+$/.test(episode.slug)) throw new Error("Invalid public episode ID or slug.");
    let audio: PublicEpisode["audio"];
    if (episode.audio) {
      const source = episode.audio;
      if (source.storage?.visibility === "private" || source.url.startsWith("/api/")) throw new Error(`${episode.id}: private preview cannot be exported.`);
      let sizeBytes = source.sizeBytes;
      if (/^\/audio\/[a-zA-Z0-9._-]+\.(wav|mp3)$/.test(source.url)) {
        const root = await fs.realpath(path.join(process.cwd(), "public/audio"));
        const file = await fs.realpath(path.join(root, path.basename(source.url)));
        if (path.dirname(file) !== root) throw new Error("Audio file escaped its public directory.");
        sizeBytes = (await fs.stat(file)).size;
      } else {
        const url = new URL(source.url);
        if (url.protocol !== "https:" || url.search || url.hash || url.username || url.password || url.hostname.endsWith(".cloudflarestorage.com")) {
          throw new Error(`${episode.id}: expected stable HTTPS audio URL.`);
        }
      }
      if (!sizeBytes || source.durationSec <= 0) throw new Error(`${episode.id}: missing audio size/duration.`);
      audio = { url: source.url, mime: source.mime, sizeBytes, durationSec: source.durationSec, label: source.label };
    }
    episodes.push({
      id: episode.id, slug: episode.slug, date: episode.date, displayDate: episode.displayDate,
      editionLabel: episode.editionLabel, title: episode.title, dek: episode.dek, duration: episode.duration,
      publishedAt: episode.publication?.publishedAt ?? `${episode.date}T00:00:00Z`,
      rssGuid: episode.publication?.rssGuid ?? `dailyboke:${episode.id}`,
      scriptMarkdown: episode.scriptMarkdown,
      stories: episode.stories.map(story => ({
        title: story.title, company: story.company, topic: story.topic,
        happened: story.happened, whyImportant: story.whyImportant, watchNext: story.watchNext,
        sources: story.sources.map(source => ({ title: source.title, publisher: source.publisher, url: source.url, publishedAt: source.publishedAt, kind: source.kind })),
      })),
      ...(audio ? { audio } : {}),
    });
  }
  const output = path.join(process.cwd(), "pages-site/content/episodes.json");
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, `${JSON.stringify({ episodes }, null, 2)}\n`, "utf8");
  console.log(`Public snapshot: ${episodes.length} published episode(s). No source-store records were changed.`);
  for (const episode of episodes) console.log(`${episode.id} · published ${episode.publishedAt}`);
}

void main().catch(error => { console.error(error instanceof Error ? error.message : "Snapshot failed."); process.exitCode = 1; });
