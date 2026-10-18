const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');
const {join} = require('node:path');
const app = readFileSync(join(__dirname, '../app.js'), 'utf8');

function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return {promise, resolve, reject};
}
const flush = () => new Promise(resolve => setImmediate(resolve));

function fixture(overrides = {}, readyState = "loading") {
  const elements = new Map();
  for (const id of ['#status', '#signed-out', '#signed-in', '.login-card', '#login', '#signup', '#logout', '#retry', '#continue-in-tab', '#welcome', '#user-name', '#user-email']) {
    const handlers = {};
    elements.set(id, {hidden: ['#signed-in', '#retry', '#user-email'].includes(id), disabled: false, textContent: '', attrs: {},
      setAttribute(key, value) { this.attrs[key] = value; },
      addEventListener(name, fn) { handlers[name] = fn; },
      click() { return this.disabled ? undefined : handlers.click?.(); },
      focus() { this.focused = true; },
    });
  }
  const calls = [];
  const user = {sub: 'google-oauth2|player', name: 'Fern', email: 'fern@example.com'};
  const auth = {
    isConfigured: () => true,
    initialize: async () => null,
    login: async () => { calls.push('login'); return user; },
    signup: async () => { calls.push('signup'); return user; },
    loginInTab: async signup => { calls.push(['tab', signup]); },
    logout: async () => { calls.push('logout'); },
    errorMessage: () => 'Safe error. Please try again.',
    ...overrides,
  };
  let startup;
  const window = {SproutboundAuth: auth, addEventListener: (name, fn) => { if (name === 'DOMContentLoaded') startup = fn; }};
  runInNewContext(app, {window, document: {readyState, querySelector: selector => elements.get(selector)}});
  return {get: key => elements.get(key), calls, user, auth, start: async () => { startup?.(); await flush(); }};
}

test('startup waits, suppresses duplicate clicks, then renders login ready', async () => {
  const pending = deferred();
  const f = fixture({initialize: () => pending.promise});
  await f.start();
  assert.equal(f.get('#login').disabled, true);
  assert.equal(f.get('.login-card').attrs['aria-busy'], 'true');
  await f.get('#login').click();
  assert.deepEqual(f.calls, []);
  pending.resolve(null); await flush();
  assert.equal(f.get('#login').disabled, false);
  assert.equal(f.get('.login-card').attrs['aria-busy'], 'false');
});

test('Google profile and password profile use the same welcome path with text-only rendering', async () => {
  for (const sub of ['google-oauth2|player', 'auth0|player']) {
    const profile = {sub, name: '<img src=x onerror=alert(1)>', email: 'fern@example.com'};
    const f = fixture({login: async () => profile});
    await f.start(); await f.get('#login').click();
    assert.equal(f.get('#signed-out').hidden, true);
    assert.equal(f.get('#signed-in').hidden, false);
    assert.equal(f.get('#user-name').textContent, profile.name);
    assert.equal(f.get('#welcome').focused, true);
    assert.equal(f.get('#logout').disabled, false);
  }
});

test('transient initialization failure offers retry and still permits interactive login', async () => {
  let attempts = 0;
  const f = fixture({initialize: async () => { if (++attempts === 1) throw new Error('offline'); return null; }});
  await f.start();
  assert.equal(f.get('#retry').hidden, false);
  assert.equal(f.get('#login').disabled, false);
  f.get('#retry').click(); await flush();
  assert.equal(f.get('#retry').hidden, true);
  assert.equal(f.get('#status').textContent, '');
});

test('unconfigured client keeps login and fallback disabled with actionable status', async () => {
  const f = fixture({isConfigured: () => false});
  await f.start();
  assert.equal(f.get('#login').disabled, true);
  assert.equal(f.get('#continue-in-tab').disabled, true);
  assert.equal(f.get('#retry').hidden, false);
});

test('failed signup never redirects automatically; explicit fallback retains signup intent', async () => {
  const f = fixture({signup: async () => { throw {error: 'popup_blocked', message: 'SECRET'}; }});
  await f.start(); await f.get('#signup').click();
  assert.equal(f.get('#login').disabled, false);
  assert.equal(f.get('#status').textContent, 'Safe error. Please try again.');
  assert.deepEqual(f.calls, []);
  await f.get('#continue-in-tab').click();
  assert.deepEqual(f.calls, [['tab', true]]);
});

test('normal tab fallback requests login without a signup hint', async () => {
  const f = fixture();
  await f.start(); await f.get('#continue-in-tab').click();
  assert.deepEqual(f.calls, [['tab', false]]);
});

test('in-flight login is single; rejection and missing profile both recover controls', async () => {
  const pending = deferred();
  let logins = 0;
  const f = fixture({login: () => { logins++; return pending.promise; }});
  await f.start();
  const attempt = f.get('#login').click();
  f.get('#login').click(); f.get('#signup').click();
  assert.equal(logins, 1);
  pending.reject({error: 'timeout'}); await attempt;
  assert.equal(f.get('#login').disabled, false);
  assert.equal(f.get('#signed-in').hidden, true);
  f.auth.login = async () => undefined;
  await f.get('#login').click();
  assert.equal(f.get('#signed-in').hidden, true);
  assert.equal(f.get('#retry').hidden, false);
});

test('failed redirect recovers without leaking its message', async () => {
  const f = fixture({loginInTab: async () => { throw new Error('SECRET'); }});
  await f.start(); await f.get('#continue-in-tab').click();
  assert.equal(f.get('#status').textContent, 'Safe error. Please try again.');
  assert.equal(f.get('#login').disabled, false);
});

test('restored session and logout update the view and clear rendered profile', async () => {
  const f = fixture({initialize: async () => ({sub: 'auth0|player', email: 'player@example.com'})});
  await f.start();
  assert.equal(f.get('#signed-in').hidden, false);
  assert.equal(f.get('#user-name').textContent, 'player@example.com');
  assert.equal(f.get('#user-email').hidden, true);
  await f.get('#logout').click();
  assert.deepEqual(f.calls, ['logout']);
  assert.equal(f.get('#signed-in').hidden, true);
  assert.equal(f.get('#user-email').textContent, '');
  assert.equal(f.get('#user-name').textContent, 'Gardener');
});

test('failed logout retains authenticated view and enables retry', async () => {
  const f = fixture({initialize: async () => ({sub: 'auth0|player'}), logout: async () => { throw new Error('SECRET'); }});
  await f.start(); await f.get('#logout').click();
  assert.equal(f.get('#signed-in').hidden, false);
  assert.equal(f.get('#logout').disabled, false);
  assert.match(f.get('#status').textContent, /couldn't sign you out/);
  assert.equal(f.get('#status').textContent.includes('SECRET'), false);
});

for (const state of ['interactive', 'complete']) {
  test(`initializes when loaded after DOM parsing: ${state}`, async () => {
    const f = fixture({initialize: async () => ({sub: 'auth0|existing'})}, state);
    await f.start();
    assert.equal(f.get('#signed-in').hidden, false);
    assert.equal(f.get('.login-card').attrs['aria-busy'], 'false');
  });
}
