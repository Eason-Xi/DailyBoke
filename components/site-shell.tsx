import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link href="/" className="brand" aria-label="日更 AI 首页">
          <span className="brand-mark" aria-hidden="true">AI</span>
          <span>
            <strong>日更 AI</strong>
            <small>THE DAILY SIGNAL</small>
          </span>
        </Link>
        <nav aria-label="主导航">
          <Link href="/">今日</Link>
          <Link href="/archive">往期</Link>
          <Link href="/review" className="nav-console">审核台 <span aria-hidden="true">↗</span></Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <div className="footer-brand">日更 AI</div>
          <p>更少噪音，更多信号。</p>
        </div>
        <div>
          <span className="eyebrow">编辑标准</span>
          <p>重要性优先 · 两源核验 · 事实与判断分开</p>
        </div>
        <div className="footer-links">
          <Link href="/rss.xml">RSS</Link>
          <Link href="/archive">全部节目</Link>
          <Link href="/review">审核后台</Link>
        </div>
      </div>
    </footer>
  );
}
