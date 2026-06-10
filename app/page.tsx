import Link from 'next/link';

export default function Home() {
  return <main style={{maxWidth:960, margin:'0 auto', padding:'72px 24px'}}>
    <section className="grid" style={{gap:28}}>
      <p className="muted">The intelligence layer for the AI industry</p>
      <h1 style={{fontSize:64, lineHeight:1, margin:0}}>Understand what AI companies are doing, before everyone else</h1>
      <p className="muted" style={{fontSize:20, maxWidth:680}}>RivalSense continuously analyzes AI companies, product launches, pricing changes, documentation updates, and strategic shifts. Search the intelligence database to discover what&apos;s changing and why it matters.</p>
      <div style={{display:'flex', gap:12}}>
        <Link className="btn" href="/signup" style={{textDecoration:'none'}}>Start Searching</Link>
        <Link href="/login" className="muted" style={{padding:'10px 14px'}}>Log in</Link>
      </div>
    </section>
  </main>;
}
