'use client';

import {createContext, useContext, useEffect, useRef, useState} from 'react';
import {loadAuth, type AuthAdapter, type AuthUser} from '@/lib/auth-client';
import LoginAtmosphere from './LoginAtmosphere';
import './auth.css';

const AuthContext = createContext<{user: AuthUser; logout: () => void; busy: boolean; error: string; getToken: () => Promise<string>} | null>(null);
export const useAuth = () => useContext(AuthContext);

export default function AuthGate({children}: {children: React.ReactNode}) {
  const [adapter, setAdapter] = useState<AuthAdapter>();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activity, setActivity] = useState<string | null>('Checking your session…');
  const [error, setError] = useState('');
  const busy = activity !== null;
  const locked = useRef(false);
  const mounted = useRef(false);
  const signupRequested = useRef(false);

  function reportError(e: unknown, auth = adapter) {
    const popupError = e as {error?: string; code?: string; name?: string} | null;
    if (['cancelled', 'popup_closed', 'PopupCancelledError'].includes(popupError?.error || popupError?.code || popupError?.name || '')) {
      setError('');
      return;
    }
    setError(auth?.errorMessage(e) || 'Sign-in could not load. Check your connection and retry.');
  }

  async function initialize() {
    if (locked.current) return;
    locked.current = true;
    setActivity('Checking your session…'); setError('');
    let auth: AuthAdapter | undefined;
    try {
      auth = await loadAuth();
      if (!mounted.current) return;
      setAdapter(auth);
      const profile = await auth.initialize();
      if (mounted.current) setUser(profile?.sub ? profile : null);
    } catch (e) { if (mounted.current) reportError(e, auth); }
    finally { locked.current = false; if (mounted.current) setActivity(null); }
  }
  useEffect(() => {
    mounted.current = true;
    void initialize();
    return () => { mounted.current = false; };
  }, []);
  function authenticate(signup: boolean, inTab = false) {
    if (!adapter || locked.current || !adapter.isConfigured()) return;
    locked.current = true;
    signupRequested.current = signup;
    setActivity(inTab ? 'Taking you to secure sign-in…' : 'Opening your secure sign-in window…'); setError('');
    // Keep popup creation directly inside the click, before any asynchronous work.
    try {
      if (inTab) {
        void adapter.loginInTab(signup).catch(e => {
          if (mounted.current) { reportError(e); setActivity(null); }
          locked.current = false;
        });
        return;
      }
      const result = signup ? adapter.signup() : adapter.login();
      void result.then(profile => {
        if (!profile?.sub) throw new Error('Profile unavailable');
        if (mounted.current) setUser(profile);
      }).catch(e => { if (mounted.current) reportError(e); }).finally(() => {
        locked.current = false; if (mounted.current) setActivity(null);
      });
    } catch (e) { locked.current = false; reportError(e); setActivity(null); }
  }
  async function logout() {
    if (!adapter || locked.current) return;
    locked.current = true;
    setActivity('Signing out…'); setError('');
    try { await adapter.logout(); setUser(null); }
    catch { setError("We couldn't sign you out. Check your connection and try again."); }
    finally { locked.current = false; setActivity(null); }
  }
  if (user) return <AuthContext.Provider value={{user, logout, busy, error, getToken: async () => { if(!adapter) throw new Error("Sign-in is unavailable"); return adapter.getToken(user.sub); }}}>{children}</AuthContext.Provider>;
  return <main className="auth-scene">
    <LoginAtmosphere/>
    <section className="auth-card" aria-labelledby="auth-title" aria-busy={busy}>
    <img className="auth-card-art" src="/assets/Sprout%20Mascot%20Parchment%20Frame.png" width={1122} height={1402} alt="" aria-hidden="true" draggable={false}/>
    <div className="auth-card-content">
    <header className="auth-card-heading">
    <div className="auth-brand-mark" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M32 51V23M32 33C16 31 11 20 13 10c12 0 20 6 19 18M32 28C34 14 44 8 54 9c1 12-7 21-22 22"/><path d="M20 51h24"/></svg></div>
    <h1 id="auth-title" aria-label="Sproutbound"><span>Sprout</span><span className="auth-title-ending">bound</span></h1>
    <div className="auth-ornament" aria-hidden="true"><span/><svg viewBox="0 0 16 16"><path d="m8 1 3 4 4 3-4 3-3 4-3-4-4-3 4-3z"/><path d="m8 5 3 3-3 3-3-3z"/></svg><span/></div>
    <p className="auth-tagline">Your journey of growth begins here.</p>
    </header>
    <button className="auth-enter" disabled={busy || !adapter?.isConfigured()} onClick={() => authenticate(false)}>
      <svg className="auth-button-leaf" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21V10M12 14C4 14 2 9 3 4c6 0 10 3 9 8m0 0C12 5 16 2 22 3c0 6-3 11-10 11"/></svg>
      <span>Enter the Greenhouse</span>
      <svg className="auth-button-leaf" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21V10M12 14C4 14 2 9 3 4c6 0 10 3 9 8m0 0C12 5 16 2 22 3c0 6-3 11-10 11"/></svg>
    </button>
    <div className="auth-feedback">
      <p className="auth-status" role="status" aria-live="polite" aria-atomic="true">{error || activity}</p>
      {error && <>
        {adapter?.isConfigured() && <button className="auth-link" disabled={busy} onClick={() => authenticate(signupRequested.current, true)}>Continue sign-in in this tab</button>}
        <button className="auth-link" disabled={busy} onClick={() => void initialize()}>Retry connection</button>
      </>}
    </div>
    {!busy && !error && <img className="auth-vine" src="/assets/vine.png" width={2172} height={724} alt="" aria-hidden="true" draggable={false}/>}
    <div className="auth-actions">
    <div className="auth-small-ornament" aria-hidden="true"><span/><svg viewBox="0 0 24 24"><path d="M12 21V10M12 14C4 14 2 9 3 4c6 0 10 3 9 8m0 0C12 5 16 2 22 3c0 6-3 11-10 11"/></svg><span/></div>
    <div className="auth-account-links">
      <button className="auth-link" disabled={busy || !adapter?.isConfigured()} onClick={() => authenticate(true)}>Create an account</button>
      <span aria-hidden="true"/>
      <button className="auth-link" disabled={busy || !adapter?.isConfigured()} onClick={() => authenticate(false)} aria-describedby="auth-recovery-note">Forgot password?</button>
    </div>
    <span className="auth-visually-hidden" id="auth-recovery-note">Opens secure sign-in. Choose Reset password in the Auth0 window.</span>
    </div>
    </div>
  </section></main>;
}
