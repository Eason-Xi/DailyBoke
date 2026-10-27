import type { Metadata } from "next";
import { ArchiveExplorer } from "@/components/archive-explorer";
import { getPublishedEpisodes } from "@/lib/content-store";

export const metadata: Metadata = { title: "往期节目" };
export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const episodes = await getPublishedEpisodes();
  return (
    <main id="main-content" className="archive-page">
      <section className="archive-hero shell">
        <span className="eyebrow">Archive / 往期</span>
        <h1>每一期，都能回到原始事实。</h1>
        <p>按日期、公司和主题筛选，也可以直接搜索完整逐字稿。</p>
      </section>
      <section className="shell archive-content">
        <ArchiveExplorer episodes={episodes} />
      </section>
    </main>
  );
}
