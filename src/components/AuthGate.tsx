'use client';

import {createContext, useContext, useEffect, useState} from 'react';
import './auth.css';
import OnlineStudyTime from './OnlineStudyTime';

type User = {sub: string; name?: string; nickname?: string; email?: string};
type AuthAdapter = {
  initialize: () => Promise<User | null>;
  login: () => Promise<User | undefined>;
  signup: () => Promise<User | undefined>;
  logout: () => Promise<void>;
};
declare global { interface Window { SproutboundAuth?: AuthAdapter } }

let adapterPromise: Promise<AuthAdapter> | undefined;
function loadAuth() {
  if (!adapterPromise) adapterPromise = (async () => {
    for (const file of ['auth0-spa-js.production.js', 'config.js', 'auth.js']) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `/auth/${file}`;
        script.onload = () => resolve();
        script.onerror = () => { script.remove(); reject(new Error('Sign-in could not load. Check your connection and retry.')); };
        document.head.appendChild(script);
      });
    }
    if (!window.SproutboundAuth) throw new Error('Sign-in is unavailable. Please retry.');
    return window.SproutboundAuth;
  })().catch(error => { adapterPromise = undefined; throw error; });
  return adapterPromise;
}

export function authError(error: unknown) {
  const e = error as {error?: string; code?: string; name?: string; message?: string};
  const code = e?.error || e?.code || e?.name;
  if (code === 'PopupCancelledError' || code === 'popup_closed' || e?.message === 'Popup closed') return 'The sign-in window was closed. You can try again.';
  if (code === 'TimeoutError' || code === 'timeout') return 'Sign-in timed out. Please try again.';
  return e?.message || 'Sign-in could not be completed. Please try again.';
}

const AuthContext = createContext<{user: User; logout: () => void; busy: boolean; error: string} | null>(null);
export const useAuth = () => useContext(AuthContext);

export default function AuthGate({children}: {children: React.ReactNode}) {
  const [adapter, setAdapter] = useState<AuthAdapter>();
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  async function initialize() {
    setBusy(true); setError('');
    try { const auth = await loadAuth(); setAdapter(auth); setUser(await auth.initialize()); }
    catch (e) { setError(authError(e)); }
    finally { setBusy(false); }
  }
  useEffect(() => { void initialize(); }, []);
  function authenticate(signup: boolean) {
    if (!adapter || busy) return;
    setBusy(true); setError('');
    // Invoke directly in the click handler so the adapter can open its popup immediately.
    try {
      const result = signup ? adapter.signup() : adapter.login();
      void result.then(profile => {
        if (!profile) throw new Error('Your profile could not be loaded. Please retry.');
        setUser(profile);
      }).catch(e => setError(authError(e))).finally(() => setBusy(false));
    } catch (e) { setError(authError(e)); setBusy(false); }
  }
  async function logout() {
    if (!adapter || busy) return;
    setBusy(true); setError('');
    try { await adapter.logout(); setUser(null); }
    catch (e) { setError(authError(e)); }
    finally { setBusy(false); }
  }
  if (user) return <AuthContext.Provider value={{user, logout, busy, error}}><OnlineStudyTime/>{children}</AuthContext.Provider>;
  return <main className="auth-scene"><section className="auth-card" aria-labelledby="auth-title" aria-busy={busy}>
    <img className="auth-mascot" src="/auth/sprout-mascot.png" alt="A smiling sprout"/>
    <span className="auth-sprig" aria-hidden="true">❧</span>
    <h1 id="auth-title">Sproutbound</h1><p className="auth-tagline">Your journey of growth begins here.</p>
    <button className="auth-enter" disabled={busy || !adapter} onClick={() => authenticate(false)}>Enter the Greenhouse</button>
    <button className="auth-link" disabled={busy || !adapter} onClick={() => authenticate(true)}>Create an account</button>
    <p className="auth-status" role="status">{error || (busy ? 'Checking your session…' : 'Sign in securely to enter your greenhouse.')}</p>
    {error && <button className="auth-link" disabled={busy} onClick={() => void initialize()}>Retry connection</button>}
  </section></main>;
}
