"use client";

import { useMemo, useState } from "react";
import type { Episode } from "@/lib/types";

export function ArchiveExplorer({ episodes }: { episodes: Episode[] }) {
  const [query, setQuery] = useState("");
  const [company, setCompany] = useState("全部公司");
  const [topic, setTopic] = useState("全部主题");

  const companies = useMemo(
    () => ["全部公司", ...new Set(episodes.flatMap((episode) => episode.stories.map((story) => story.company)))],
    [episodes],
  );
  const topics = useMemo(
    () => ["全部主题", ...new Set(episodes.flatMap((episode) => episode.stories.map((story) => story.topic)))],
    [episodes],
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return episodes.filter((episode) => {
      const searchable = [episode.title, episode.dek, episode.scriptMarkdown, ...episode.stories.map((story) => story.title)].join(" ").toLowerCase();
      const matchesQuery = !normalized || searchable.includes(normalized);
      const matchesCompany = company === "全部公司" || episode.stories.some((story) => story.company === company);
      const matchesTopic = topic === "全部主题" || episode.stories.some((story) => story.topic === topic);
      return matchesQuery && matchesCompany && matchesTopic;
    });
  }, [company, episodes, query, topic]);

  return (
    <div>
      <div className="archive-filters" aria-label="节目筛选">
        <label className="search-box">
          <span className="sr-only">搜索节目与逐字稿</span>
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索节目与逐字稿…" type="search" />
        </label>
        <label>
          <span className="sr-only">按公司筛选</span>
          <select value={company} onChange={(event) => setCompany(event.target.value)}>
            {companies.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">按主题筛选</span>
          <select value={topic} onChange={(event) => setTopic(event.target.value)}>
            {topics.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>

      <div className="result-count" aria-live="polite">找到 {filtered.length} 期节目</div>
      <div className="episode-list">
        {filtered.map((episode) => (
          <article className="episode-row" key={episode.id}>
            <time dateTime={episode.date}>
              <strong>{episode.date.slice(8, 10)}</strong>
              <span>{episode.date.slice(0, 7)}</span>
            </time>
            <div>
              <span className="episode-label">{episode.editionLabel}</span>
              <h2>{episode.title}</h2>
              <p>{episode.dek}</p>
              <div className="episode-tags">
                {[...new Set(episode.stories.flatMap((story) => [story.company, story.topic]))].map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            </div>
            <div className="episode-actions">
              <span>{episode.duration}</span>
              {episode.audio ? <audio controls preload="none" src={episode.audio.url} aria-label={`播放 ${episode.title}`} /> : null}
            </div>
          </article>
        ))}
        {filtered.length === 0 ? (
          <div className="no-results">
            <h2>没有匹配的节目</h2>
            <p>试试更短的关键词，或清除公司与主题筛选。</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
