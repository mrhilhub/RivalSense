import Link from 'next/link';

export default function Home() {
  return <main style={{maxWidth:960, margin:'0 auto', padding:'72px 24px'}}>
    <section className="grid" style={{gap:28}}>
      <p className="muted">Database intelligence for engineering and platform teams</p>
      <h1 style={{fontSize:64, lineHeight:1, margin:0}}>Know when database systems change schema, releases, reliability, or pricing.</h1>
      <p className="muted" style={{fontSize:20, maxWidth:680}}>Monitor database vendors, internal platforms, status pages, docs, benchmarks, and repos. RivalSense turns meaningful changes into AI-written intelligence briefs.</p>
      <div style={{display:'flex', gap:12}}>
        <Link className="btn" href="/signup" style={{textDecoration:'none'}}>Start tracking systems</Link>
        <Link href="/login" className="muted" style={{padding:'10px 14px'}}>Log in</Link>
      </div>
    </section>
  </main>;
}
