import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AnalysisError } from '../src/errors.js';
import { findFrontend } from '../src/compile.js';
import { createServer } from '../src/server.js';
import { validateAudit, validateCfg } from '../src/validate.js';

const TS = '2026-10-07T00:00:00Z';
const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const realCfg = (name) => fixture(`real/${name}.json`);
const hasCompiler = Boolean(findFrontend());
const skip = hasCompiler ? false : 'compiler not built: run `make build` in the repo root first';

let server;
let base;
let compileCalls;

before(async () => {
  compileCalls = [];
  // Real compiler when available; otherwise the injected fake still exercises the HTTP layer.
  server = createServer({
    now: () => TS,
    compile: async (source, options) => {
      compileCalls.push(source);
      if (source === '__FAKE_OK__') return realCfg('sql_injection');
      if (source === '__FAKE_BAD_CFG__') return { not: 'a cfg' };
      if (source === '__FAKE_SYNTAX__') {
        throw new AnalysisError('Mini-C source was rejected by the compiler frontend',
          [{ path: '/source', kind: 'SYNTAX', line: 2, column: 12, message: 'unexpected TOK_SEMI' }], 'COMPILE_ERROR');
      }
      const { compileSource } = await import('../src/compile.js');
      return compileSource(source, options);
    },
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

const post = (body, headers = {}) =>
  fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('GET /health reports status and whether the compiler is present', async () => {
  const response = await fetch(`${base}/health`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.frontendAvailable, hasCompiler);
});

test('POST { cfg } analyzes a CFG directly and returns cfg + audit + meta', async () => {
  const response = await post({ cfg: realCfg('command_injection') });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(validateAudit(body.audit).valid, true);
  assert.equal(body.audit.vulnerabilities[0].cwe, 'CWE-78');
  assert.deepEqual(body.audit.vulnerabilities[0].taintPath, ['B0', 'B2', 'B3']);
  assert.equal(body.meta.compiled, false);
  assert.equal(typeof body.meta.durationMs, 'number');
  assert.deepEqual(body.cfg, realCfg('command_injection'));
});

test('POST { source } goes through the compile step (injected frontend)', async () => {
  const response = await post({ source: '__FAKE_OK__' });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.meta.compiled, true);
  assert.equal(body.audit.vulnerabilities[0].cwe, 'CWE-89');
});

test('compile errors return 422 with line/column diagnostics', async () => {
  const response = await post({ source: '__FAKE_SYNTAX__' });
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.code, 'COMPILE_ERROR');
  assert.equal(body.diagnostics[0].line, 2);
  assert.equal(body.diagnostics[0].column, 12);
});

test('a CFG from the frontend that violates the contract is a 500, not a 400 (our bug, not the caller\'s)', async () => {
  const response = await post({ source: '__FAKE_BAD_CFG__' });
  assert.equal(response.status, 500);
  assert.equal((await response.json()).code, 'INTERNAL');
});

test('a caller-supplied CFG that violates the contract is a 400 with diagnostics', async () => {
  const cfg = realCfg('sql_injection');
  cfg.edges = [{ from: 'B0', to: 'B9', type: 'UNCONDITIONAL' }];
  const response = await post({ cfg });
  assert.equal(response.status, 400);
  assert.ok((await response.json()).diagnostics.length > 0);
});

test('request validation: bad JSON, wrong shape, missing/both/extra fields', async () => {
  for (const body of ['{not json', '[]', 'null', '"text"', '{}', JSON.stringify({ source: 'a', cfg: {} }),
    JSON.stringify({ source: 'a', extra: 1 }), JSON.stringify({ source: 123 })]) {
    const response = await post(body);
    assert.equal(response.status, 400, `body ${body}`);
    const parsed = await response.json();
    assert.equal(parsed.code, 'INVALID_INPUT');
  }
});

test('wrong content type is 415, wrong method is 405 with Allow, unknown route is 404', async () => {
  assert.equal((await post('{}', { 'Content-Type': 'text/plain' })).status, 415);
  const get = await fetch(`${base}/api/analyze`);
  assert.equal(get.status, 405);
  assert.equal(get.headers.get('allow'), 'POST');
  assert.equal((await fetch(`${base}/nope`)).status, 404);
  assert.equal((await fetch(`${base}/health`, { method: 'POST' })).status, 405);
});

test('bodies over 1 MiB are rejected with 413', async () => {
  const response = await post(JSON.stringify({ source: 'a'.repeat(2 * 1024 * 1024) }));
  assert.equal(response.status, 413);
});

test('CORS: local dashboard origins are allowed, foreign origins are not', async () => {
  const local = await fetch(`${base}/api/analyze`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } });
  assert.equal(local.status, 204);
  assert.equal(local.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const foreign = await fetch(`${base}/health`, { headers: { Origin: 'https://evil.example' } });
  assert.equal(foreign.headers.get('access-control-allow-origin'), null);
});

test('GET /api/examples serves the four acceptance programs', async () => {
  const { examples } = await (await fetch(`${base}/api/examples`)).json();
  const names = examples.map((e) => e.name);
  for (const expected of ['clean_flow.c', 'sql_injection.c', 'command_injection.c', 'complex_loop.c']) {
    assert.ok(names.includes(expected), expected);
  }
  assert.ok(examples.every((e) => typeof e.source === 'string' && e.source.length > 0));
});

test('responses are deterministic for identical requests (fixed clock)', async () => {
  const a = await (await post({ cfg: realCfg('complex_loop') })).json();
  const b = await (await post({ cfg: realCfg('complex_loop') })).json();
  assert.equal(JSON.stringify(a.audit), JSON.stringify(b.audit));
});

test('with no frontend configured, { source } is 503 but { cfg } still works', async () => {
  const bare = createServer({ frontendPath: null, now: () => TS });
  await new Promise((resolve) => bare.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${bare.address().port}`;
  const headers = { 'Content-Type': 'application/json' };
  const source = await fetch(`${url}/api/analyze`, { method: 'POST', headers, body: JSON.stringify({ source: 'int main(){}' }) });
  assert.equal(source.status, 503);
  const cfg = await fetch(`${url}/api/analyze`, { method: 'POST', headers, body: JSON.stringify({ cfg: realCfg('clean_flow') }) });
  assert.equal(cfg.status, 200);
  await new Promise((resolve) => bare.close(resolve));
});

// ---------------------------------------------- real compiler, full HTTP path (Gate 3)

const EXPECTED = {
  'clean_flow.c': [], 'sql_injection.c': ['CWE-89'], 'command_injection.c': ['CWE-78'], 'complex_loop.c': ['CWE-89'],
};
for (const [file, cwes] of Object.entries(EXPECTED)) {
  test(`HTTP end-to-end: examples/${file} -> ${cwes.length ? cwes.join(',') : 'CLEAN'}`, { skip }, async () => {
    const { examples } = await (await fetch(`${base}/api/examples`)).json();
    const { source } = examples.find((e) => e.name === file);
    const response = await post({ source });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(validateCfg(body.cfg).valid, true);
    assert.equal(validateAudit(body.audit).valid, true);
    assert.deepEqual(body.audit.vulnerabilities.map((v) => v.cwe), cwes);
    assert.ok(body.meta.durationMs < 300, `NFR-02: ${body.meta.durationMs} ms`);
  });
}

test('HTTP end-to-end: syntax error returns 422 with a position', { skip }, async () => {
  const response = await post({ source: 'int main() {\n  int x = ;\n  return 0;\n}\n' });
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.diagnostics[0].line, 2);
  assert.equal(body.diagnostics[0].kind, 'SYNTAX');
});

test('HTTP end-to-end: shell metacharacters in source are inert', { skip }, async () => {
  const response = await post({ source: 'int main() { int x = 1; } ; rm -rf / # $(id) `id` | &\n' });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).code, 'COMPILE_ERROR');
});
