import type { AudioStatus, EpisodeStatus } from "@/lib/types";

const labels: Record<EpisodeStatus | AudioStatus, string> = {
  draft: "草稿",
  in_review: "待审核",
  returned: "已退回",
  approved: "已通过",
  ready: "音频待审核",
  published: "已发布",
  failed: "失败",
  trashed: "回收站",
  unlisted: "已下架",
  not_started: "未合成",
  synthesizing: "合成中",
};

export function StatusPill({ status }: { status: EpisodeStatus | AudioStatus }) {
  return <span className={`status-pill status-${status}`}>{labels[status]}</span>;
}
