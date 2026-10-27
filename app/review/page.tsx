import type { Metadata } from "next";
import { ReviewStudio } from "@/components/review-studio";
import { getEpisodes } from "@/lib/content-store";

export const metadata: Metadata = { title: "审核后台" };
export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const episodes = await getEpisodes();
  return (
    <main id="main-content" className="review-page">
      <section className="review-hero shell">
        <div>
          <span className="eyebrow">Editorial console</span>
          <h1>审核台</h1>
        </div>
        <p><span className="signal-dot" /> Xiaomi MiMo 优先 · 缺少密钥时本地降级</p>
      </section>
      <div className="shell review-shell"><ReviewStudio initialEpisodes={episodes} /></div>
    </main>
  );
}
