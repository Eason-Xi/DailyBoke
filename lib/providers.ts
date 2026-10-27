export interface NewsCandidate {
  id: string;
  headline: string;
  url: string;
  publisher: string;
  publishedAt: string;
  isPrimary: boolean;
}

export interface NewsProvider {
  name: string;
  collect(date: string): Promise<NewsCandidate[]>;
}

export interface EditorialProvider {
  name: string;
  summarize(candidates: NewsCandidate[]): Promise<string>;
}

import { promises as fs } from "node:fs";
import path from "node:path";
import { savePrivatePreview } from "./local-audio";
import type { AudioAsset } from "./types";

export interface TtsResult {
  publicUrl: string;
  mime: string;
  durationSec: number;
  sizeBytes: number;
  storage: NonNullable<AudioAsset["storage"]>;
  provider: string;
  label: string;
  fallback: boolean;
}

export interface TtsProvider {
  name: string;
  isConfigured: boolean;
  synthesize(script: string, episodeId: string): Promise<TtsResult>;
}

export class MockNewsProvider implements NewsProvider {
  name = "mock-news";
  async collect(date: string): Promise<NewsCandidate[]> {
    return [
      { id: `${date}-nanbeige`, headline: "Nanbeige4.3-33B model card", url: "https://huggingface.co/Nanbeige/Nanbeige4.3-33B", publisher: "Nanbeige", publishedAt: "2026-10-24", isPrimary: true },
      { id: `${date}-mercury`, headline: "Introducing Mercury 3", url: "https://www.inceptionlabs.ai/blog/introducing-mercury-3", publisher: "Inception", publishedAt: "2026-10-19", isPrimary: true },
      { id: `${date}-minimax`, headline: "MiniMax M3.1 Flash", url: "https://www.minimax.io/blog/minimax-m31f", publisher: "MiniMax", publishedAt: "2026-10-19", isPrimary: true },
    ];
  }
}

export class MockEditorialProvider implements EditorialProvider {
  name = "mock-editorial";
  async summarize(candidates: NewsCandidate[]): Promise<string> {
    return `演示编辑器收到 ${candidates.length} 个历史候选；未调用外部 AI。`;
  }
}

export class DemoTtsProvider implements TtsProvider {
  name = "local-demo-fallback";
  isConfigured = false;
  async synthesize(): Promise<TtsResult> {
    const bytes = await fs.readFile(path.join(process.cwd(), "public/audio/2026-10-25-weekly-review.mp3"));
    const preview = await savePrivatePreview(bytes, "audio/mpeg");
    return {
      ...preview,
      publicUrl: preview.url,
      mime: "audio/mpeg",
      durationSec: 218,
      provider: this.name,
      label: "演示音频 · 未调用 Xiaomi MiMo",
      fallback: true,
    };
  }
}

export class XiaomiMiMoTtsProvider implements TtsProvider {
  name = "xiaomi-mimo";
  isConfigured = true;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly voice: string;
  private readonly baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.model = process.env.MIMO_TTS_MODEL ?? "mimo-v2.5-tts";
    this.voice = process.env.MIMO_TTS_VOICE ?? "茉莉";
    this.baseUrl = (process.env.MIMO_TTS_BASE_URL ?? "https://api.xiaomimimo.com/v1").replace(/\/$/, "");
  }

  async synthesize(script: string, episodeId: string): Promise<TtsResult> {
    const { normalizeTtsScript } = await import("./tts-script");
    const spokenScript = normalizeTtsScript(script);
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "user",
            content: "请使用普通话中文新闻主播风格播报：语速自然、清晰、克制、可信，不渲染、不夸张；段落之间自然停顿约 0.4 秒。严格按播报文本中的中文数字发音：版本号、编号、日期代码和模型后缀已经过编辑处理，不要把逐位数字重新合并成整数；参数量、价格、百分比和基准分数仍按正常数值朗读。英文模型名清晰发音。",
          },
          { role: "assistant", content: spokenScript },
        ],
        audio: { format: "wav", voice: this.voice },
      }),
      signal: AbortSignal.timeout(300_000),
    }).catch((error: unknown) => {
      throw new Error(`无法连接 Xiaomi MiMo：${error instanceof Error ? error.message : "网络错误"}`);
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      if (response.status === 401 || response.status === 403) throw new Error("Xiaomi MiMo 凭据无效或无模型权限。请检查 MIMO_API_KEY。");
      if (response.status === 429) throw new Error("Xiaomi MiMo 已达到限流，请稍后重试。");
      throw new Error(`Xiaomi MiMo 返回 ${response.status}${detail ? `：${detail.slice(0, 180)}` : ""}`);
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { audio?: { data?: string } } }>;
    };
    const audioBase64 = payload.choices?.[0]?.message?.audio?.data;
    if (!audioBase64) throw new Error("Xiaomi MiMo 响应中缺少音频数据。");

    if (!/^[a-zA-Z0-9_-]+$/.test(episodeId)) throw new Error("节目 ID 无效。");
    const wav = Buffer.from(audioBase64, "base64");
    const durationSec = getWavDurationSec(wav);
    const preview = await savePrivatePreview(wav);

    return {
      ...preview,
      publicUrl: preview.url,
      mime: "audio/wav",
      durationSec,
      provider: `${this.name}/${this.model}/${this.voice}`,
      label: `Xiaomi MiMo · ${this.voice} · 自然克制新闻风格`,
      fallback: false,
    };
  }
}

function getWavDurationSec(wav: Buffer): number {
  if (wav.length < 44 || wav.toString("ascii", 0, 4) !== "RIFF" || wav.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Xiaomi MiMo 返回的文件不是有效的 WAV 音频。");
  }

  let bytesPerSecond = 0;
  let dataBytes = 0;
  for (let offset = 12; offset + 8 <= wav.length;) {
    const chunkId = wav.toString("ascii", offset, offset + 4);
    const chunkSize = wav.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    if (chunkId === "fmt " && chunkSize >= 16 && chunkStart + 12 <= wav.length) {
      bytesPerSecond = wav.readUInt32LE(chunkStart + 8);
    }
    if (chunkId === "data") {
      dataBytes = Math.min(chunkSize, wav.length - chunkStart);
      break;
    }
    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  if (!bytesPerSecond || !dataBytes) throw new Error("无法从 Xiaomi MiMo WAV 文件读取实际时长。");
  return Math.max(1, Math.round(dataBytes / bytesPerSecond));
}

export function getProviders() {
  const news = process.env.NEWS_PROVIDER ?? "mock";
  const editorial = process.env.EDITORIAL_PROVIDER ?? "mock";
  if (news !== "mock" || editorial !== "mock") {
    throw new Error("真实 provider 尚未实现。请保持 NEWS_PROVIDER=mock 与 EDITORIAL_PROVIDER=mock，或按 README 实现适配器。");
  }
  return { news: new MockNewsProvider(), editorial: new MockEditorialProvider() };
}

export function getTtsProvider(): TtsProvider {
  const selected = process.env.TTS_PROVIDER ?? "xiaomi-mimo";
  if (selected === "mock") return new DemoTtsProvider();
  if (selected !== "xiaomi-mimo") throw new Error(`不支持的 TTS_PROVIDER：${selected}`);
  const apiKey = process.env.MIMO_API_KEY?.trim();
  return apiKey ? new XiaomiMiMoTtsProvider(apiKey) : new DemoTtsProvider();
}
