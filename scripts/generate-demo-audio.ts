import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { getEpisode } from "../lib/content-store";

const run = promisify(execFile);

async function main() {
  const episode = await getEpisode("episode-2026-10-25");
  if (!episode) throw new Error("找不到演示节目。");

  const outputDirectory = path.join(process.cwd(), "public", "audio");
  const aiffPath = path.join(outputDirectory, "2026-10-25-weekly-review.aiff");
  const mp3Path = path.join(outputDirectory, "2026-10-25-weekly-review.mp3");
  await fs.mkdir(outputDirectory, { recursive: true });

  try {
    await run("say", ["-v", "Tingting", "-r", "135", "-o", aiffPath, episode.scriptMarkdown]);
    await run("ffmpeg", ["-y", "-loglevel", "error", "-i", aiffPath, "-codec:a", "libmp3lame", "-b:a", "96k", mp3Path]);
    await fs.rm(aiffPath, { force: true });
    console.log(`Generated ${mp3Path}`);
  } catch (error) {
    await fs.rm(aiffPath, { force: true });
    throw new Error(`无法生成演示音频。需要 macOS say 和 ffmpeg。${error instanceof Error ? ` ${error.message}` : ""}`);
  }
}

void main();
