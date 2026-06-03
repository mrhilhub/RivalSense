'use client';
import { useState } from 'react';
import { supabaseAnon } from '@/lib/supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = supabaseAnon();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message); else window.location.href = '/dashboard';
  }
  return <main style={{maxWidth:420, margin:'60px auto', padding:24}} className="grid">
    <h1>Log in</h1>
    <form onSubmit={submit} className="card grid">
      <input className="input" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input className="input" placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
      <button className="btn">Log in</button>
      <p className="muted">{msg}</p>
    </form>
  </main>;
}
