'use client';
import { useState } from 'react';
import { supabaseAnon } from '@/lib/supabaseClient';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = supabaseAnon();
    const { error } = await supabase.auth.signUp({ email, password });
    setMsg(error ? error.message : 'Check your email, then log in.');
  }
  return <main style={{maxWidth:420, margin:'60px auto', padding:24}} className="grid">
    <h1>Create account</h1>
    <form onSubmit={submit} className="card grid">
      <input className="input" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input className="input" placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
      <button className="btn">Sign up</button>
      <p className="muted">{msg}</p>
    </form>
  </main>;
}
