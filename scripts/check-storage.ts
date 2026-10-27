import { loadEnvConfig } from "@next/env";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { AudioStorageError, getR2Config, storageErrorMessage, storageProvider, uploadR2Audio } from "../lib/audio-storage";
import { resolveLocalAudio } from "../lib/local-audio";

loadEnvConfig(process.cwd());

async function main() {
  const names = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_BASE_URL"];
  console.log(`Audio storage selection: ${storageProvider()} · upload mode: ${process.env.R2_UPLOAD_MODE || "s3"}`);
  for (const name of names) console.log(`${name}: ${process.env[name]?.trim() ? "present" : "missing"}`);
  if (!process.argv.includes("--apply")) {
    console.log("Dry run: no network request or upload. Use --apply after configuring .env to verify a small silent WAV.");
    return;
  }
  const config = getR2Config();
  const requestedEpisode = process.argv.find(arg => arg.startsWith("--episode-id="))?.slice(13);
  if (!requestedEpisode && new URL(config.publicBaseUrl).hostname.endsWith(".workers.dev")) {
    throw new AudioStorageError("媒体网关只服务已发布音频；请添加 --episode-id=<已发布节目ID> 进行联调。");
  }
  let bytes = Buffer.alloc(44 + 16_000);
  bytes.write("RIFF", 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36); bytes.writeUInt32LE(16_000, 40);
  let episodeId = `storage-check-${randomUUID()}`;
  let mime = "audio/wav";
  if (requestedEpisode) {
    const { getEpisode } = await import("../lib/content-store");
    const episode = await getEpisode(requestedEpisode);
    if (!episode || episode.status !== "published" || !episode.audio) throw new Error("只允许试传当前已发布节目音频。");
    bytes = await fs.readFile((await resolveLocalAudio(episode.audio)).filePath);
    mime = episode.audio.mime;
    episodeId = episode.id;
  }
  const result = await uploadR2Audio({ bytes, mime, episodeId }, { config });
  console.log(`Verified R2 upload, object read-back and public Range playback. Uploaded ${result.sizeBytes} bytes${requestedEpisode ? " from a published episode" : " of silence"}.`);
  console.log("No episode record, publication status or current playback URL was changed.");
  console.log(`Test object retained: ${result.key}`);
  console.log(`Playback: ${result.url}`);
}

void main().catch(error => { console.error(storageErrorMessage(error)); process.exitCode = 1; });
