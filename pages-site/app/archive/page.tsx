import Link from "next/link";
import { audioUrl, episodes } from "../../lib/content";

export const metadata = { title: "往期节目" };

export default function ArchivePage() {
  return <main id="main-content" className="archive-page"><section className="archive-hero shell"><span className="eyebrow">Archive / 往期</span><h1>每一期，都能回到原始事实。</h1><p>收听往期节目，阅读逐字稿和原始来源。</p></section><section className="shell archive-content"><div className="result-count">{episodes.length} 期节目</div><div className="episode-list">{episodes.map(episode => <article className="episode-row" key={episode.id}><time dateTime={episode.date}><strong>{episode.date.slice(8)}</strong><span>{episode.date.slice(0, 7)}</span></time><div><span className="episode-label">{episode.editionLabel}</span><h2><Link href={`/episodes/${episode.slug}`}>{episode.title}</Link></h2><p>{episode.dek}</p><div className="episode-tags">{[...new Set(episode.stories.map(story => story.company))].map(company => <span key={company}>{company}</span>)}</div></div><div className="episode-actions"><span>{episode.duration}</span>{episode.audio ? <audio controls preload="none" src={audioUrl(episode.audio.url)} aria-label={`收听 ${episode.title}`} /> : null}<Link href={`/episodes/${episode.slug}`}>逐字稿与来源 →</Link></div></article>)}</div></section></main>;
}
