import type { EpisodeRevision, EpisodeStatus } from "./types";

const transitions: Record<EpisodeStatus, EpisodeStatus[]> = {
  draft: ["in_review"],
  in_review: ["returned", "ready"],
  returned: ["in_review"],
  approved: ["ready", "failed"],
  ready: ["published", "failed"],
  published: ["unlisted"],
  failed: ["published", "failed"],
  trashed: ["draft", "in_review", "returned", "approved", "ready", "failed"],
  unlisted: ["published"],
};

export function canTransition(from: EpisodeStatus, to: EpisodeStatus) {
  return transitions[from].includes(to);
}

export function hasIndependentPair(kinds: Array<"primary" | "independent">) {
  return new Set(kinds).size >= 2;
}

export function isPublicEpisode(status: EpisodeStatus) {
  return status === "published";
}

export function requiresFreshAudio(previousScript: string, nextScript: string) {
  return previousScript.trim() !== nextScript.trim();
}

export function canPublishRevision(revision: EpisodeRevision) {
  return revision.audioMode === "keep" || (revision.audioStatus === "ready" && Boolean(revision.audio));
}
