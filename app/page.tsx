import Link from 'next/link';

export default function Home() {
  return <main style={{maxWidth:960, margin:'0 auto', padding:'72px 24px'}}>
    <section className="grid" style={{gap:28}}>
      <p className="muted">Competitive intelligence for AI product teams</p>
      <h1 style={{fontSize:64, lineHeight:1, margin:0}}>Know when competitors change pricing, docs, features, or repos.</h1>
      <p className="muted" style={{fontSize:20, maxWidth:680}}>Monitor competitor pages and get AI-written alerts when meaningful changes happen. Built for AI startups tracking fast-moving markets.</p>
      <div style={{display:'flex', gap:12}}>
        <Link className="btn" href="/signup" style={{textDecoration:'none'}}>Start monitoring</Link>
        <Link href="/login" className="muted" style={{padding:'10px 14px'}}>Log in</Link>
      </div>
    </section>
  </main>;
}
