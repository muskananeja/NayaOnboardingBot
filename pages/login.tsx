import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Login() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Incorrect password.'); return; }
      router.push('/dashboard');
    } catch {
      setError('Could not sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ fontFamily: 'Poppins, sans-serif', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB' }}>
      <form onSubmit={submit} style={{ background: 'white', padding: 32, borderRadius: 14, width: 320, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <h1 style={{ fontSize: 18, marginBottom: 18, textAlign: 'center' }}>NAYA Admin</h1>
        <input
          type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Password" autoFocus
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E5E7EB', marginBottom: 12, fontSize: 14 }}
        />
        {error && <div style={{ color: '#EF4444', fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
        <button type="submit" disabled={busy} style={{ width: '100%', padding: '11px', borderRadius: 8, border: 'none', background: '#1E3A5F', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
