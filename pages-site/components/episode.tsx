import Link from "next/link";
import { audioUrl, type PublicEpisode } from "../lib/content";

export function Episode({ episode }: { episode: PublicEpisode }) {
  return (
    <>
      <section className="hero shell">
        <div className="hero-copy">
          <div className="live-line"><span className="signal-dot" aria-hidden="true" /><span>{episode.editionLabel}</span><span>{episode.displayDate}</span></div>
          <h1>{episode.title}</h1>
          <p className="dek">{episode.dek}</p>
          <div className="hero-meta"><span>{episode.duration}</span><span>{episode.stories.length} 个主题</span></div>
        </div>
        <aside className="editorial-note" aria-label="节目说明"><span className="eyebrow">日更 AI</span><p>收听已发布节目，阅读完整逐字稿，回到每条消息的原始来源。</p><span className="editor-sign">THE DAILY SIGNAL</span></aside>
      </section>
      <section className="player-band">
        <div className="shell player-grid">
          <div><span className="eyebrow light">现在播放</span><h2>日更 AI · {episode.displayDate}</h2><p>{episode.audio?.label ?? "文字节目"}</p></div>
          {episode.audio ? <audio className="audio-player" controls preload="metadata" src={audioUrl(episode.audio.url)} aria-label={`收听 ${episode.title}`} /> : null}
        </div>
      </section>
      <section className="shell stories-section" aria-labelledby="story-title">
        <div className="section-heading"><div><span className="eyebrow">Today&apos;s signals</span><h2 id="story-title">本期关注</h2></div></div>
        {episode.stories.map((story, index) => (
          <article className="story-card" key={`${index}-${story.title}`}>
            <div className="story-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</div>
            <div className="story-body">
              <div className="story-meta"><span>{story.company}</span><span>{story.topic}</span></div>
              <h3>{story.title}</h3>
              <div className="story-columns"><section><h4>发生了什么</h4><p>{story.happened}</p></section><section className="why-block"><h4>为什么重要</h4><p>{story.whyImportant}</p></section></div>
              <div className="watch-next"><span aria-hidden="true">→</span><p><strong>接下来关注</strong>{story.watchNext}</p></div>
            </div>
          </article>
        ))}
      </section>
      <section className="transcript-section">
        <div className="shell transcript-grid"><div className="transcript-intro"><span className="eyebrow">完整逐字稿</span><h2>按自己的节奏，理解每条消息。</h2><p>节目日期：{episode.displayDate}</p></div>
          <details className="transcript" open><summary>阅读完整逐字稿 <span>{episode.duration}</span></summary><div className="transcript-copy">{episode.scriptMarkdown.split("\n\n").filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div></details>
        </div>
      </section>
      <section className="shell sources-section" aria-labelledby="sources-title">
        <div className="section-heading"><div><span className="eyebrow">Source ledger</span><h2 id="sources-title">原始来源</h2></div></div>
        <div className="source-grid">{episode.stories.map((story, index) => (
          <article className="source-group" key={index}>
            <div className="source-group-head"><span>{String(index + 1).padStart(2, "0")}</span><h3>{story.company}</h3></div>
            {story.sources.map((source, sourceIndex) => <a className="source-link" key={sourceIndex} href={source.url} target="_blank" rel="noreferrer"><span className={`source-kind ${source.kind}`}>{source.kind === "primary" ? "一手" : "独立"}</span><span><strong>{source.publisher}</strong><small>{source.publishedAt} · {source.title}</small></span><span aria-hidden="true">↗</span></a>)}
          </article>
        ))}</div>
      </section>
      <section className="archive-cta shell"><div><span className="eyebrow">继续收听</span><h2>每一期，都可以回到原始出处。</h2></div><Link href="/archive" className="button button-dark">查看全部往期 →</Link></section>
    </>
  );
}
