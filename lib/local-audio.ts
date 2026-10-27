import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import type { AudioAsset } from "./types";
import { parseByteRange } from "./http-range";
export { parseByteRange } from "./http-range";

export function privateAudioRoot() {
  // Runtime writable storage is mounted separately; never bundle previews into server output.
  return path.resolve(/*turbopackIgnore: true*/ process.env.DAILYBOKE_PRIVATE_AUDIO_DIR || path.join(process.cwd(), ".local", "audio"));
}

export async function savePrivatePreview(bytes: Buffer, mime = "audio/wav") {
  const extension = mime === "audio/mpeg" ? "mp3" : "wav";
  const key = `${randomBytes(24).toString("hex")}.${extension}`;
  await fs.mkdir(privateAudioRoot(), { recursive: true, mode: 0o700 });
  await fs.writeFile(path.join(/*turbopackIgnore: true*/ privateAudioRoot(), key), bytes, { flag: "wx", mode: 0o600 });
  return {
    url: `/api/audio/preview/${key}`,
    sizeBytes: bytes.length,
    storage: { provider: "local" as const, key: `private/${key}`, visibility: "private" as const },
  };
}

export async function resolveLocalAudio(audio: AudioAsset): Promise<{ filePath: string; localKey: string }> {
  const localKey = audio.storage?.localKey
    ?? (audio.storage?.provider === "local" ? audio.storage.key : undefined)
    ?? (audio.url.startsWith("/audio/") ? `public/${audio.url.slice(7)}` : undefined);
  if (!localKey) throw new Error("没有可上传的本地音频源文件；请恢复本地文件或重新生成预览。");
  const match = /^(private|public)\/([a-zA-Z0-9._-]+\.(?:wav|mp3))$/.exec(localKey);
  if (!match) throw new Error("本地音频路径无效。");
  const root = match[1] === "private" ? privateAudioRoot() : path.join(process.cwd(), "public", "audio");
  const [realRoot, realFile] = await Promise.all([fs.realpath(root), fs.realpath(path.join(root, match[2]))]);
  if (path.dirname(realFile) !== realRoot) throw new Error("音频文件不在允许的存储目录中。");
  return { filePath: realFile, localKey };
}

export async function privatePreviewResponse(request: Request, key: string): Promise<Response> {
  if (!/^[a-f0-9]{48}\.(wav|mp3)$/.test(key)) return new Response("Not found", { status: 404 });
  try {
    const { filePath } = await resolveLocalAudio({
      url: "", mime: "", durationSec: 0, provider: "", label: "",
      storage: { provider: "local", key: `private/${key}`, visibility: "private" },
    });
    const size = (await fs.stat(filePath)).size;
    const range = parseByteRange(request.headers.get("range"), size);
    const headers = new Headers({
      "accept-ranges": "bytes",
      "content-type": key.endsWith(".mp3") ? "audio/mpeg" : "audio/wav",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    });
    if (range === "invalid") {
      headers.set("content-range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    const start = range?.start ?? 0;
    const end = range?.end ?? size - 1;
    headers.set("content-length", String(end - start + 1));
    if (range) headers.set("content-range", `bytes ${start}-${end}/${size}`);
    const body = request.method === "HEAD" ? null : Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream<Uint8Array>;
    return new Response(body, { status: range ? 206 : 200, headers });
  } catch {
    return new Response("Not found", { status: 404, headers: { "cache-control": "private, no-store" } });
  }
}
