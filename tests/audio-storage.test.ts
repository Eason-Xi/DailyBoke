import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { type S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { audioObjectKey, getR2Config, prepareAudioForPublication, publicAudioInfo, R2ObjectMissingError, uploadR2Audio, uploadR2ViaWrangler } from "../lib/audio-storage";
import { privatePreviewResponse, savePrivatePreview } from "../lib/local-audio";
import { reviewAccessResponse } from "../lib/review-access";

const accountId = "a".repeat(32);
const config = { uploadMode: "s3" as const, accountId, endpoint: `https://${accountId}.r2.cloudflarestorage.com`, bucket: "podcast-audio", accessKeyId: "test-key", secretAccessKey: "test-secret", publicBaseUrl: "https://media.example.com" };
const env = { R2_ACCOUNT_ID: accountId, R2_ACCESS_KEY_ID: "test-key", R2_SECRET_ACCESS_KEY: "test-secret", R2_BUCKET: "podcast-audio", R2_PUBLIC_BASE_URL: "https://media.example.com" };
const bytes = Buffer.from(Array.from({ length: 100 }, (_, index) => index));
const mime = "audio/wav";
const sha256 = audioObjectKey("episode-test", bytes, mime).sha256;
const rangedResponse = () => new Response(bytes.subarray(0, 64), { status: 206, headers: { "content-type": mime, "content-range": "bytes 0-63/100", "content-length": "64" } });

describe("R2 public audio publication", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("requires all credentials and a stable public HTTPS domain, with explicit r2.dev opt-in", () => {
    expect(() => getR2Config({})).toThrow("R2_ACCESS_KEY_ID");
    expect(getR2Config(env).endpoint).toBe(config.endpoint);
    expect(() => getR2Config({ ...env, R2_PUBLIC_BASE_URL: "https://pub-test.r2.dev" })).toThrow("仅供测试");
    expect(getR2Config({ ...env, R2_PUBLIC_BASE_URL: "https://pub-test.r2.dev", R2_ALLOW_DEV_PUBLIC_URL: "1" })).toBeDefined();
    expect(() => getR2Config({ ...env, R2_PUBLIC_BASE_URL: "https://media.example.com/test?X-Amz-Signature=expires" })).toThrow();
    expect(() => getR2Config({ ...env, R2_PUBLIC_BASE_URL: config.endpoint })).toThrow();
  });

  it("uploads with Content-Type/size/immutable key, verifies HEAD and public byte-range content", async () => {
    const send = vi.fn().mockResolvedValueOnce({}).mockResolvedValueOnce({ ContentLength: 100, ContentType: mime, Metadata: { sha256 } });
    const fetcher = vi.fn().mockImplementation(rangedResponse);
    const result = await uploadR2Audio({ bytes, mime, episodeId: "episode-test" }, { config, client: { send } as unknown as S3Client, fetcher });
    const put = send.mock.calls[0][0] as PutObjectCommand;
    expect(put).toBeInstanceOf(PutObjectCommand);
    expect(put.input).toMatchObject({ ContentLength: 100, ContentType: mime, IfNoneMatch: "*", Key: `published/episodes/episode-test/${sha256}.wav` });
    expect(send.mock.calls[1][0]).toBeInstanceOf(HeadObjectCommand);
    expect(fetcher.mock.calls[0][1].headers.Range).toBe("bytes=0-63");
    expect(result.url).toBe(`https://media.example.com/published/episodes/episode-test/${sha256}.wav`);
    expect(result.sizeBytes).toBe(100);
  });

  it("reuses verified same-content objects and never overwrites a key on conflict", async () => {
    const send = vi.fn().mockRejectedValueOnce({ $metadata: { httpStatusCode: 412 } })
      .mockResolvedValueOnce({ ContentLength: 100, ContentType: mime, Metadata: { sha256 } });
    await expect(uploadR2Audio({ bytes, mime, episodeId: "episode-test" }, { config, client: { send } as unknown as S3Client, fetcher: vi.fn().mockImplementation(rangedResponse) })).resolves.toMatchObject({ sizeBytes: 100 });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("verifies full content when an existing CLI-uploaded object lacks checksum metadata", async () => {
    const send = vi.fn().mockRejectedValueOnce({ $metadata: { httpStatusCode: 412 } })
      .mockResolvedValueOnce({ ContentLength: 100, ContentType: mime })
      .mockResolvedValueOnce({ Body: { transformToByteArray: async () => bytes } });
    await expect(uploadR2Audio({ bytes, mime, episodeId: "episode-test" }, { config, client: { send } as unknown as S3Client, fetcher: vi.fn().mockImplementation(rangedResponse) })).resolves.toMatchObject({ sizeBytes: 100 });
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("uses authenticated Wrangler with remote upload and full round-trip verification, without reading tokens", async () => {
    let stored: Buffer | undefined;
    const runner = vi.fn(async (args: string[]) => {
      expect(args).toContain("--remote");
      const file = args[args.indexOf("--file") + 1];
      if (args[2] === "put") stored = await fs.readFile(file);
      else if (!stored) throw new R2ObjectMissingError();
      else await fs.writeFile(file, stored);
    });
    const result = await uploadR2ViaWrangler({ bytes, mime, episodeId: "episode-test" }, { config: { ...config, uploadMode: "wrangler" }, runner, fetcher: vi.fn().mockImplementation(rangedResponse) });
    expect(runner.mock.calls.map(call => call[0][2])).toEqual(["get", "put", "get"]);
    expect(result.sizeBytes).toBe(bytes.length);
    expect(stored?.equals(bytes)).toBe(true);
    expect(getR2Config({ R2_UPLOAD_MODE: "wrangler", R2_ACCOUNT_ID: accountId, R2_BUCKET: "podcast-audio", R2_PUBLIC_BASE_URL: "https://media.example.com" }).accessKeyId).toBe("");
  });

  it("reports permission errors and rejects unusable playback links without leaking SDK details", async () => {
    const send = vi.fn().mockRejectedValue({ $metadata: { httpStatusCode: 403 }, message: "test-secret should not escape" });
    await expect(uploadR2Audio({ bytes, mime, episodeId: "episode-test" }, { config, client: { send } as unknown as S3Client })).rejects.toThrow("HTTP 403");
    send.mockReset().mockResolvedValueOnce({}).mockResolvedValueOnce({ ContentLength: 100, ContentType: mime, Metadata: { sha256 } });
    await expect(uploadR2Audio({ bytes, mime, episodeId: "episode-test" }, { config, client: { send } as unknown as S3Client, fetcher: vi.fn().mockResolvedValue(new Response(bytes)) })).rejects.toThrow("Range");
  });

  it("fails explicitly when r2 is selected but unconfigured, and keeps RSS HTTPS URLs absolute", async () => {
    vi.stubEnv("AUDIO_STORAGE_PROVIDER", "r2");
    for (const key of Object.keys(env)) vi.stubEnv(key, "");
    const asset = { url: "/audio/example.wav", mime, durationSec: 10, provider: "tts", label: "test" };
    await expect(prepareAudioForPublication(asset, "episode-test")).rejects.toThrow("R2 配置不完整");
    await expect(publicAudioInfo({ ...asset, url: "https://media.example.com/example.wav", sizeBytes: 100 }, "https://example.com/site")).resolves.toEqual({ url: "https://media.example.com/example.wav", sizeBytes: 100 });
    await expect(publicAudioInfo({ ...asset, url: "/api/audio/preview/private.wav" }, "https://example.com")).rejects.toThrow("未发布预览");
  });
});

describe("private preview and access", () => {
  let dir: string;
  beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), "dailyboke-preview-")); vi.stubEnv("DAILYBOKE_PRIVATE_AUDIO_DIR", dir); });
  afterEach(async () => { vi.unstubAllEnvs(); await fs.rm(dir, { recursive: true, force: true }); });

  it("keeps previews outside public and supports seek, suffix, HEAD and invalid range responses", async () => {
    const preview = await savePrivatePreview(bytes);
    const key = path.basename(preview.url);
    expect(preview.storage.visibility).toBe("private");
    expect((await fs.readFile(path.join(dir, key))).equals(bytes)).toBe(true);
    const ranged = await privatePreviewResponse(new Request("http://localhost/preview", { headers: { Range: "bytes=10-19" } }), key);
    expect(ranged.status).toBe(206);
    expect(ranged.headers.get("content-range")).toBe("bytes 10-19/100");
    expect(Buffer.from(await ranged.arrayBuffer()).equals(bytes.subarray(10, 20))).toBe(true);
    const suffix = await privatePreviewResponse(new Request("http://localhost/preview", { headers: { Range: "bytes=-5" } }), key);
    expect(Buffer.from(await suffix.arrayBuffer()).equals(bytes.subarray(95))).toBe(true);
    const head = await privatePreviewResponse(new Request("http://localhost/preview", { method: "HEAD" }), key);
    expect(head.headers.get("content-length")).toBe("100");
    expect(await head.text()).toBe("");
    expect((await privatePreviewResponse(new Request("http://localhost/preview", { headers: { Range: "bytes=1000-" } }), key)).status).toBe(416);
    expect((await privatePreviewResponse(new Request("http://localhost/preview"), "../secret")).status).toBe(404);
  });

  it("requires server-only review credentials on externally hosted preview/review routes", () => {
    vi.stubEnv("REVIEW_ACCESS_TOKEN", "review-test-only");
    expect(reviewAccessResponse(new Request("https://example.com/review"))?.status).toBe(401);
    expect(reviewAccessResponse(new Request("https://example.com/review", { headers: { authorization: `Basic ${Buffer.from("review:review-test-only").toString("base64")}` } }))).toBeNull();
    vi.stubEnv("REVIEW_ACCESS_TOKEN", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(reviewAccessResponse(new Request("https://example.com/review"))?.status).toBe(503);
  });
});
