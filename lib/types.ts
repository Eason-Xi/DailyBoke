export type Certainty = "fact" | "analysis" | "projection";
export type EpisodeStatus =
  | "draft"
  | "in_review"
  | "returned"
  | "approved"
  | "ready"
  | "published"
  | "failed"
  | "trashed"
  | "unlisted";
export type AudioStatus = "not_started" | "synthesizing" | "ready" | "failed";

export interface Source {
  id: string;
  title: string;
  publisher: string;
  url: string;
  publishedAt: string;
  kind: "primary" | "independent";
  supports: string;
  checkedAt: string;
}

export interface Claim {
  text: string;
  certainty: Certainty;
}

export interface AudioAsset {
  url: string;
  mime: string;
  durationSec: number;
  /** TTS model and voice, separate from storage provider. */
  provider: string;
  label: string;
  sizeBytes?: number;
  storage?: {
    provider: "local" | "r2";
    key: string;
    visibility: "private" | "public";
    /** Retained local source for retry/migration; no absolute filesystem paths. */
    localKey?: string;
    sha256?: string;
    uploadedAt?: string;
  };
}

export interface Story {
  id: string;
  rank: number;
  slug: string;
  topic: string;
  company: string;
  title: string;
  kicker: string;
  happened: string;
  whyImportant: string;
  watchNext: string;
  claims: Claim[];
  sources: Source[];
  verification: {
    status: "verified" | "needs_review";
    note: string;
    checkedBy: string;
    checkedAt: string;
  };
}

export interface Episode {
  id: string;
  slug: string;
  date: string;
  displayDate: string;
  editionLabel: string;
  title: string;
  dek: string;
  duration: string;
  status: EpisodeStatus;
  audioStatus: AudioStatus;
  audio?: AudioAsset;
  publication?: {
    publishedAt: string;
    rssGuid: string;
    error?: string;
  };
  management?: {
    previousStatus?: Exclude<EpisodeStatus, "trashed">;
    trashedAt?: string;
    unlistedAt?: string;
  };
  revisionNumber?: number;
  pendingRevision?: EpisodeRevision;
  versionHistory?: EpisodeVersion[];
  scriptMarkdown: string;
  stories: Story[];
  production: {
    generatedAt: string;
    providerSummary: string;
    reviewerNotes: string;
    qualityChecks: Array<{ label: string; passed: boolean }>;
  };
}

export interface EpisodeRevision {
  number: number;
  createdAt: string;
  updatedAt: string;
  editionLabel: string;
  title: string;
  dek: string;
  scriptMarkdown: string;
  stories: Story[];
  audioMode: "regenerate" | "keep";
  audioStatus: AudioStatus;
  audio?: Episode["audio"];
}

export interface EpisodeVersion {
  number: number;
  savedAt: string;
  editionLabel: string;
  title: string;
  dek: string;
  scriptMarkdown: string;
  stories: Story[];
  duration: string;
  audio?: Episode["audio"];
}

export interface EpisodeStore {
  episodes: Episode[];
}
