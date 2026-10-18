import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

function fixture(authenticated = false) {
  const events: string[] = [];
  let options: any, loginOptions: any, logoutOptions: any;
  const user = {sub: 'test-user', name: 'Test Gardener'};
  const popup = {closed: false, close() { this.closed = true; }};
  const client = {
    isAuthenticated: async () => authenticated,
    getUser: async () => user,
    loginWithPopup: async (value: any) => { events.push('login'); loginOptions = value; },
    logout: async (value: any) => { logoutOptions = value; },
  };
  const window: any = {
    SPROUTBOUND_AUTH: {domain: 'example.auth0.com', clientId: 'public-id'},
    location: {origin: 'http://localhost:3000', pathname: '/learn', search: ''},
    screen: {availWidth: 1200, availHeight: 900},
    open: () => { events.push('open'); return popup; },
    auth0: {createAuth0Client: async (value: any) => { events.push('client'); options = value; return client; }},
  };
  runInNewContext(readFileSync('public/auth/auth.js', 'utf8'), {window, URLSearchParams});
  return {auth: window.SproutboundAuth, events, popup, window, user, options: () => options, loginOptions: () => loginOptions, logoutOptions: () => logoutOptions};
}

test('auth restores sessions and uses a stable root callback on nested game routes', async () => {
  const f = fixture(true);
  assert.deepEqual(await f.auth.initialize(), f.user);
  assert.equal(f.options().authorizationParams.redirect_uri, 'http://localhost:3000/');
  assert.equal(await fixture().auth.initialize(), null);
});

test('signup opens popup synchronously and closes it after loading the user', async () => {
  const f = fixture();
  const pending = f.auth.signup();
  assert.equal(f.events[0], 'open');
  assert.deepEqual(await pending, f.user);
  assert.equal(f.loginOptions().authorizationParams.screen_hint, 'signup');
  assert.equal(f.popup.closed, true);
});

test('logout returns to the root login screen', async () => {
  const f = fixture(true);
  await f.auth.logout();
  assert.equal(f.logoutOptions().logoutParams.returnTo, 'http://localhost:3000/');
});

test('blocked popup surfaces an actionable error', () => {
  const f = fixture();
  f.window.open = () => null;
  assert.throws(() => f.auth.login(), /Allow popups/);
});

test('backend token retrieval renews through Auth0 and rejects changed or missing identities',async()=>{
 let renewed=0;
 let claims:{sub:string;__raw?:string}={sub:'fixture-account',__raw:'fixture-token'};
 const window:any={SPROUTBOUND_AUTH:{domain:'example.auth0.com',clientId:'public-id'},location:{origin:'http://localhost:3000',pathname:'/'},auth0:{createAuth0Client:async()=>({getTokenSilently:async()=>{renewed++;},getIdTokenClaims:async()=>claims})}};
 runInNewContext(readFileSync('public/auth/auth.js','utf8'),{window,URLSearchParams});
 assert.equal(await window.SproutboundAuth.getToken('fixture-account'),'fixture-token');
 assert.equal(renewed,1);
 await assert.rejects(()=>window.SproutboundAuth.getToken('another-account'),/account changed/);
 claims={sub:'fixture-account'};
 await assert.rejects(()=>window.SproutboundAuth.getToken('fixture-account'),/sign-in expired/);
});
