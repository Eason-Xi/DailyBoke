import { promises as fs } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const site = path.resolve(import.meta.dirname, "..");
const out = path.join(site, "out");
const { episodes } = JSON.parse(await fs.readFile(path.join(site, "content/episodes.json"), "utf8"));
const basePath = process.env.PAGES_BASE_PATH ?? "/DailyBoke";
const siteUrl = (process.env.PAGES_SITE_URL ?? `https://eason-xi.github.io${basePath}`).replace(/\/$/, "");
const rss = await fs.readFile(path.join(out, "rss.xml"), "utf8");
const index = await fs.readFile(path.join(out, "index.html"), "utf8");
assert(index.includes(`${basePath}/_next/`), "Assets must include the project base path.");
await fs.access(path.join(out, "archive/index.html"));
const expectedMedia = [];
for (const episode of episodes) {
  assert(rss.includes(episode.rssGuid), "Every public episode must be in RSS.");
  await fs.access(path.join(out, "episodes", episode.slug, "index.html"));
  if (episode.audio) {
    const audio = episode.audio;
    assert(rss.includes(`length="${audio.sizeBytes}"`), "RSS must include true enclosure size.");
    const url = audio.url.startsWith("/audio/") ? `${siteUrl}${audio.url}` : audio.url;
    assert(rss.includes(url.replaceAll("&", "&amp;")), "RSS must include a valid absolute media URL.");
    if (audio.url.startsWith("/audio/")) {
      const filename = path.basename(audio.url);
      expectedMedia.push(filename);
      assert.equal((await fs.stat(path.join(out, "audio", filename))).size, audio.sizeBytes);
    }
  }
}
const media = await fs.readdir(path.join(out, "audio")).catch(() => []);
assert.deepEqual(media.sort(), expectedMedia.sort(), "Unreferenced audio must not be exported.");

async function scan(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    assert(!entry.isSymbolicLink(), "Export must not contain symlinks.");
    assert(!["review", "api", ".env", "data"].includes(entry.name), `Private route/file found: ${entry.name}`);
    if (entry.isDirectory()) await scan(file);
    else if (/\.(html|js|json|txt|xml|map|rsc)$/.test(entry.name)) {
      const text = await fs.readFile(file, "utf8");
      for (const marker of ["MIMO_API_KEY", "R2_SECRET_ACCESS_KEY", "REVIEW_ACCESS_TOKEN", '"pendingRevision":', '"reviewerNotes":']) {
        assert(!text.includes(marker), `Private marker found in output: ${marker}`);
      }
      assert(!/sk-[a-z0-9]{20,}/i.test(text), "Credential-like data found in output.");
    }
  }
}
await scan(out);
const privateStore = JSON.parse(await fs.readFile(path.resolve(site, "../data/episodes.json"), "utf8"));
const allowed = new Set(episodes.map(episode => episode.id));
const htmlFiles = [index, rss, await fs.readFile(path.join(out, "archive/index.html"), "utf8")].join("\n");
for (const episode of privateStore.episodes) {
  if (!allowed.has(episode.id)) assert(!htmlFiles.includes(episode.id) && !htmlFiles.includes(episode.title), "Excluded episode leaked into public output.");
}
console.log(`Verified static export: ${episodes.length} public episode(s), ${media.length} audio file(s), no private routes or fields.`);
