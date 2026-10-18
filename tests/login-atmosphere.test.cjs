const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const source = readFileSync(require('node:path').join(__dirname, '../src/components/LoginAtmosphere.tsx'), 'utf8');
function render(math = Math) {
  const module = {exports: {}};
  const code = ts.transpileModule(source, {compilerOptions: {jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS}}).outputText;
  runInNewContext(code, {module, exports: module.exports, require, Math: math});
  return renderToStaticMarkup(React.createElement(module.exports.default));
}
test('login decorations serialize identically without runtime trigonometry', () => {
  const server = render();
  const clientMath = Object.create(Math);
  clientMath.sin = clientMath.cos = () => {throw new Error('Engine-dependent geometry must not run during render');};
  assert.equal(render(clientMath), server);
  const rects = [...server.matchAll(/<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)" opacity="([^"]+)"/g)];
  assert.equal(rects.length, 86);
  rects.forEach((rect, index) => {
    const i = index % 43, angle = i * .19, radius = 5 + i * 2.3;
    assert.ok(Math.abs(Number(rect[1]) - (120 + Math.cos(angle) * radius)) <= .00000051);
    assert.ok(Math.abs(Number(rect[2]) - (90 + Math.sin(angle) * radius * .67)) <= .00000051);
    assert.match(rect[1], /^\d+\.\d{6}$/);
    assert.match(rect[2], /^\d+\.\d{6}$/);
    assert.equal(rect[3], i % 5 === 0 ? '3' : '2');
    assert.equal(rect[4], '2');
    assert.equal(rect[5], (.22 + (i % 4) * .13).toFixed(2));
  });
});
