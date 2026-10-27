import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getEpisode, updateEpisode } from "@/lib/content-store";
import { getTtsProvider } from "@/lib/providers";
import { formatDurationZh } from "@/lib/tts-script";
import { canPublishRevision, requiresFreshAudio } from "@/lib/workflow";
import type { Episode, EpisodeRevision, EpisodeStatus, EpisodeVersion, Story } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };
type ActionName =
  | "submit" | "return" | "approve" | "regenerate" | "publish" | "retry"
  | "trash" | "restore" | "unpublish" | "republish"
  | "edit_published" | "preview_revision" | "publish_revision" | "cancel_revision" | "rollback";

const allowedActions: Record<EpisodeStatus, ActionName[]> = {
  draft: ["submit", "trash"],
  in_review: ["return", "approve", "trash"],
  returned: ["submit", "trash"],
  approved: ["publish", "trash"],
  ready: ["regenerate", "publish", "trash"],
  published: ["edit_published", "preview_revision", "publish_revision", "cancel_revision", "rollback", "unpublish"],
  failed: ["retry", "trash"],
  trashed: ["restore"],
  unlisted: ["republish"],
};

function invalidatePages() {
  revalidatePath("/");
  revalidatePath("/archive");
  revalidatePath("/review");
  revalidatePath("/rss.xml");
}

function versionSnapshot(item: Episode, savedAt: string): EpisodeVersion {
  return {
    number: item.revisionNumber ?? 1,
    savedAt,
    editionLabel: item.editionLabel,
    title: item.title,
    dek: item.dek,
    scriptMarkdown: item.scriptMarkdown,
    stories: item.stories,
    duration: item.duration,
    audio: item.audio,
  };
}

function audioFromResult(result: Awaited<ReturnType<ReturnType<typeof getTtsProvider>["synthesize"]>>) {
  return {
    url: result.publicUrl,
    mime: result.mime,
    durationSec: result.durationSec,
    provider: result.provider,
    label: result.label,
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const current = await getEpisode(id);
  if (!current) return NextResponse.json({ error: "未找到节目。" }, { status: 404 });

  const body = await request.json() as {
    scriptMarkdown?: unknown;
    title?: unknown;
    dek?: unknown;
    editionLabel?: unknown;
    stories?: unknown;
    audioMode?: unknown;
  };
  if (typeof body.scriptMarkdown !== "string" || body.scriptMarkdown.trim().length < 80) {
    return NextResponse.json({ error: "文稿至少需要 80 个字符。" }, { status: 400 });
  }

  if (current.pendingRevision) {
    if (typeof body.title !== "string" || !body.title.trim()) return NextResponse.json({ error: "标题不能为空。" }, { status: 400 });
    if (typeof body.dek !== "string" || !body.dek.trim()) return NextResponse.json({ error: "摘要不能为空。" }, { status: 400 });
    if (typeof body.editionLabel !== "string" || !body.editionLabel.trim()) return NextResponse.json({ error: "栏目标签不能为空。" }, { status: 400 });
    if (!Array.isArray(body.stories) || body.stories.length !== 3) return NextResponse.json({ error: "必须保留三条要点及其来源。" }, { status: 400 });
    if (body.audioMode !== "regenerate" && body.audioMode !== "keep") return NextResponse.json({ error: "请选择音频处理方式。" }, { status: 400 });

    const episode = await updateEpisode(id, (item) => ({
      ...item,
      pendingRevision: {
        ...item.pendingRevision!,
        title: body.title!.toString().trim(),
        dek: body.dek!.toString().trim(),
        editionLabel: body.editionLabel!.toString().trim(),
        scriptMarkdown: body.scriptMarkdown!.toString().trim(),
        stories: body.stories as Story[],
        audioMode: body.audioMode as EpisodeRevision["audioMode"],
        audioStatus: body.audioMode === "keep" ? "ready" : item.pendingRevision!.audioStatus,
        audio: body.audioMode === "keep" ? item.audio : item.pendingRevision!.audio,
        updatedAt: new Date().toISOString(),
      },
    }));
    invalidatePages();
    return NextResponse.json({ episode });
  }

  if (current.status === "published") {
    return NextResponse.json({ error: "已发布内容请先创建修订草稿，线上版本不会被直接覆盖。" }, { status: 409 });
  }
  const nextScript = body.scriptMarkdown.toString().trim();
  const episode = await updateEpisode(id, (item) => {
    const changed = requiresFreshAudio(item.scriptMarkdown, nextScript);
    return {
      ...item,
      scriptMarkdown: nextScript,
      ...(changed && item.audio ? { status: "in_review" as const, audioStatus: "not_started" as const, audio: undefined } : {}),
    };
  });
  invalidatePages();
  return NextResponse.json({ episode });
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const current = await getEpisode(id);
  if (!current) return NextResponse.json({ error: "未找到节目。" }, { status: 404 });

  const body = await request.json() as { action?: ActionName };
  const action = body.action;
  if (!action || !allowedActions[current.status].includes(action)) {
    return NextResponse.json({ error: `状态 ${current.status} 不允许执行此操作。` }, { status: 409 });
  }

  const now = new Date().toISOString();

  if (action === "trash") {
    const episode = await updateEpisode(id, (item) => ({
      ...item,
      status: "trashed",
      management: { ...item.management, previousStatus: item.status === "trashed" ? "draft" : item.status, trashedAt: now },
    }));
    invalidatePages();
    return NextResponse.json({ episode });
  }

  if (action === "restore") {
    const episode = await updateEpisode(id, (item) => ({
      ...item,
      status: item.management?.previousStatus ?? "draft",
      management: { ...item.management, previousStatus: undefined, trashedAt: undefined },
    }));
    invalidatePages();
    return NextResponse.json({ episode });
  }

  if (action === "unpublish" || action === "republish") {
    const episode = await updateEpisode(id, (item) => action === "unpublish" ? ({
      ...item,
      status: "unlisted",
      management: { ...item.management, unlistedAt: now },
    }) : ({
      ...item,
      status: "published",
      management: { ...item.management, unlistedAt: undefined },
      publication: { publishedAt: now, rssGuid: item.publication?.rssGuid ?? `dailyboke:${item.id}` },
    }));
    invalidatePages();
    return NextResponse.json({ episode });
  }

  if (action === "edit_published") {
    if (current.pendingRevision) return NextResponse.json({ error: "已经有一个修订草稿。" }, { status: 409 });
    const revisionNumber = (current.revisionNumber ?? 1) + 1;
    const episode = await updateEpisode(id, (item) => ({
      ...item,
      revisionNumber: item.revisionNumber ?? 1,
      pendingRevision: {
        number: revisionNumber,
        createdAt: now,
        updatedAt: now,
        editionLabel: item.editionLabel,
        title: item.title,
        dek: item.dek,
        scriptMarkdown: item.scriptMarkdown,
        stories: item.stories,
        audioMode: "regenerate",
        audioStatus: "not_started",
      },
    }));
    invalidatePages();
    return NextResponse.json({ episode });
  }

  if (action === "cancel_revision") {
    const episode = await updateEpisode(id, (item) => ({ ...item, pendingRevision: undefined }));
    invalidatePages();
    return NextResponse.json({ episode });
  }

  if (action === "preview_revision") {
    if (!current.pendingRevision) return NextResponse.json({ error: "没有可生成的修订草稿。" }, { status: 409 });
    if (current.pendingRevision.audioMode !== "regenerate") return NextResponse.json({ error: "此修订选择保留现有音频。" }, { status: 409 });
    const provider = getTtsProvider();
    await updateEpisode(id, (item) => ({ ...item, pendingRevision: { ...item.pendingRevision!, audioStatus: "synthesizing" } }));
    try {
      const result = await provider.synthesize(current.pendingRevision.scriptMarkdown, `${current.id}-revision-${current.pendingRevision.number}`);
      const episode = await updateEpisode(id, (item) => {
        if (!item.pendingRevision || item.pendingRevision.scriptMarkdown !== current.pendingRevision!.scriptMarkdown) return item;
        return { ...item, pendingRevision: { ...item.pendingRevision, audioStatus: "ready", audio: audioFromResult(result), updatedAt: now } };
      });
      if (!episode?.pendingRevision || episode.pendingRevision.scriptMarkdown !== current.pendingRevision.scriptMarkdown) {
        invalidatePages();
        return NextResponse.json({ episode, error: "合成期间修订稿发生变化，请按最新内容重新生成音频。" }, { status: 409 });
      }
      invalidatePages();
      return NextResponse.json({ episode });
    } catch (error) {
      const episode = await updateEpisode(id, (item) => ({ ...item, pendingRevision: { ...item.pendingRevision!, audioStatus: "failed" } }));
      return NextResponse.json({ episode, error: error instanceof Error ? error.message : "TTS 失败" }, { status: 502 });
    }
  }

  if (action === "publish_revision") {
    const revision = current.pendingRevision;
    if (!revision) return NextResponse.json({ error: "没有可发布的修订草稿。" }, { status: 409 });
    if (!canPublishRevision(revision)) {
      return NextResponse.json({ error: "请先生成并试听修订版 MiMo 音频。" }, { status: 409 });
    }
    const nextAudio = revision.audioMode === "keep" ? current.audio : revision.audio;
    const episode = await updateEpisode(id, (item) => ({
      ...item,
      editionLabel: revision.editionLabel,
      title: revision.title,
      dek: revision.dek,
      scriptMarkdown: revision.scriptMarkdown,
      stories: revision.stories,
      audio: nextAudio,
      audioStatus: nextAudio ? "ready" : "not_started",
      duration: nextAudio ? formatDurationZh(nextAudio.durationSec) : item.duration,
      revisionNumber: revision.number,
      versionHistory: [...(item.versionHistory ?? []), versionSnapshot(item, now)],
      pendingRevision: undefined,
      publication: { publishedAt: now, rssGuid: item.publication?.rssGuid ?? `dailyboke:${item.id}` },
    }));
    invalidatePages();
    return NextResponse.json({ episode });
  }

  if (action === "rollback") {
    const history = current.versionHistory ?? [];
    const previous = history.at(-1);
    if (!previous) return NextResponse.json({ error: "没有可回退的历史版本。" }, { status: 409 });
    const episode = await updateEpisode(id, (item) => ({
      ...item,
      editionLabel: previous.editionLabel,
      title: previous.title,
      dek: previous.dek,
      scriptMarkdown: previous.scriptMarkdown,
      stories: previous.stories,
      duration: previous.duration,
      audio: previous.audio,
      audioStatus: previous.audio ? "ready" : "not_started",
      revisionNumber: previous.number,
      versionHistory: [...history.slice(0, -1), versionSnapshot(item, now)],
      pendingRevision: undefined,
      publication: { publishedAt: now, rssGuid: item.publication?.rssGuid ?? `dailyboke:${item.id}` },
    }));
    invalidatePages();
    return NextResponse.json({ episode });
  }

  if (action === "approve" || action === "regenerate" || (action === "retry" && current.audioStatus === "failed")) {
    const provider = getTtsProvider();
    await updateEpisode(id, (item) => ({ ...item, status: "approved", audioStatus: "synthesizing" }));
    try {
      const result = await provider.synthesize(current.scriptMarkdown, current.id);
      const episode = await updateEpisode(id, (item) => {
        if (item.scriptMarkdown !== current.scriptMarkdown) return item;
        return {
          ...item,
          status: "ready",
          audioStatus: "ready",
          duration: formatDurationZh(result.durationSec),
          audio: audioFromResult(result),
          publication: undefined,
        };
      });
      if (!episode || episode.scriptMarkdown !== current.scriptMarkdown) {
        invalidatePages();
        return NextResponse.json({ episode, error: "合成期间文稿发生变化，请按最新内容重新生成音频。" }, { status: 409 });
      }
      invalidatePages();
      return NextResponse.json({ episode });
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知 TTS 错误";
      const episode = await updateEpisode(id, (item) => ({
        ...item,
        status: "failed",
        audioStatus: "failed",
        publication: { publishedAt: now, rssGuid: `dailyboke:${item.id}`, error: `TTS 失败：${message}` },
      }));
      invalidatePages();
      return NextResponse.json({ episode }, { status: 502 });
    }
  }

  const episode = await updateEpisode(id, (item): Episode => {
    if (action === "submit") return { ...item, status: "in_review" };
    if (action === "return") return { ...item, status: "returned", audioStatus: "not_started" };
    if (action === "publish" || action === "retry") return {
      ...item,
      status: "published",
      title: item.title.replace(/^待审核[：:]\s*/, ""),
      editionLabel: item.editionLabel.includes("审核") ? "已发布节目" : item.editionLabel,
      revisionNumber: item.revisionNumber ?? 1,
      publication: { publishedAt: now, rssGuid: `dailyboke:${item.id}` },
    };
    return item;
  });

  invalidatePages();
  return NextResponse.json({ episode });
}
