import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Episode } from "../lib/types";
import store from "../data/episodes.json";

const state = vi.hoisted(() => ({ episode: undefined as Episode | undefined, prepare: vi.fn(), synthesize: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../lib/content-store", () => ({
  getEpisode: vi.fn(async () => structuredClone(state.episode)),
  updateEpisode: vi.fn(async (_id: string, updater: (episode: Episode) => Episode) => {
    if (!state.episode) return undefined;
    state.episode = updater(structuredClone(state.episode));
    return structuredClone(state.episode);
  }),
}));
vi.mock("../lib/providers", () => ({ getTtsProvider: () => ({ synthesize: state.synthesize }) }));
vi.mock("../lib/audio-storage", () => ({ AudioStorageError: class extends Error {}, prepareAudioForPublication: state.prepare }));

import { POST, PATCH } from "../app/api/review/[id]/route";

const context = { params: Promise.resolve({ id: "test-episode" }) };
const audio = { url: "/api/audio/preview/test.wav", mime: "audio/wav", durationSec: 60, provider: "mimo", label: "preview", sizeBytes: 100, storage: { provider: "local" as const, key: "private/test.wav", visibility: "private" as const } };
const publicAudio = { ...audio, url: "https://media.example.com/published.wav", storage: { provider: "r2" as const, key: "episodes/test/hash.wav", visibility: "public" as const } };
const action = (value: string) => POST(new Request("http://localhost/api/review/test-episode", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: value }) }), context);

describe("publication storage integration without touching the user's store", () => {
  beforeEach(() => {
    state.episode = { ...structuredClone(store.episodes[0]) as Episode, id: "test-episode", status: "ready", audioStatus: "ready", audio, publication: undefined, pendingRevision: undefined, versionHistory: undefined };
    state.prepare.mockReset().mockResolvedValue(publicAudio);
    state.synthesize.mockReset().mockResolvedValue({ publicUrl: audio.url, mime: audio.mime, durationSec: 60, sizeBytes: 100, storage: audio.storage, provider: "mimo", label: "preview" });
  });

  it("does not publish or replace the preview if cloud upload fails", async () => {
    state.prepare.mockRejectedValue(new Error("upload failed"));
    expect((await action("publish")).status).toBe(502);
    expect(state.episode?.status).toBe("ready");
    expect(state.episode?.audio?.url).toBe(audio.url);
    expect(state.episode?.publication).toBeUndefined();
  });

  it("uploads only on explicit publication, while trash/restore preserves local preview", async () => {
    expect((await action("trash")).status).toBe(200);
    expect(state.episode?.status).toBe("trashed");
    expect(state.prepare).not.toHaveBeenCalled();
    await action("restore");
    expect(state.episode?.status).toBe("ready");
    await action("publish");
    expect(state.episode?.status).toBe("published");
    expect(state.episode?.audio?.url).toBe(publicAudio.url);
    await action("unpublish");
    expect(state.episode?.status).toBe("unlisted");
    await action("republish");
    expect(state.episode?.status).toBe("published");
    expect(state.synthesize).not.toHaveBeenCalled();
  });

  it("keeps the old version live until revision audio is uploaded and supports rollback", async () => {
    state.episode!.status = "published";
    state.episode!.audio = publicAudio;
    state.episode!.audioStatus = "ready";
    const title = state.episode!.title;
    await action("edit_published");
    expect(state.episode!.title).toBe(title);
    state.episode!.pendingRevision!.title = "A reviewed revised title";
    state.episode!.pendingRevision!.audio = audio;
    state.episode!.pendingRevision!.audioStatus = "ready";
    state.prepare.mockRejectedValueOnce(new Error("upload failed"));
    expect((await action("publish_revision")).status).toBe(502);
    expect(state.episode!.title).toBe(title);
    expect(state.episode!.pendingRevision).toBeDefined();
    await action("publish_revision");
    expect(state.episode!.title).toBe("A reviewed revised title");
    expect(state.episode!.versionHistory).toHaveLength(1);
    await action("rollback");
    expect(state.episode!.title).toBe(title);
    expect(state.episode!.status).toBe("published");
  });

  it("rejects a stale publish when the script changes during upload", async () => {
    state.prepare.mockImplementationOnce(async () => { state.episode!.scriptMarkdown += " modified"; return publicAudio; });
    expect((await action("publish")).status).toBe(409);
    expect(state.episode!.status).toBe("ready");
    expect(state.episode!.scriptMarkdown.endsWith("modified")).toBe(true);
  });

  it("marks revised speech as requiring a fresh preview and never uploads during synthesis", async () => {
    state.episode!.status = "in_review";
    await action("approve");
    expect(state.prepare).not.toHaveBeenCalled();
    expect(state.episode!.audio?.storage?.visibility).toBe("private");
    expect(state.episode!.status).toBe("ready");
    state.episode!.status = "published";
    await action("edit_published");
    const revision = state.episode!.pendingRevision!;
    const response = await PATCH(new Request("http://localhost/api/review/test-episode", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...revision, scriptMarkdown: `${revision.scriptMarkdown}\nNew speech.`, audioMode: "regenerate" }) }), context);
    expect(response.status).toBe(200);
    expect(state.episode!.pendingRevision!.audioStatus).toBe("not_started");
    expect(state.episode!.pendingRevision!.audio).toBeUndefined();
  });

  it("does not restore a trashed episode when an older synthesis completes", async () => {
    state.episode!.status = "in_review";
    state.synthesize.mockImplementationOnce(async () => {
      await action("trash");
      return { publicUrl: audio.url, mime: audio.mime, durationSec: 60, sizeBytes: 100, storage: audio.storage, provider: "mimo", label: "preview" };
    });
    expect((await action("approve")).status).toBe(409);
    expect(state.episode!.status).toBe("trashed");
  });

  it("cancels stale audio after editing during synthesis and blocks publication until new audio is ready", async () => {
    state.episode!.status = "in_review";
    state.synthesize.mockImplementationOnce(async () => {
      await PATCH(new Request("http://localhost/api/review/test-episode", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ scriptMarkdown: `${state.episode!.scriptMarkdown}\nChanged during synthesis.` }) }), context);
      return { publicUrl: audio.url, mime: audio.mime, durationSec: 60, sizeBytes: 100, storage: audio.storage, provider: "mimo", label: "preview" };
    });
    expect((await action("approve")).status).toBe(409);
    expect(state.episode!.status).toBe("in_review");
    expect(state.episode!.audioStatus).toBe("not_started");
    expect(state.episode!.audio).toBeUndefined();
    state.episode!.status = "approved";
    expect((await action("publish")).status).toBe(409);
  });
});
