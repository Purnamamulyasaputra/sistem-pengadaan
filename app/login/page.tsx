'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FullScreenLoader } from '@/components/ui/FullScreenLoader';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [demoUsers, setDemoUsers] = useState<{ name: string; email: string }[]>([]);

  useEffect(() => {
    fetch('/api/auth/login')
      .then(r => r.json())
      .then(d => { if (d.success) setDemoUsers(d.data); })
      .catch(console.error);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || 'Login gagal');
        setLoading(false);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
      setLoading(false);
    }
  }

  return (
    <>
      <FullScreenLoader open={loading} />
      <div style={{ minHeight: '100dvh', background: 'linear-gradient(135deg, #014f2d 0%, #016e3f 50%, #1a7a4a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        {/* Background decoration */}
        <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
          <div style={{ position: 'absolute', bottom: '-15%', left: '-8%', width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ position: 'absolute', top: '30%', left: '5%', width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.02)' }} />
        </div>

        <div className="animate-fade-in" style={{ display: 'flex', gap: 40, alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 860, flexWrap: 'wrap' }}>
          <div style={{ width: '100%', maxWidth: 420 }}>
            {/* Card */}
            <div style={{ background: 'white', borderRadius: 20, padding: '40px 36px', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}>
              {/* Logo */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
                <div style={{ width: 72, height: 72, background: '#f0f9f4', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, overflow: 'hidden' }}>
                  <Image src="/logo.png" alt="Sunrise Daily" width={100} height={100} style={{ objectFit: 'contain' }} />
                </div>
                <h1 style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-cabin, Cabin, sans-serif)', color: '#1a2e25', marginBottom: 4 }}>Sunrise Daily</h1>
                <p style={{ fontSize: 12.5, color: '#8aaa9a', textAlign: 'center', lineHeight: 1.5 }}>Centralized Procurement &amp; Inventory System</p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {error && (
                  <div className="alert-banner alert-danger" style={{ borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    {error}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <div style={{ position: 'relative' }}>
                    <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8aaa9a' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                    <input
                      type="email"
                      className="form-control"
                      style={{ paddingLeft: 38 }}
                      placeholder="admin@sunrisedaily.id"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div style={{ position: 'relative' }}>
                    <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8aaa9a' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    <input
                      type={showPass ? 'text' : 'password'}
                      className="form-control"
                      style={{ paddingLeft: 38, paddingRight: 38 }}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#8aaa9a', padding: 2 }}>
                      {showPass
                        ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                        : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      }
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={loading}
                  style={{ width: '100%', marginTop: 4, fontSize: 14.5, fontWeight: 600, letterSpacing: 0.3 }}
                >
                  Masuk
                </button>
              </form>

              <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#8aaa9a' }}>
                Hanya untuk pengguna internal Sunrise Daily
              </p>

            </div>

            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              © 2026 Sunrise Daily. Seluruh hak dilindungi.
            </p>
          </div>

          {/* Demo Credentials Box */}
          <div style={{ width: '100%', maxWidth: 360, background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: 20, padding: 32, color: 'white', boxShadow: '0 24px 80px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ background: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 10 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Demo Login</h3>
            </div>

            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 20, lineHeight: 1.5 }}>
              Semua akun menggunakan password: <code style={{ background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: 4 }}>admin123</code>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '350px', overflowY: 'auto', paddingRight: 4 }}>
              {demoUsers.length === 0 ? (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>Memuat data akun...</div>
              ) : (
                demoUsers.map((u, i) => (
                  <div
                    key={i}
                    onClick={() => { setEmail(u.email); setPassword('admin123'); }}
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', padding: '10px 14px', borderRadius: 10, cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                    onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{u.name}</div>
                    <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>{u.email}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
