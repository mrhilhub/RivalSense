import Link from 'next/link';

export default function Home() {
  return <main style={{maxWidth:960, margin:'0 auto', padding:'72px 24px'}}>
    <section className="grid" style={{gap:28}}>
      <p className="muted">AI market intelligence for product, strategy, and investing teams</p>
      <h1 style={{fontSize:64, lineHeight:1, margin:0}}>Ask anything about AI company changes.</h1>
      <p className="muted" style={{fontSize:20, maxWidth:680}}>RivalSense tracks AI companies in the background and turns product, pricing, model, agent, partnership, and platform changes into searchable intelligence with sources.</p>
      <div style={{display:'flex', gap:12}}>
        <Link className="btn" href="/signup" style={{textDecoration:'none'}}>Ask RivalSense</Link>
        <Link href="/login" className="muted" style={{padding:'10px 14px'}}>Log in</Link>
      </div>
    </section>
  </main>;
}
