import { describe, expect, it } from "vitest";
import { formatDurationZh, normalizeTtsScript } from "../lib/tts-script";

describe("TTS speech copy", () => {
  it("reads identifiers by meaning without changing ordinary quantities", () => {
    const input = "2026 年发布 DeepSeek V4.1 Flash 1017，使用四张 H200，约 552B 参数，价格 0.15 美元，提升 42.6%。";
    const spoken = normalizeTtsScript(input);

    expect(spoken).toContain("二零二六 年");
    expect(spoken).toContain("DeepSeek V 四点一 Flash 十月十七日版");
    expect(spoken).toContain("H 二、零、零");
    expect(spoken).toContain("552B 参数");
    expect(spoken).toContain("0.15 美元");
    expect(spoken).toContain("42.6%");
  });

  it("formats measured audio duration", () => {
    expect(formatDurationZh(328)).toBe("5 分 28 秒");
    expect(formatDurationZh(47)).toBe("47 秒");
  });
});
