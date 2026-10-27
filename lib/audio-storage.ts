// Server/CLI only. Credentials are read on demand and never included in AudioAsset.
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { resolveLocalAudio } from "./local-audio";
import type { AudioAsset } from "./types";

export interface R2Config {
  uploadMode: "s3" | "wrangler";
  accountId: string;
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
}

export function storageProvider(): "local" | "r2" {
  const selected = process.env.AUDIO_STORAGE_PROVIDER?.trim() || "local";
  if (selected !== "local" && selected !== "r2") throw new Error("AUDIO_STORAGE_PROVIDER 只支持 local 或 r2。");
  return selected;
}

export function getR2Config(env: Record<string, string | undefined> = process.env): R2Config {
  const uploadMode = env.R2_UPLOAD_MODE?.trim() || "s3";
  if (uploadMode !== "s3" && uploadMode !== "wrangler") throw new AudioStorageError("R2_UPLOAD_MODE 只支持 s3 或 wrangler。");
  const required = ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_PUBLIC_BASE_URL", ...(uploadMode === "s3" ? ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"] : [])];
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length) throw new AudioStorageError(`R2 配置不完整：${missing.join("、")}。请在本地 .env 中填写。`);
  const accountId = env.R2_ACCOUNT_ID!.trim();
  if (!/^[a-fA-F0-9]{32}$/.test(accountId)) throw new AudioStorageError("R2_ACCOUNT_ID 应为 Cloudflare 的 32 位账号 ID。");
  const endpoint = env.R2_ENDPOINT?.trim() || `https://${accountId}.r2.cloudflarestorage.com`;
  const api = new URL(endpoint);
  if (api.protocol !== "https:" || !new RegExp(`^${accountId}\\.(?:(?:eu|fedramp)\\.)?r2\\.cloudflarestorage\\.com$`, "i").test(api.hostname)
    || api.username || api.password || api.search || api.hash || api.pathname !== "/" || api.port) {
    throw new AudioStorageError("R2_ENDPOINT 必须是该账号的 HTTPS R2 S3 API 根地址。");
  }
  const publicUrl = new URL(env.R2_PUBLIC_BASE_URL!.trim());
  if (publicUrl.protocol !== "https:" || publicUrl.username || publicUrl.password || publicUrl.search || publicUrl.hash
    || publicUrl.hostname.endsWith(".cloudflarestorage.com") || publicUrl.hostname === "localhost"
    || /^[\d.]+$/.test(publicUrl.hostname) || publicUrl.hostname.startsWith("[")) {
    throw new AudioStorageError("R2_PUBLIC_BASE_URL 必须是稳定公开的 HTTPS 媒体地址，不可使用 S3 API 或临时签名链接。");
  }
  if ((publicUrl.hostname === "r2.dev" || publicUrl.hostname.endsWith(".r2.dev")) && env.R2_ALLOW_DEV_PUBLIC_URL !== "1") {
    throw new AudioStorageError("r2.dev 仅供测试；请绑定自定义媒体域名，或仅在测试时设置 R2_ALLOW_DEV_PUBLIC_URL=1。");
  }
  const bucket = env.R2_BUCKET!.trim();
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) throw new AudioStorageError("R2_BUCKET 名称无效。");
  return {
    uploadMode,
    accountId,
    endpoint: api.origin,
    bucket,
    accessKeyId: env.R2_ACCESS_KEY_ID?.trim() || "",
    secretAccessKey: env.R2_SECRET_ACCESS_KEY?.trim() || "",
    publicBaseUrl: publicUrl.toString().replace(/\/$/, ""),
  };
}

export function createR2Client(config: R2Config) {
  if (config.uploadMode !== "s3" || !config.accessKeyId || !config.secretAccessKey) throw new AudioStorageError("S3 上传模式需要 R2 Access Key ID 和 Secret Access Key。");
  return new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    maxAttempts: 3,
  });
}

function extension(mime: string) {
  if (mime === "audio/wav" || mime === "audio/x-wav") return "wav";
  if (mime === "audio/mpeg") return "mp3";
  throw new Error("不支持的音频类型；当前支持 WAV 与 MP3。");
}

export function audioObjectKey(episodeId: string, bytes: Buffer, mime: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(episodeId)) throw new Error("节目 ID 不适合用作存储路径。");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return { key: `published/episodes/${episodeId}/${sha256}.${extension(mime)}`, sha256 };
}

export function r2PublicUrl(config: Pick<R2Config, "publicBaseUrl">, key: string) {
  if (!/^(?:published\/)?episodes\/[a-zA-Z0-9_-]+\/[a-f0-9]{64}\.(?:wav|mp3)$/.test(key)) throw new Error("R2 音频 key 无效。");
  return `${config.publicBaseUrl}/${key}`;
}

function httpStatus(error: unknown) {
  return (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
}

export function storageErrorMessage(error: unknown) {
  // Never return SDK request objects, authorization headers or credential values.
  if (error instanceof AudioStorageError) return error.message;
  const status = httpStatus(error);
  return status ? `R2 存储请求失败（HTTP ${status}）。请检查桶权限、账号和配置。` : "R2 存储或公开播放链接验证失败，请检查网络和配置。";
}

export class AudioStorageError extends Error {}
export class R2ObjectMissingError extends Error {}

const runFile = promisify(execFile);
export type WranglerRunner = (args: string[], config: R2Config) => Promise<void>;

async function runWrangler(args: string[], config: R2Config) {
  try {
    // Use Wrangler's normal OAuth/keyring handling; never read its credential files.
    await runFile(process.execPath, [path.join(process.cwd(), "node_modules/wrangler/bin/wrangler.js"), ...args], {
      env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: config.accountId, WRANGLER_SEND_METRICS: "false" },
      timeout: 90_000, maxBuffer: 2 * 1024 * 1024,
    });
  } catch (error) {
    const detail = (error as { stderr?: string; stdout?: string });
    if (/specified key does not exist|NoSuchKey|\[code:\s*10007\]/i.test(`${detail.stderr ?? ""}\n${detail.stdout ?? ""}`)) throw new R2ObjectMissingError();
    throw new AudioStorageError("Wrangler R2 操作失败，请检查 wrangler whoami、账号权限和网络。未读取或输出 OAuth 凭据。");
  }
}

export async function uploadR2ViaWrangler(
  input: { bytes: Buffer; mime: string; episodeId: string },
  options: { config: R2Config; fetcher?: typeof fetch; runner?: WranglerRunner },
) {
  const { bytes, mime, episodeId } = input;
  const { config } = options;
  const runner = options.runner ?? runWrangler;
  const { key, sha256 } = audioObjectKey(episodeId, bytes, mime);
  const objectPath = `${config.bucket}/${key}`;
  const url = r2PublicUrl(config, key);
  const temp = await fs.mkdtemp(path.join(/*turbopackIgnore: true*/ os.tmpdir(), "dailyboke-r2-transfer-"));
  try {
    const source = path.join(temp, "source.audio");
    const download = path.join(temp, "verified.audio");
    await fs.writeFile(source, bytes, { mode: 0o600 });
    let exists = true;
    try { await runner(["r2", "object", "get", objectPath, "--remote", "--file", download], config); }
    catch (error) { if (!(error instanceof R2ObjectMissingError)) throw error; exists = false; }
    if (exists && !(await fs.readFile(download)).equals(bytes)) throw new AudioStorageError("R2 内容哈希 key 已存在但内容不同，已停止并保留原对象。");
    if (!exists) {
      await runner(["r2", "object", "put", objectPath, "--remote", "--file", source, "--content-type", mime, "--cache-control", "public, max-age=31536000, immutable"], config);
      await runner(["r2", "object", "get", objectPath, "--remote", "--file", download], config);
      if (!(await fs.readFile(download)).equals(bytes)) throw new AudioStorageError("Wrangler R2 上传后的完整文件校验失败。");
    }
    await verifyPublicAudio(url, bytes, mime, options.fetcher);
    return { url, sizeBytes: bytes.length, key, sha256, uploadedAt: new Date().toISOString() };
  } finally {
    // Only remove this operation's temporary copies; never remove source programme audio.
    await fs.rm(temp, { recursive: true, force: true });
  }
}

export async function verifyPublicAudio(url: string, bytes: Buffer, mime: string, fetcher: typeof fetch = fetch) {
  const length = Math.min(64, bytes.length);
  if (length === 0) throw new AudioStorageError("音频文件为空。");
  const response = await fetcher(url, {
    method: "GET",
    headers: { Range: `bytes=0-${length - 1}`, "Accept-Encoding": "identity" },
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const reader = response.body?.getReader();
  try {
    if (response.status !== 206 || response.headers.get("content-range") !== `bytes 0-${length - 1}/${bytes.length}`
      || response.headers.get("content-type")?.split(";")[0].trim() !== mime
      || Number(response.headers.get("content-length")) !== length) {
      throw new AudioStorageError("R2 公开地址的音频类型、文件长度或 Range 响应不正确；请检查域名、缓存和访问规则。");
    }
    const parts: Uint8Array[] = [];
    let received = 0;
    if (!reader) throw new AudioStorageError("R2 公开播放地址没有返回音频。");
    while (received < length) {
      const chunk = await reader.read();
      if (chunk.done) break;
      received += chunk.value.length;
      if (received > length) throw new AudioStorageError("R2 Range 请求返回了超出范围的数据。");
      parts.push(chunk.value);
    }
    if (received !== length || !Buffer.concat(parts).equals(bytes.subarray(0, length))) {
      throw new AudioStorageError("R2 公开地址返回内容与上传音频不一致。");
    }
  } finally {
    await reader?.cancel();
  }
}

export async function uploadR2Audio(
  input: { bytes: Buffer; mime: string; episodeId: string },
  options: { config?: R2Config; client?: S3Client; fetcher?: typeof fetch } = {},
) {
  const config = options.config ?? getR2Config();
  if (config.uploadMode === "wrangler") return uploadR2ViaWrangler(input, { config, fetcher: options.fetcher });
  const client = options.client ?? createR2Client(config);
  const { bytes, mime, episodeId } = input;
  const { key, sha256 } = audioObjectKey(episodeId, bytes, mime);
  const url = r2PublicUrl(config, key);
  try {
    try {
      await client.send(new PutObjectCommand({
        Bucket: config.bucket, Key: key, Body: bytes, ContentType: mime, ContentLength: bytes.length,
        CacheControl: "public, max-age=31536000, immutable",
        Metadata: { sha256 }, IfNoneMatch: "*",
      }), { abortSignal: AbortSignal.timeout(60_000) });
    } catch (error) {
      if (httpStatus(error) !== 412) throw error; // Same content key already exists: verify rather than overwrite.
    }
    const head = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }), { abortSignal: AbortSignal.timeout(15_000) });
    if (head.ContentLength !== bytes.length || head.ContentType !== mime || (head.Metadata?.sha256 && head.Metadata.sha256 !== sha256)) {
      throw new AudioStorageError("R2 对象校验失败；未发布音频，也没有覆盖已有对象。");
    }
    if (!head.Metadata?.sha256) {
      // Objects initially uploaded via Wrangler have no custom checksum metadata.
      const downloaded = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }), { abortSignal: AbortSignal.timeout(60_000) });
      const content = await downloaded.Body?.transformToByteArray();
      if (!content || createHash("sha256").update(content).digest("hex") !== sha256) throw new AudioStorageError("R2 既有对象的完整校验和不匹配，未覆盖原对象。");
    }
    await verifyPublicAudio(url, bytes, mime, options.fetcher);
    return { url, sizeBytes: bytes.length, key, sha256, uploadedAt: new Date().toISOString() };
  } catch (error) {
    throw new AudioStorageError(storageErrorMessage(error));
  }
}

/** Called only on an explicit publish/update/republish/rollback or migration apply. */
export async function prepareAudioForPublication(audio: AudioAsset | undefined, episodeId: string): Promise<AudioAsset | undefined> {
  if (!audio) return undefined;
  const selected = storageProvider();
  if (audio.storage?.provider === "r2" && audio.storage.visibility === "public") {
    if (selected === "r2") {
      const config = getR2Config();
      if (audio.url !== r2PublicUrl(config, audio.storage.key)) throw new AudioStorageError("现有 R2 地址与当前媒体域名配置不同，请先确认迁移配置。");
    }
    if (!isStablePublicAudioUrl(audio.url) || !audio.sizeBytes) throw new AudioStorageError("现有云端音频地址或大小元数据无效。");
    return audio;
  }
  // Selecting R2 explicitly must not fall back silently when configuration is missing.
  const config = selected === "r2" ? getR2Config() : undefined;
  const source = await resolveLocalAudio(audio);
  const bytes = await fs.readFile(source.filePath);
  if (selected === "r2") {
    const uploaded = await uploadR2Audio({ bytes, mime: audio.mime, episodeId }, { config });
    return {
      ...audio, url: uploaded.url, sizeBytes: uploaded.sizeBytes,
      storage: { provider: "r2", key: uploaded.key, visibility: "public", localKey: source.localKey, sha256: uploaded.sha256, uploadedAt: uploaded.uploadedAt },
    };
  }
  const { sha256 } = audioObjectKey(episodeId, bytes, audio.mime);
  const filename = `${episodeId}-${sha256}.${extension(audio.mime)}`;
  const output = path.join(process.cwd(), "public", "audio", filename);
  await fs.mkdir(path.dirname(output), { recursive: true });
  try { await fs.writeFile(output, bytes, { flag: "wx" }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    if (!(await fs.readFile(output)).equals(bytes)) throw new AudioStorageError("本地发布文件校验失败。");
  }
  return { ...audio, url: `/audio/${filename}`, sizeBytes: bytes.length, storage: { provider: "local", key: `public/${filename}`, visibility: "public", localKey: source.localKey, sha256 } };
}

export function isStablePublicAudioUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.search && !url.hash && !url.username && !url.password
      && !url.hostname.endsWith(".cloudflarestorage.com");
  } catch { return false; }
}

/** RSS metadata for legacy published local files; never fetch arbitrary remote URLs. */
export async function publicAudioInfo(audio: AudioAsset, baseUrl: string): Promise<{ url: string; sizeBytes: number }> {
  if (audio.storage?.visibility === "private" || audio.url.startsWith("/api/audio/preview/")) throw new AudioStorageError("未发布预览不可写入 RSS。");
  if (audio.url.startsWith("/audio/")) {
    const source = await resolveLocalAudio(audio);
    const sizeBytes = (await fs.stat(source.filePath)).size;
    return { url: new URL(audio.url, baseUrl).toString(), sizeBytes };
  }
  if (!isStablePublicAudioUrl(audio.url) || !audio.sizeBytes || audio.sizeBytes < 1) throw new AudioStorageError("公开音频缺少稳定 HTTPS 地址或真实文件大小。");
  return { url: audio.url, sizeBytes: audio.sizeBytes };
}
