import Link from "next/link";
import { StoryCard } from "@/components/story-card";
import { getLatestPublishedEpisode } from "@/lib/content-store";

export const dynamic = "force-dynamic";

function splitTranscript(script: string) {
  return script.split("\n\n").filter(Boolean);
}

export default async function HomePage() {
  const episode = await getLatestPublishedEpisode();

  if (!episode) {
    return (
      <main id="main-content" className="shell empty-state">
        <span className="eyebrow">今日节目</span>
        <h1>编辑正在核验今天的新闻。</h1>
        <p>宁可晚一点，也不把未证实消息放进主节目。</p>
        <Link className="button" href="/archive">浏览往期</Link>
      </main>
    );
  }

  const sourceCount = episode.stories.reduce((total, story) => total + story.sources.length, 0);
  const verifiedCount = episode.stories.filter((story) => story.verification.status === "verified").length;

  return (
    <main id="main-content">
      <section className="hero shell">
        <div className="hero-copy">
          <div className="live-line">
            <span className="signal-dot" aria-hidden="true" />
            <span>{episode.editionLabel}</span>
            <span>{episode.displayDate}</span>
          </div>
          <h1>{episode.title}</h1>
          <p className="dek">{episode.dek}</p>
          <div className="hero-meta">
            <span>第 001 期</span>
            <span>{episode.duration}</span>
            <span>3 条重要新闻</span>
          </div>
        </div>
        <aside className="editorial-note" aria-label="节目说明">
          <span className="eyebrow">编者说明</span>
          <p>资料截止到 {episode.displayDate}。型号、价格和基准口径均已核对；厂商结论与独立观察分开呈现。</p>
          <span className="editor-sign">DailyBoke / 001</span>
        </aside>
      </section>

      <section className="player-band">
        <div className="shell player-grid">
          <div>
            <span className="eyebrow light">现在播放</span>
            <h2>日更 AI · {episode.displayDate}</h2>
            <p>{episode.audio?.label ?? "音频准备中"}</p>
          </div>
          {episode.audio ? (
            <audio className="audio-player" controls preload="metadata">
              <source src={episode.audio.url} type={episode.audio.mime} />
              您的浏览器不支持音频播放。
            </audio>
          ) : (
            <div className="audio-fallback">音频尚未发布，逐字稿已可阅读。</div>
          )}
        </div>
      </section>

      <section className="shell stories-section" aria-labelledby="today-stories">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Today&apos;s signals</span>
            <h2 id="today-stories">今天，只讲这三件事</h2>
          </div>
          <p>每条新闻都回答三个问题，并保留原始出处。</p>
        </div>
        <div className="story-list">
          {episode.stories.map((story) => <StoryCard key={story.id} story={story} />)}
        </div>
      </section>

      <section className="transcript-section">
        <div className="shell transcript-grid">
          <div className="transcript-intro">
            <span className="eyebrow">完整逐字稿</span>
            <h2>{episode.duration}，建立今天的 AI 判断框架。</h2>
            <p>稿件经过人工审核。事实陈述以来源为依据；影响判断和未来推测会明确提示。</p>
          </div>
          <details className="transcript" open>
            <summary>阅读完整逐字稿 <span>{episode.duration}</span></summary>
            <div className="transcript-copy">
              {splitTranscript(episode.scriptMarkdown).map((paragraph, index) => (
                <p key={`${index}-${paragraph.slice(0, 12)}`}>{paragraph}</p>
              ))}
            </div>
          </details>
        </div>
      </section>

      <section className="shell sources-section" aria-labelledby="sources-title">
        <div className="section-heading compact">
          <div>
            <span className="eyebrow">Source ledger</span>
            <h2 id="sources-title">原始来源与核验</h2>
          </div>
          <span className="verified-seal">{sourceCount} 个来源 · {verifiedCount} 条核验通过</span>
        </div>
        <div className="source-grid">
          {episode.stories.map((story) => (
            <article className="source-group" key={story.id}>
              <div className="source-group-head">
                <span>0{story.rank}</span>
                <h3>{story.company}</h3>
              </div>
              {story.sources.map((source) => (
                <a key={source.id} href={source.url} target="_blank" rel="noreferrer" className="source-link">
                  <span className={`source-kind ${source.kind}`}>{source.kind === "primary" ? "一手" : "独立"}</span>
                  <span>
                    <strong>{source.publisher}</strong>
                    <small>{source.publishedAt} · {source.title}</small>
                  </span>
                  <span aria-hidden="true">↗</span>
                </a>
              ))}
              <p className="verification-note">{story.verification.status === "verified" ? "✓" : "△"} {story.verification.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="archive-cta shell">
        <div>
          <span className="eyebrow">继续收听</span>
          <h2>需要背景，而不是更多推送。</h2>
        </div>
        <Link className="button button-dark" href="/archive">查看全部往期 <span aria-hidden="true">→</span></Link>
      </section>
    </main>
  );
}
