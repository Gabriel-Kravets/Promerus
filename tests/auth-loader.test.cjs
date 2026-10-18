const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');
const ts = require('typescript');

const source = ts.transpileModule(readFileSync('src/lib/auth-client.ts', 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
}).outputText;

function fixture() {
  const scripts = [];
  const timers = new Set();
  const window = {};
  const exports = {};
  runInNewContext(source, {
    exports, window,
    process: {env: {NEXT_PUBLIC_AUTH0_DOMAIN: ' tenant.auth0.com ', NEXT_PUBLIC_AUTH0_CLIENT_ID: ' public-id '}},
    setTimeout: fn => { timers.add(fn); return fn; },
    clearTimeout: fn => timers.delete(fn),
    document: {
      createElement: () => ({remove() { this.removed = true; }}),
      head: {appendChild: script => scripts.push(script)},
    },
  });
  return {load: exports.loadAuth, window, scripts, timers};
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('concurrent startup shares ordered script loading and environment configuration', async () => {
  const f = fixture();
  const a = f.load(), b = f.load();
  assert.equal(a, b);
  assert.deepEqual(JSON.parse(JSON.stringify(f.window.SPROUTBOUND_AUTH)), {domain: 'tenant.auth0.com', clientId: 'public-id'});
  assert.equal(f.scripts.length, 1);
  assert.equal(f.scripts[0].src, '/auth/auth0-spa-js.production.js');
  f.window.auth0 = {createAuth0Client() {}};
  f.scripts[0].onload();
  await flush();
  assert.equal(f.scripts[1].src, '/auth/auth.js');
  const adapter = {};
  f.window.SproutboundAuth = adapter;
  f.scripts[1].onload();
  assert.equal(await a, adapter);
  assert.equal(await b, adapter);
  assert.equal(await f.load(), adapter);
  assert.equal(f.scripts.length, 2);
  assert.equal(f.timers.size, 0);
});

test('a failed adapter load retries without reloading the SDK or creating a second adapter', async () => {
  const f = fixture();
  f.window.auth0 = {createAuth0Client() {}};
  const first = f.load();
  const failed = assert.rejects(first, /could not load/);
  f.scripts[0].onerror();
  await failed;
  assert.equal(f.scripts[0].removed, true);
  const retry = f.load();
  assert.equal(f.scripts[1].src, '/auth/auth.js');
  const adapter = {};
  f.window.SproutboundAuth = adapter;
  f.scripts[1].onload();
  assert.equal(await retry, adapter);
  assert.equal(f.timers.size, 0);
});

test('hung script requests time out, remove the failed script, and permit retry', async () => {
  const f = fixture();
  const first = f.load();
  const failed = assert.rejects(first, /could not load/);
  [...f.timers][0]();
  await failed;
  assert.equal(f.scripts[0].removed, true);
  const retry = f.load();
  const rejected = assert.rejects(retry, /could not load/);
  assert.equal(f.scripts.length, 2);
  f.scripts[1].onerror();
  await rejected;
});
