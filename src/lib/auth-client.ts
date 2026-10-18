export type AuthUser = {sub: string; name?: string; nickname?: string; email?: string};
export type AuthAdapter = {
  isConfigured: () => boolean;
  initialize: () => Promise<AuthUser | null>;
  login: () => Promise<AuthUser | undefined>;
  signup: () => Promise<AuthUser | undefined>;
  loginInTab: (signup?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  errorMessage: (error: unknown) => string;
};

declare global {
  interface Window {
    SPROUTBOUND_AUTH?: {domain: string; clientId: string};
    SproutboundAuth?: AuthAdapter;
    auth0?: {createAuth0Client?: unknown};
  }
}

let adapterPromise: Promise<AuthAdapter> | undefined;

function loadScript(file: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      reject(new Error('Sign-in could not load.'));
    };
    const timer = setTimeout(fail, 15000);
    script.src = `/auth/${file}`;
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = fail;
    document.head.appendChild(script);
  });
}

export function loadAuth(): Promise<AuthAdapter> {
  if (!adapterPromise) adapterPromise = (async () => {
    // Next substitutes these public identifiers at build time for each environment.
    window.SPROUTBOUND_AUTH = {
      domain: (process.env.NEXT_PUBLIC_AUTH0_DOMAIN || '').trim(),
      clientId: (process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID || '').trim(),
    };
    // A successful SDK load survives retries if the subsequent adapter load fails.
    if (!window.auth0?.createAuth0Client) await loadScript('auth0-spa-js.production.js');
    if (!window.SproutboundAuth) await loadScript('auth.js');
    if (!window.SproutboundAuth) throw new Error('Sign-in is unavailable.');
    return window.SproutboundAuth;
  })().catch(error => { adapterPromise = undefined; throw error; });
  return adapterPromise;
}
