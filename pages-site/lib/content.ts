import snapshot from "../content/episodes.json";

export interface PublicSource {
  title: string;
  publisher: string;
  url: string;
  publishedAt: string;
  kind: string;
}

export interface PublicEpisode {
  id: string;
  slug: string;
  date: string;
  displayDate: string;
  editionLabel: string;
  title: string;
  dek: string;
  duration: string;
  publishedAt: string;
  rssGuid: string;
  scriptMarkdown: string;
  stories: Array<{
    title: string;
    company: string;
    topic: string;
    happened: string;
    whyImportant: string;
    watchNext: string;
    sources: PublicSource[];
  }>;
  audio?: { url: string; mime: string; sizeBytes: number; durationSec: number; label: string };
}

export const episodes = snapshot.episodes as PublicEpisode[];
export const basePath = process.env.PAGES_BASE_PATH ?? "/DailyBoke";
export const siteUrl = (process.env.PAGES_SITE_URL ?? `https://eason-xi.github.io${basePath}`).replace(/\/$/, "");

export function audioUrl(value: string) {
  return value.startsWith("/audio/") ? `${basePath}${value}` : value;
}

export function absoluteAudioUrl(value: string) {
  return value.startsWith("/audio/") ? `${siteUrl}${value}` : value;
}
