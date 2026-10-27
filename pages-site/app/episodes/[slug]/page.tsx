import { notFound } from "next/navigation";
import { Episode } from "../../../components/episode";
import { episodes } from "../../../lib/content";

export const dynamicParams = false;
export function generateStaticParams() { return episodes.map(episode => ({ slug: episode.slug })); }

export default async function EpisodePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const episode = episodes.find(item => item.slug === slug);
  if (!episode) notFound();
  return <main id="main-content"><Episode episode={episode} /></main>;
}
