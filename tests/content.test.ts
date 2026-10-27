import { describe, expect, it } from "vitest";
import store from "../data/episodes.json";

describe("demo editorial content", () => {
  const published = store.episodes.find((episode) => episode.id === "episode-2026-10-25");

  it("ships one traceable three-story episode", () => {
    expect(published).toBeDefined();
    expect(published?.stories).toHaveLength(3);
    for (const story of published?.stories ?? []) {
      expect(story.sources).toHaveLength(2);
      expect(new Set(story.sources.map((source) => source.kind))).toEqual(new Set(["primary", "independent"]));
      expect(story.watchNext.length).toBeGreaterThan(10);
    }
  });

  it("keeps the weekly-review disclosure in the transcript", () => {
    expect(published?.scriptMarkdown).toContain("没有查到 OpenAI、Google、Anthropic、Meta 或 xAI");
    expect(published?.scriptMarkdown).toContain("数字来自官方公告");
  });
});
