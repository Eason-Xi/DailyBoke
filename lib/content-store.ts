import { promises as fs } from "node:fs";
import path from "node:path";
import type { Episode, EpisodeStore } from "./types";
import { isPublicEpisode } from "./workflow";

const storePath = process.env.DAILYBOKE_DATA_FILE
  ? path.resolve(process.env.DAILYBOKE_DATA_FILE)
  : path.join(process.cwd(), "data", "episodes.json");

export async function readStore(): Promise<EpisodeStore> {
  const raw = await fs.readFile(storePath, "utf8");
  return JSON.parse(raw) as EpisodeStore;
}

export async function writeStore(store: EpisodeStore): Promise<void> {
  const tempPath = `${storePath}.${process.pid}.tmp`;
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(tempPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, storePath);
}

export async function getEpisodes(): Promise<Episode[]> {
  const { episodes } = await readStore();
  return episodes.toSorted((a, b) => b.date.localeCompare(a.date));
}

export async function getPublishedEpisodes(): Promise<Episode[]> {
  return (await getEpisodes()).filter((episode) => isPublicEpisode(episode.status));
}

export async function getLatestPublishedEpisode(): Promise<Episode | undefined> {
  return (await getPublishedEpisodes())[0];
}

export async function getEpisode(id: string): Promise<Episode | undefined> {
  return (await getEpisodes()).find((episode) => episode.id === id);
}

export async function updateEpisode(
  id: string,
  updater: (episode: Episode) => Episode,
): Promise<Episode | undefined> {
  const store = await readStore();
  const index = store.episodes.findIndex((episode) => episode.id === id);
  if (index === -1) return undefined;
  const updated = updater(store.episodes[index]);
  store.episodes[index] = updated;
  await writeStore(store);
  return updated;
}

export async function upsertEpisode(episode: Episode): Promise<void> {
  const store = await readStore();
  const index = store.episodes.findIndex((item) => item.id === episode.id);
  if (index === -1) store.episodes.push(episode);
  else store.episodes[index] = episode;
  await writeStore(store);
}
