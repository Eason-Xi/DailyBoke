import type { Story } from "@/lib/types";

const certaintyLabels = { fact: "事实", analysis: "分析", projection: "推测" } as const;

export function StoryCard({ story }: { story: Story }) {
  return (
    <article className="story-card">
      <div className="story-number" aria-hidden="true">0{story.rank}</div>
      <div className="story-body">
        <div className="story-meta">
          <span>{story.kicker}</span>
          <span>{story.company}</span>
          <span>{story.topic}</span>
        </div>
        <h3>{story.title}</h3>
        <div className="story-columns">
          <section>
            <h4>发生了什么</h4>
            <p>{story.happened}</p>
          </section>
          <section className="why-block">
            <h4>为什么重要</h4>
            <p>{story.whyImportant}</p>
          </section>
        </div>
        <div className="watch-next">
          <span aria-hidden="true">→</span>
          <p><strong>接下来关注</strong>{story.watchNext}</p>
        </div>
        <div className="claim-row" aria-label="事实与观点标记">
          {story.claims.map((claim) => (
            <span className={`claim claim-${claim.certainty}`} key={claim.text} title={claim.text}>
              {certaintyLabels[claim.certainty]}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
