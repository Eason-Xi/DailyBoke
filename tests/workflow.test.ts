import { describe, expect, it } from "vitest";
import { canPublishRevision, canTransition, hasIndependentPair, isPublicEpisode, requiresFreshAudio } from "../lib/workflow";

describe("editorial workflow", () => {
  it("allows the happy path and rejects skipping review", () => {
    expect(canTransition("draft", "in_review")).toBe(true);
    expect(canTransition("in_review", "ready")).toBe(true);
    expect(canTransition("ready", "published")).toBe(true);
    expect(canTransition("draft", "published")).toBe(false);
  });

  it("requires primary and independent source categories", () => {
    expect(hasIndependentPair(["primary", "independent"])).toBe(true);
    expect(hasIndependentPair(["primary", "primary"])).toBe(false);
  });

  it("supports reversible trash and unlisting while keeping only published episodes public", () => {
    expect(canTransition("trashed", "in_review")).toBe(true);
    expect(canTransition("published", "unlisted")).toBe(true);
    expect(canTransition("unlisted", "published")).toBe(true);
    expect(isPublicEpisode("published")).toBe(true);
    expect(isPublicEpisode("unlisted")).toBe(false);
    expect(isPublicEpisode("trashed")).toBe(false);
  });

  it("keeps published revisions offline until their audio choice is satisfied", () => {
    const revision = {
      number: 2,
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
      editionLabel: "专题",
      title: "修订版",
      dek: "摘要",
      scriptMarkdown: "新口播稿",
      stories: [],
      audioMode: "regenerate" as const,
      audioStatus: "not_started" as const,
    };
    expect(canPublishRevision(revision)).toBe(false);
    expect(canPublishRevision({ ...revision, audioMode: "keep" })).toBe(true);
    expect(requiresFreshAudio("旧口播", "新口播")).toBe(true);
    expect(requiresFreshAudio("相同口播", " 相同口播 ")).toBe(false);
  });
});
