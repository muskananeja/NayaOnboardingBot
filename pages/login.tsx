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
    <div className="naya-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <form onSubmit={submit} className="naya-card-entry" style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: 'white', border: '3px solid var(--navy)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 22,
          color: 'var(--navy)', margin: '0 auto 16px',
        }}>N</div>
        <h1 style={{
          fontSize: 22, fontWeight: 800, margin: '0 0 6px',
          background: 'var(--primary-grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>NAYA Admin</h1>
        <p style={{ fontSize: 13, color: 'var(--g500)', margin: '0 0 24px' }}>Sign in to manage onboarding journeys.</p>
        <label className="naya-label" htmlFor="password" style={{ textAlign: 'left' }}>Password</label>
        <input
          id="password" type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Enter your password" autoFocus className="naya-input" style={{ marginBottom: 16 }}
        />
        {error && <div className="naya-error" style={{ marginBottom: 14, textAlign: 'left' }}>{error}</div>}
        <button type="submit" disabled={busy} className="naya-btn naya-btn-primary" style={{ width: '100%' }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
