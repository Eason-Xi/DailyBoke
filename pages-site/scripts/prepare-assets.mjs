import { promises as fs } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const site = path.join(root, "pages-site");
const { episodes } = JSON.parse(await fs.readFile(path.join(site, "content/episodes.json"), "utf8"));
const forbidden = ["pendingRevision", "versionHistory", "management", "production", "reviewerNotes", "storage", "localKey"];
const snapshot = JSON.stringify(episodes);
for (const key of forbidden) if (snapshot.includes(`"${key}":`)) throw new Error(`Private field in public snapshot: ${key}`);
const output = path.join(site, "public/audio");
// This directory is generated, ignored, and contains only copies of approved audio.
await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });
for (const episode of episodes) {
  if (!episode.audio) continue;
  const audio = episode.audio;
  if (audio.url.startsWith("/audio/")) {
    if (!/^\/audio\/[a-zA-Z0-9._-]+\.(wav|mp3)$/.test(audio.url)) throw new Error("Invalid audio path.");
    const sourceRoot = await fs.realpath(path.join(root, "public/audio"));
    const source = await fs.realpath(path.join(sourceRoot, path.basename(audio.url)));
    if (path.dirname(source) !== sourceRoot) throw new Error("Audio symlink outside approved directory.");
    if ((await fs.stat(source)).size !== audio.sizeBytes) throw new Error("Audio changed since public snapshot; sync and review the snapshot again.");
    await fs.copyFile(source, path.join(output, path.basename(source)));
  } else {
    const url = new URL(audio.url);
    if (url.protocol !== "https:" || url.search || url.hash || url.username || url.password) throw new Error("Only stable HTTPS audio is allowed.");
  }
}
console.log(`Prepared only media referenced by ${episodes.length} public episode(s).`);
