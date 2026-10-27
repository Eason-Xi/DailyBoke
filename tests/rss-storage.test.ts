import { expect, it, vi } from "vitest";
import type { Episode } from "../lib/types";
import fixture from "../data/episodes.json";

const records = vi.hoisted(() => ({ episodes: [] as Episode[] }));
vi.mock("../lib/content-store", () => ({ getPublishedEpisodes: async () => records.episodes }));
import { GET } from "../app/rss.xml/route";

it("writes stable cloud HTTPS enclosures and exact byte sizes without prefixing the site URL", async () => {
  records.episodes = [{
    ...structuredClone(fixture.episodes[0]) as Episode,
    status: "published",
    audio: { url: "https://media.example.com/episodes/published.wav", mime: "audio/wav", sizeBytes: 1313324, durationSec: 27, provider: "mimo", label: "正式音频", storage: { provider: "r2", key: "episodes/published.wav", visibility: "public" } },
  }];
  const response = await GET();
  const xml = await response.text();
  expect(xml).toContain('<enclosure url="https://media.example.com/episodes/published.wav" type="audio/wav" length="1313324"');
  expect(xml).not.toContain("localhost:3000https://");
  expect(xml).not.toContain("X-Amz-Signature");
  records.episodes[0].audio!.url = "https://media.example.com/temporary?X-Amz-Signature=expires";
  await expect(GET()).rejects.toThrow("稳定 HTTPS");
});
