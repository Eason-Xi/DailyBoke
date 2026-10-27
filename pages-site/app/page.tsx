import { Episode } from "../components/episode";
import { episodes } from "../lib/content";

export default function HomePage() {
  const episode = episodes[0];
  return <main id="main-content">{episode ? <Episode episode={episode} /> : <section className="shell empty-state"><h1>节目即将上线。</h1></section>}</main>;
}
