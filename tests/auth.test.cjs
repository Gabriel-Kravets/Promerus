const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');
const {join} = require('node:path');
const source = readFileSync(join(__dirname, '../public/auth/auth.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function fixture({user = null, pathname = '/learn', search = '', popupError, callbackError, redirectError, factoryFailures = 0} = {}) {
  const events = [];
  const calls = {creates: [], popups: [], redirects: [], logouts: [], callbacks: 0, history: []};
  const popup = {closed: false, close() { this.closed = true; events.push('close'); }};
  const client = {
    isAuthenticated: async () => Boolean(user),
    getUser: async () => user,
    loginWithPopup: async (...args) => { calls.popups.push(args); if (popupError) throw popupError; },
    loginWithRedirect: async options => { calls.redirects.push(options); if (redirectError) throw redirectError; },
    logout: async options => { calls.logouts.push(options); },
    handleRedirectCallback: async () => { calls.callbacks++; if (callbackError) throw callbackError; },
  };
  const window = {
    SPROUTBOUND_AUTH: {domain: 'tenant.example.auth0.com', clientId: 'public-spa-id'},
    location: {origin: 'http://localhost:3000', pathname, search, href: `http://localhost:3000${pathname}${search}#section`},
    screen: {availWidth: 1200, availHeight: 900},
    history: {replaceState: (...args) => calls.history.push(args)},
    open: () => { events.push('open'); return popup; },
    auth0: {createAuth0Client: async options => {
      events.push('create'); calls.creates.push(options);
      if (factoryFailures-- > 0) throw new Error('network unavailable');
      return client;
    }},
  };
  runInNewContext(source, {window, document: {title: 'SproutBound'}, URL, URLSearchParams});
  return {auth: window.SproutboundAuth, window, client, calls, popup, events};
}

test('SDK configuration preserves public identifiers, scopes, cache, and no custom audience/claims', async () => {
  const f = fixture();
  assert.equal(await f.auth.initialize(), null);
  assert.deepEqual(plain(f.calls.creates[0]), {
    domain: 'tenant.example.auth0.com', clientId: 'public-spa-id',
    httpTimeoutInSeconds: 15, authorizeTimeoutInSeconds: 15,
    authorizationParams: {redirect_uri: 'http://localhost:3000/', scope: 'openid profile email'},
    cacheLocation: 'localstorage',
  });
});

for (const sub of ['auth0|database-user', 'google-oauth2|google-user']) {
  test(`restoration and login return the original profile unchanged: ${sub}`, async () => {
    const user = {sub, email: 'player@example.com', name: 'Gardener'};
    const f = fixture({user});
    assert.equal(await f.auth.initialize(), user);
    assert.equal(await f.auth.login(), user);
    assert.deepEqual(plain(f.calls.popups[0][0]), {authorizationParams: {}});
  });
}

test('login opens synchronously before SDK initialization, passes window and closes on success', async () => {
  const f = fixture();
  const result = f.auth.login();
  assert.deepEqual(f.events, ['open', 'create']);
  await result;
  assert.equal(f.calls.popups[0][1].popup, f.popup);
  assert.equal(f.calls.popups[0][1].timeoutInSeconds, 120);
  assert.equal(f.popup.closed, true);
  assert.equal(f.calls.redirects.length, 0);
});

test('signup requests signup without forcing a provider or passkey-specific protocol', async () => {
  const f = fixture();
  await f.auth.signup();
  assert.deepEqual(plain(f.calls.popups[0][0]), {authorizationParams: {screen_hint: 'signup', prompt: 'login'}});
});

test('blocked popup has an actionable error and never invokes SDK login or automatic redirect', () => {
  const f = fixture();
  f.window.open = () => null;
  assert.throws(() => f.auth.login(), error => error.error === 'popup_blocked' && /Allow popups/.test(error.message));
  assert.equal(f.calls.creates.length, 0);
  assert.equal(f.calls.redirects.length, 0);
});

for (const error of [{error: 'cancelled'}, {error: 'popup_closed'}, {error: 'timeout'}, {name: 'PopupTimeoutError'}]) {
  test(`popup cleaned up after SDK rejection ${JSON.stringify(error)}`, async () => {
    const f = fixture({popupError: error});
    await assert.rejects(f.auth.login(), caught => caught === error);
    assert.equal(f.popup.closed, true);
    assert.equal(f.calls.redirects.length, 0);
  });
}

test('explicit tab fallback uses the existing SDK and signup parameters', async () => {
  const f = fixture();
  await f.auth.loginInTab();
  await f.auth.loginInTab(true);
  assert.deepEqual(plain(f.calls.redirects), [
    {authorizationParams: {}},
    {authorizationParams: {screen_hint: 'signup', prompt: 'login'}},
  ]);
  assert.equal(f.events.includes('open'), false);
});

test('failed client setup can retry and successful initialization reuses one client', async () => {
  const f = fixture({factoryFailures: 1});
  await assert.rejects(f.auth.initialize(), /network/);
  await f.auth.initialize();
  await f.auth.initialize();
  assert.equal(f.calls.creates.length, 2);
});

test('SDK failure after opening window still closes the window', async () => {
  const f = fixture({factoryFailures: 1});
  await assert.rejects(f.auth.login(), /network/);
  assert.equal(f.popup.closed, true);
});

for (const callbackError of [undefined, new Error('invalid state')]) {
  test(`redirect callback cleans auth parameters, keeps unrelated query/hash, error=${Boolean(callbackError)}`, async () => {
    const f = fixture({search: '?code=secret-code&state=state&session_state=session&view=garden', callbackError});
    if (callbackError) await assert.rejects(f.auth.initialize(), /invalid state/);
    else await f.auth.initialize();
    assert.equal(f.calls.callbacks, 1);
    assert.equal(f.calls.history[0][2], '/learn?view=garden#section');
  });
}

test('provider callback errors are cleaned and their description is not displayed', async () => {
  const f = fixture({search: '?error=access_denied&error_description=private-provider-detail&view=garden'});
  await assert.rejects(f.auth.initialize(), error => /Sign-in was not completed/.test(error.message) && !error.message.includes('private-provider-detail'));
  assert.equal(f.calls.callbacks, 0);
  assert.equal(f.calls.history[0][2], '/learn?view=garden#section');
});

test('logout from a nested route returns to the allowlisted root', async () => {
  const f = fixture();
  await f.auth.logout();
  assert.deepEqual(plain(f.calls.logouts), [{logoutParams: {returnTo: 'http://localhost:3000/'}}]);
});

test('missing config and missing SDK fail gracefully', async () => {
  const f = fixture();
  f.window.SPROUTBOUND_AUTH.domain = 'YOUR_DOMAIN';
  assert.equal(f.auth.isConfigured(), false);
  await assert.rejects(f.auth.initialize(), error => error.error === 'configuration_error');
  const g = fixture();
  delete g.window.auth0;
  await assert.rejects(g.auth.initialize(), error => error.error === 'sdk_unavailable');
});

test('unknown errors do not echo sensitive descriptions', () => {
  const f = fixture();
  assert.equal(f.auth.errorMessage({error: 'unrecognized', message: 'SECRET_TOKEN'}).includes('SECRET_TOKEN'), false);
  assert.match(f.auth.errorMessage({error: 'popup_closed'}), /closed/);
  assert.match(f.auth.errorMessage({error: 'timeout'}), /continue in this tab/);
  assert.match(f.auth.errorMessage({error: 'login_required'}), /sign in again/i);
});

test('concurrent initialization consumes a redirect once and preserves Next history state', async () => {
  const f = fixture({user: {sub: 'auth0|player'}, search: '?code=code&state=state&view=garden'});
  const historyState = {__NA: true, tree: ['game']};
  f.window.history.state = historyState;
  const a = f.auth.initialize(), b = f.auth.initialize();
  assert.equal(a, b);
  assert.equal(await a, await b);
  assert.equal(f.calls.creates.length, 1);
  assert.equal(f.calls.callbacks, 1);
  assert.equal(f.calls.history[0][0], historyState);
});

test('production HTTPS callbacks and logout derive from the deployment origin', async () => {
  const f = fixture({pathname: '/game'});
  f.window.location.origin = 'https://sproutbound.example';
  await f.auth.initialize();
  await f.auth.logout();
  assert.equal(f.calls.creates[0].authorizationParams.redirect_uri, 'https://sproutbound.example/');
  assert.equal(f.calls.logouts[0].logoutParams.returnTo, 'https://sproutbound.example/');
});

test('provider callback errors are cleaned even when the SDK is unavailable', async () => {
  const f = fixture({search: '?error=access_denied&error_description=SECRET'});
  delete f.window.auth0;
  await assert.rejects(f.auth.initialize(), error => error.error === 'access_denied');
  assert.equal(f.calls.history[0][2], '/learn#section');
  assert.equal(f.calls.creates.length, 0);
});

// Use the vendored SDK's real error shapes: its Error.name is not the class name.
test('maps the actual SDK 2.27.0 popup cancellation, blocking, and timeout errors', () => {
  const sdk = require('../public/auth/auth0-spa-js.production.js');
  const f = fixture();
  assert.match(f.auth.errorMessage(new sdk.PopupCancelledError({})), /window was closed/);
  assert.match(f.auth.errorMessage(new sdk.PopupTimeoutError({})), /too long/);
  assert.match(f.auth.errorMessage(new sdk.PopupOpenError()), /blocked/);
});
