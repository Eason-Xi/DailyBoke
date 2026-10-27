"use client";

import { useState, useTransition } from "react";
import { StatusPill } from "./status-pill";
import type { Episode } from "@/lib/types";
import { normalizeTtsScript, ttsPronunciationNotes } from "@/lib/tts-script";

type ActionName =
  | "submit" | "return" | "approve" | "regenerate" | "publish" | "retry"
  | "trash" | "restore" | "unpublish" | "republish"
  | "edit_published" | "preview_revision" | "publish_revision" | "cancel_revision" | "rollback";

const actionLabels: Record<ActionName, string> = {
  submit: "提交审核",
  return: "退回修改",
  approve: "生成 MiMo 正式预览",
  regenerate: "按发音规则重新生成",
  publish: "通过并发布",
  retry: "重试发布",
  trash: "移至回收站",
  restore: "恢复内容",
  unpublish: "下架节目",
  republish: "重新发布",
  edit_published: "编辑已发布内容",
  preview_revision: "生成修订版 MiMo 预览",
  publish_revision: "通过并更新发布",
  cancel_revision: "放弃修订草稿",
  rollback: "回退上一版本",
};

function availableActions(episode: Episode): ActionName[] {
  if (episode.status === "draft" || episode.status === "returned") return ["submit"];
  if (episode.status === "in_review") return ["return", "approve"];
  if (episode.status === "ready") return ["regenerate", "publish"];
  if (episode.status === "approved") return ["publish"];
  if (episode.status === "failed") return ["retry"];
  if (episode.status === "trashed") return ["restore"];
  if (episode.status === "unlisted") return ["republish"];
  if (episode.status === "published" && !episode.pendingRevision) {
    return episode.versionHistory?.length ? ["edit_published", "rollback"] : ["edit_published"];
  }
  if (episode.status === "published" && episode.pendingRevision) {
    if (episode.pendingRevision.audioMode === "keep") return ["publish_revision"];
    if (episode.pendingRevision.audioStatus === "ready") return ["preview_revision", "publish_revision"];
    return ["preview_revision"];
  }
  return [];
}

function managementAction(episode: Episode): ActionName | undefined {
  if (["draft", "in_review", "returned", "approved", "ready", "failed"].includes(episode.status)) return "trash";
  if (episode.status === "published") return episode.pendingRevision ? "cancel_revision" : "unpublish";
}

export function ReviewStudio({ initialEpisodes }: { initialEpisodes: Episode[] }) {
  const [episodes, setEpisodes] = useState(initialEpisodes);
  const [selectedId, setSelectedId] = useState(initialEpisodes.find((episode) => episode.status !== "published")?.id ?? initialEpisodes[0]?.id);
  const selected = episodes.find((episode) => episode.id === selectedId);
  const initialRevision = selected?.pendingRevision;
  const [draftScript, setDraftScript] = useState(initialRevision?.scriptMarkdown ?? selected?.scriptMarkdown ?? "");
  const [draftTitle, setDraftTitle] = useState(initialRevision?.title ?? selected?.title ?? "");
  const [draftDek, setDraftDek] = useState(initialRevision?.dek ?? selected?.dek ?? "");
  const [draftEditionLabel, setDraftEditionLabel] = useState(initialRevision?.editionLabel ?? selected?.editionLabel ?? "");
  const [draftStories, setDraftStories] = useState(JSON.stringify(initialRevision?.stories ?? selected?.stories ?? [], null, 2));
  const [audioMode, setAudioMode] = useState<"regenerate" | "keep">(initialRevision?.audioMode ?? "regenerate");
  const [notice, setNotice] = useState("");
  const [isPending, startTransition] = useTransition();

  function selectEpisode(episode: Episode) {
    setSelectedId(episode.id);
    syncDraft(episode);
    setNotice("");
  }

  function syncDraft(episode: Episode) {
    const revision = episode.pendingRevision;
    setDraftScript(revision?.scriptMarkdown ?? episode.scriptMarkdown);
    setDraftTitle(revision?.title ?? episode.title);
    setDraftDek(revision?.dek ?? episode.dek);
    setDraftEditionLabel(revision?.editionLabel ?? episode.editionLabel);
    setDraftStories(JSON.stringify(revision?.stories ?? episode.stories, null, 2));
    setAudioMode(revision?.audioMode ?? "regenerate");
  }

  async function saveScript() {
    if (!selected) return;
    let stories: Episode["stories"] | undefined;
    if (selected.pendingRevision) {
      try { stories = JSON.parse(draftStories) as Episode["stories"]; }
      catch { throw new Error("三条要点与来源的 JSON 格式不正确。"); }
    }
    const response = await fetch(`/api/review/${selected.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(selected.pendingRevision ? {
        scriptMarkdown: draftScript,
        title: draftTitle,
        dek: draftDek,
        editionLabel: draftEditionLabel,
        stories,
        audioMode,
      } : { scriptMarkdown: draftScript }),
    });
    const payload = await response.json() as { episode?: Episode; error?: string };
    if (!response.ok || !payload.episode) throw new Error(payload.error ?? "保存失败");
    setEpisodes((current) => current.map((episode) => episode.id === payload.episode?.id ? payload.episode : episode));
    syncDraft(payload.episode);
    setNotice(selected.pendingRevision ? "修订草稿已保存，线上版本没有变化。" : "文稿已保存。");
  }

  async function runAction(action: ActionName) {
    if (!selected) return;
    const response = await fetch(`/api/review/${selected.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const payload = await response.json() as { episode?: Episode; error?: string };
    if (payload.episode) {
      setEpisodes((current) => current.map((episode) => episode.id === payload.episode?.id ? payload.episode : episode));
      syncDraft(payload.episode);
    }
    if (!response.ok || !payload.episode) throw new Error(payload.error ?? "操作失败");
    setNotice(`${actionLabels[action]}完成。`);
  }

  function confirmAndRun(action: ActionName) {
    if (!selected) return;
    const messages: Partial<Record<ActionName, string>> = {
      trash: `将“${selected.title}”移至回收站？文稿和音频都会保留，可以随时恢复。`,
      unpublish: `下架“${selected.title}”？它会立即从首页、往期和 RSS 移除，但记录与音频会保留。`,
      cancel_revision: `放弃“${selected.title}”的修订草稿？线上版本不会受影响，但未发布的修订内容会丢失。`,
      rollback: `将“${selected.title}”回退到上一版本？首页、往期和 RSS 会同步更新，当前版本仍保留在历史中。`,
    };
    const message = messages[action];
    if (!message || window.confirm(message)) handle(() => runAction(action));
  }

  function handle(task: () => Promise<void>) {
    setNotice("");
    startTransition(async () => {
      try { await task(); }
      catch (error) { setNotice(error instanceof Error ? error.message : "操作失败"); }
    });
  }

  if (!selected) return <div className="no-results">还没有可审核的节目。</div>;

  const passingChecks = selected.production.qualityChecks.filter((check) => check.passed).length;
  const revision = selected.pendingRevision;
  const effectiveStories = revision?.stories ?? selected.stories;
  const previewAudio = revision?.audio ?? selected.audio;
  const hasUnsavedChanges = revision
    ? draftScript !== revision.scriptMarkdown
      || draftTitle !== revision.title
      || draftDek !== revision.dek
      || draftEditionLabel !== revision.editionLabel
      || draftStories !== JSON.stringify(revision.stories, null, 2)
      || audioMode !== revision.audioMode
    : draftScript !== selected.scriptMarkdown;

  return (
    <div className="review-layout">
      <aside className="review-queue" aria-label="节目审核队列">
        <div className="queue-head">
          <span className="eyebrow">Queue</span>
          <strong>{episodes.length} 期</strong>
        </div>
        {episodes.map((episode) => (
          <button className={`queue-item ${episode.id === selected.id ? "active" : ""}`} key={episode.id} onClick={() => selectEpisode(episode)}>
            <span>{episode.displayDate}</span>
            <strong>{episode.title}</strong>
            <StatusPill status={episode.status} />
          </button>
        ))}
      </aside>

      <div className="review-main">
        <header className="review-titlebar">
          <div>
            <div className="review-statuses">
              <StatusPill status={selected.status} />
              <span>音频：</span><StatusPill status={selected.audioStatus} />
            </div>
            <h1>{revision?.title ?? selected.title}</h1>
            <p>{revision?.editionLabel ?? selected.editionLabel} · {selected.production.providerSummary}</p>
            {revision ? <p className="revision-banner">正在编辑修订版 v{revision.number}；当前线上 v{selected.revisionNumber ?? 1} 继续可用。</p> : null}
          </div>
          <div className="quality-score" aria-label={`${passingChecks} 项质量检查通过，共 ${selected.production.qualityChecks.length} 项`}>
            <strong>{passingChecks}/{selected.production.qualityChecks.length}</strong>
            <span>质量检查</span>
          </div>
        </header>

        <section className="review-audio-preview" aria-label="音频审核">
          <div>
            <span className="eyebrow">Audio review</span>
            <h2>{previewAudio ? (revision ? `修订版 v${revision.number} 音频预览` : "MiMo 正式预览") : "尚未生成音频预览"}</h2>
            <p>
              {previewAudio
                ? `${previewAudio.label} · ${revision?.audio ? `${Math.floor(previewAudio.durationSec / 60)} 分 ${previewAudio.durationSec % 60} 秒` : selected.duration}`
                : "文稿确认后点击“生成 MiMo 正式预览”，试听通过后再发布。"}
            </p>
          </div>
          {previewAudio ? (
            <audio controls preload="metadata" src={previewAudio.url} aria-label={`试听 ${revision?.title ?? selected.title}`} />
          ) : (
            <span className="audio-waiting">等待合成</span>
          )}
        </section>

        <section className="review-panel">
          <div className="panel-heading">
            <div><span>01</span><h2>来源与交叉核验</h2></div>
            <small>每条核心事实至少两个来源</small>
          </div>
          <div className="verification-list">
            {effectiveStories.map((story) => (
              <details key={story.id} open>
                <summary>
                  <span className="check-mark">✓</span>
                  <span><strong>{story.title}</strong><small>{story.sources.length} 个来源 · {story.verification.status === "verified" ? "已核验" : "需复核"}</small></span>
                  <span aria-hidden="true">＋</span>
                </summary>
                <div className="verification-detail">
                  <p>{story.verification.note}</p>
                  {story.sources.map((source) => (
                    <a href={source.url} target="_blank" rel="noreferrer" key={source.id}>
                      <span className={`source-kind ${source.kind}`}>{source.kind === "primary" ? "一手" : "独立"}</span>
                      <span><strong>{source.publisher}</strong><small>{source.publishedAt} · {source.supports}</small></span>
                      <span aria-hidden="true">↗</span>
                    </a>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>

        <section className="review-panel">
          <div className="panel-heading">
            <div><span>02</span><h2>播客稿预览与修改</h2></div>
            <small>{revision ? "修订草稿不会立即影响线上版本" : "保存后再执行状态操作"}</small>
          </div>
          {revision ? (
            <div className="revision-fields">
              <label><span>标题</span><input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} /></label>
              <label><span>摘要</span><textarea rows={3} value={draftDek} onChange={(event) => setDraftDek(event.target.value)} /></label>
              <label><span>栏目 / 元数据</span><input value={draftEditionLabel} onChange={(event) => setDraftEditionLabel(event.target.value)} /></label>
              <label>
                <span>三条要点与来源（JSON）</span>
                <textarea className="story-json-editor" rows={14} value={draftStories} onChange={(event) => setDraftStories(event.target.value)} spellCheck={false} />
              </label>
              <fieldset className="audio-mode-fieldset">
                <legend>本次修订的音频处理</legend>
                <label><input type="radio" name="audio-mode" checked={audioMode === "regenerate"} onChange={() => setAudioMode("regenerate")} /> 重新生成 MiMo 音频并试听</label>
                <label><input type="radio" name="audio-mode" checked={audioMode === "keep"} onChange={() => setAudioMode("keep")} /> 保留现有音频（文字与音频可能不一致）</label>
              </fieldset>
            </div>
          ) : null}
          <label className="script-editor">
            <span className="sr-only">播客逐字稿</span>
            <textarea value={draftScript} onChange={(event) => setDraftScript(event.target.value)} rows={18} spellCheck readOnly={selected.status === "published" && !revision} />
          </label>
          <div className="editor-actions">
            <button className="button button-outline" disabled={isPending || !hasUnsavedChanges} onClick={() => handle(saveScript)}>{revision ? "保存修订草稿" : "保存文稿"}</button>
            <span>{draftScript.length} 字符 · 预计 {Math.max(1, Math.round(draftScript.length / 250))} 分钟</span>
          </div>
          <details className="tts-script-preview">
            <summary>查看 TTS 播报文本与发音规则</summary>
            <div>
              <ul>
                {ttsPronunciationNotes.map((note) => <li key={note}>{note}</li>)}
              </ul>
              <pre>{normalizeTtsScript(draftScript)}</pre>
            </div>
          </details>
        </section>

        <section className="review-panel production-panel">
          <div className="panel-heading">
            <div><span>03</span><h2>质量门槛与发布</h2></div>
            <small>状态变更会写入本地数据文件</small>
          </div>
          <div className="checklist">
            {selected.production.qualityChecks.map((check) => (
              <div className={check.passed ? "passed" : "warning"} key={check.label}>
                <span aria-hidden="true">{check.passed ? "✓" : "!"}</span><span>{check.label}</span>
              </div>
            ))}
          </div>
          {selected.publication?.error ? <div className="error-banner" role="alert">发布失败：{selected.publication.error}</div> : null}
          <div className="workflow-actions">
            {availableActions(selected).map((action) => (
              <button
                key={action}
                className={`button ${action === "return" ? "button-outline" : "button-dark"}`}
                disabled={isPending || hasUnsavedChanges}
                onClick={() => ["rollback"].includes(action) ? confirmAndRun(action) : handle(() => runAction(action))}
              >
                {isPending ? "处理中…" : actionLabels[action]}
              </button>
            ))}
            {managementAction(selected) ? (
              <button
                className="button button-danger-outline"
                disabled={isPending || hasUnsavedChanges}
                onClick={() => confirmAndRun(managementAction(selected)!)}
              >
                {actionLabels[managementAction(selected)!]}
              </button>
            ) : null}
            {selected.status === "published" ? <span className="published-message">✓ 已进入首页与 RSS</span> : null}
            {selected.status === "unlisted" ? <span className="unlisted-message">已从首页、往期与 RSS 移除，记录与音频仍保留。</span> : null}
            {selected.status === "trashed" ? <span className="unlisted-message">内容位于回收站，文稿与音频仍保留。</span> : null}
          </div>
          <p className="action-hint" aria-live="polite">{notice || (hasUnsavedChanges ? "有未保存的修改。" : revision?.audioMode === "keep" ? "将保留现有音频；请确认文字与声音差异可接受。" : "")}</p>
        </section>
      </div>
    </div>
  );
}
