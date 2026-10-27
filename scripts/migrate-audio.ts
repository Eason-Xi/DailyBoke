import { loadEnvConfig } from "@next/env";
import { promises as fs } from "node:fs";
import { prepareAudioForPublication, storageProvider } from "../lib/audio-storage";
import { resolveLocalAudio } from "../lib/local-audio";

loadEnvConfig(process.cwd());

async function main() {
  const { getEpisodes, updateEpisode } = await import("../lib/content-store");
  const apply = process.argv.includes("--apply");
  const id = process.argv.find(arg => arg.startsWith("--id="))?.slice(5);
  const episodes = await getEpisodes();
  if (id && !episodes.some(episode => episode.id === id && episode.status === "published")) throw new Error("只允许迁移当前已发布节目的音频。");
  const selected = episodes.filter(episode => episode.status === "published" && episode.audio && (!id || episode.id === id));
  if (apply && storageProvider() !== "r2") throw new Error("迁移上传前请在 .env 设置 AUDIO_STORAGE_PROVIDER=r2，并完成 R2 配置。");
  for (const episode of selected) {
    if (episode.audio!.storage?.provider === "r2") { console.log(`${episode.id}: already on R2, skipped`); continue; }
    const source = await resolveLocalAudio(episode.audio!);
    console.log(`${apply ? "UPLOAD" : "DRY RUN"} ${episode.id}: ${(await fs.stat(source.filePath)).size} bytes`);
    if (!apply) continue;
    const audio = await prepareAudioForPublication(episode.audio, episode.id);
    await updateEpisode(episode.id, item => {
      if (item.status !== "published" || JSON.stringify(item.audio) !== JSON.stringify(episode.audio)) throw new Error("迁移期间节目状态或音频变化，未更新节目记录。");
      return { ...item, audio };
    });
  }
  console.log(apply ? "Migration completed. Local originals retained; no episode status changed." : "Dry run completed. No upload or data change. Use --apply to migrate only published audio.");
}

void main().catch(error => { console.error(error instanceof Error ? error.message : "Migration failed."); process.exitCode = 1; });
