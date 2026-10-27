import { afterEach, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Episode } from "../lib/types";
import fixture from "../data/episodes.json";

let dir: string;
afterEach(async () => { vi.unstubAllEnvs(); if (dir) await fs.rm(dir, { recursive: true, force: true }); });

it("preserves concurrent publication/editorial mutations in the local JSON store", async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "dailyboke-store-"));
  const file = path.join(dir, "episodes.json");
  const episode = { ...structuredClone(fixture.episodes[0]), id: "isolated-test", revisionNumber: 0 } as Episode;
  await fs.writeFile(file, JSON.stringify({ episodes: [episode] }));
  vi.stubEnv("DAILYBOKE_DATA_FILE", file);
  vi.resetModules();
  const store = await import("../lib/content-store");
  await Promise.all(Array.from({ length: 20 }, () => store.updateEpisode(episode.id, item => ({ ...item, revisionNumber: (item.revisionNumber ?? 0) + 1 }))));
  expect((await store.getEpisode(episode.id))?.revisionNumber).toBe(20);
  await expect(store.updateEpisode(episode.id, () => { throw new Error("conflict"); })).rejects.toThrow("conflict");
  await store.updateEpisode(episode.id, item => ({ ...item, title: "Queue recovered" }));
  expect((await store.getEpisode(episode.id))?.title).toBe("Queue recovered");
});
