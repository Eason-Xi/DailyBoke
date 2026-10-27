import { createInterface } from "node:readline";
import { getEpisode, updateEpisode } from "../lib/content-store";
import { XiaomiMiMoTtsProvider } from "../lib/providers";
import { prepareAudioForPublication } from "../lib/audio-storage";

function readApiKey(): Promise<string> {
  if (process.stdin.isTTY && process.stdin.setRawMode) {
    return new Promise((resolve, reject) => {
      let value = "";
      process.stdin.setRawMode(true);
      process.stdin.resume();
      const onData = (chunk: Buffer) => {
        for (const byte of chunk) {
          if (byte === 3) {
            process.stdin.setRawMode(false);
            process.stdin.off("data", onData);
            reject(new Error("已取消。"));
            return;
          }
          if (byte === 10 || byte === 13) {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdin.off("data", onData);
            const key = value.trim();
            if (!key) reject(new Error("标准输入中没有 MIMO_API_KEY。"));
            else resolve(key);
            return;
          }
          value += String.fromCharCode(byte);
        }
      };
      process.stdin.on("data", onData);
    });
  }

  return new Promise((resolve, reject) => {
    const input = createInterface({ input: process.stdin, terminal: false });
    input.once("line", (line) => {
      input.close();
      const key = line.trim();
      if (!key) reject(new Error("标准输入中没有 MIMO_API_KEY。"));
      else resolve(key);
    });
  });
}

async function main() {
  process.stdout.write("Ready for MIMO_API_KEY on stdin.\n");
  const apiKey = await readApiKey();
  const episode = await getEpisode("episode-2026-10-25");
  if (!episode) throw new Error("找不到首期节目。");

  const provider = new XiaomiMiMoTtsProvider(apiKey);
  const result = await provider.synthesize(episode.scriptMarkdown, episode.id);
  const durationSec = result.durationSec;
  if (!Number.isFinite(durationSec)) throw new Error("无法读取 MiMo 音频时长。");

  const preview = { url: result.publicUrl, mime: result.mime, durationSec, provider: result.provider, label: result.label, sizeBytes: result.sizeBytes, storage: result.storage };
  const audio = episode.status === "published" ? await prepareAudioForPublication(preview, episode.id) : preview;
  await updateEpisode(episode.id, (current) => ({
    ...current,
    audioStatus: "ready",
    duration: `${Math.floor(durationSec / 60)} 分 ${String(durationSec % 60).padStart(2, "0")} 秒`,
    audio,
  }));

  console.log(`Generated Xiaomi MiMo audio for ${episode.id} (${durationSec}s).`);
}

void main();
