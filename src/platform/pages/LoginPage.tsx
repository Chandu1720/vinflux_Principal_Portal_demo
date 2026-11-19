import React, { useState } from 'react';
import { ChevronDown, ChevronRight, LogIn, ShieldCheck } from 'lucide-react';
import { DEMO_PASSWORD, login, roles, users } from '../../modules/users/userStore';
import { WORKSPACE_LABEL } from '../workspace';
import type { IndustryPackId } from '../../types/product.ts';
import '../../modules/gtm-v2/styles/gtm-v2.css';

const INDUSTRIES: IndustryPackId[] = ['medical-devices', 'agri', 'automotive', 'electronics'];
const TAGLINE: Record<string, string> = {
  'medical-devices': 'CDSCO licences, UDI, implants, hospital coverage, rate contracts',
  agri: 'CIB&RC, Seeds Act, FCO, season credit, retailer network',
  automotive: 'Part numbers, fitment, warranty, BIS & battery EPR',
  electronics: 'BIS CRS, BEE label, serial / IMEI, E-waste EPR',
};

/**
 * Sign-in. The account decides the company and its industry workspace — the user does not pick it.
 * INTEGRATION POINT: replace `login` with the auth service / SSO (Azure AD, Google Workspace).
 */
const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const roleName = (ids: string[]) => roles().filter((r) => ids.includes(r.id)).map((r) => r.name).join(', ');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) { setError('Enter your work email and password.'); return; }
    setBusy(true);
    const r = login(email, password);
    if (!r.ok) { setBusy(false); setError(r.message); return; }
    // Fresh start so every module loads the data of this company's workspace.
    window.location.assign('/');
  };

  return (
    <div className="g2" style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(360px, 1fr)', background: 'var(--g2-bg, #f8fafc)' }}>
      <div style={{ background: 'linear-gradient(160deg, #1e1b4b 0%, #312e81 55%, #4c1d95 100%)', color: '#fff', padding: '48px 56px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fff', color: '#4c1d95', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 18 }}>V</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>VinFlux <span style={{ fontSize: 11, background: 'rgba(255,255,255,.18)', padding: '2px 6px', borderRadius: 6, marginLeft: 4 }}>2.0</span></div>
        </div>
        <div style={{ marginTop: 'auto', maxWidth: 520 }}>
          <h1 style={{ fontSize: 34, lineHeight: 1.2, margin: '0 0 12px', fontWeight: 800 }}>The principal portal for regulated distribution</h1>
          <p style={{ fontSize: 15, opacity: 0.85, margin: '0 0 28px' }}>Products, channel partners, prices and compliance in one place — shaped for your industry the moment you sign in.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {INDUSTRIES.map((i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{WORKSPACE_LABEL[i]}</div>
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>{TAGLINE[i]}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 'auto', fontSize: 12, opacity: 0.6, paddingTop: 32 }}>© 2026 AFORV · VinFlux</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px' }}>Sign in</h2>
          <p className="g2-muted" style={{ margin: '0 0 24px', fontSize: 14 }}>Use your work email. Your company decides your workspace.</p>
          <form onSubmit={submit} className="g2-stack" noValidate>
            <div className="g2-field">
              <label className="g2-label" htmlFor="login-email">Work email</label>
              <input id="login-email" className="g2-input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
            </div>
            <div className="g2-field">
              <label className="g2-label" htmlFor="login-password">Password</label>
              <input id="login-password" className="g2-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <div className="g2-alert g2-alert-error" role="alert">{error}</div>}
            <button type="submit" className="g2-btn g2-btn-primary" disabled={busy} style={{ height: 42, justifyContent: 'center' }}><LogIn size={16} /> {busy ? 'Signing in…' : 'Sign in'}</button>
            <div className="g2-small g2-muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><ShieldCheck size={14} /> Single sign-on (Microsoft / Google) can replace this form.</div>
          </form>

          <div style={{ marginTop: 28, borderTop: '1px solid var(--g2-border)', paddingTop: 14 }}>
            <button type="button" className="g2-btn g2-btn-ghost g2-btn-sm" onClick={() => setShowDemo(!showDemo)}>
              {showDemo ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Demo accounts
            </button>
            {showDemo && (
              <div className="g2-stack" style={{ marginTop: 8, gap: 10 }}>
                <div className="g2-small g2-muted">Password for every demo account: <strong className="g2-mono">{DEMO_PASSWORD}</strong>. Click an account to fill the form.</div>
                {INDUSTRIES.map((ind) => (
                  <div key={ind}>
                    <div className="g2-label" style={{ marginBottom: 4 }}>{WORKSPACE_LABEL[ind]}</div>
                    {users().filter((u) => u.workspace === ind && u.status === 'Active').slice(0, ind === 'medical-devices' ? 4 : 2).map((u) => (
                      <button key={u.id} type="button" onClick={() => { setEmail(u.email); setPassword(DEMO_PASSWORD); setError(null); }}
                        style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 8, padding: '6px 8px', border: 'none', background: email === u.email ? 'var(--g2-primary-50)' : 'transparent', borderRadius: 6, cursor: 'pointer', textAlign: 'left' }}>
                        <span className="g2-small"><strong>{u.name}</strong> <span className="g2-muted">· {roleName(u.roleIds)}</span></span>
                        <span className="g2-small g2-muted g2-mono">{u.email}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default LoginPage;
