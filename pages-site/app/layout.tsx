import type { Metadata } from "next";
import Link from "next/link";
import "../../app/globals.css";
import { basePath, siteUrl } from "../lib/content";

export const metadata: Metadata = {
  title: { default: "日更 AI · 每日新闻播客", template: "%s · 日更 AI" },
  description: "收听已发布的 AI 新闻播客、逐字稿与原始来源。",
  metadataBase: new URL(siteUrl),
  alternates: { types: { "application/rss+xml": `${siteUrl}/rss.xml` } },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hans" data-scroll-behavior="smooth"><body>
    <a href="#main-content" className="skip-link">跳到主要内容</a>
    <header className="site-header"><div className="shell header-inner"><Link href="/" className="brand" aria-label="日更 AI 首页"><span className="brand-mark" aria-hidden="true">AI</span><span><strong>日更 AI</strong><small>THE DAILY SIGNAL</small></span></Link><nav aria-label="主导航"><Link href="/">今日</Link><Link href="/archive">往期</Link><a href={`${basePath}/rss.xml`}>RSS</a></nav></div></header>
    {children}
    <footer className="site-footer"><div className="shell footer-grid"><div><div className="footer-brand">日更 AI</div><p>更少噪音，更多信号。</p></div><div><span className="eyebrow">公开节目</span><p>收听 · 阅读 · 回到原始来源</p></div><div className="footer-links"><a href={`${basePath}/rss.xml`}>RSS 订阅</a><Link href="/archive">全部节目</Link></div></div></footer>
  </body></html>;
}
