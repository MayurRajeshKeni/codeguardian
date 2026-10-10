import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { AnalysisError } from '../src/errors.js';
import { compileSource, MAX_SOURCE_CHARS, parseFrontendDiagnostics } from '../src/compile.js';

// Fake "frontends": the current Node binary running a one-line script, so these tests run on every OS.
const fake = (script, extra = {}) => ({ frontendPath: process.execPath, frontendArgs: ['-e', script], ...extra });

const rejects = (promise, code) =>
  assert.rejects(promise, (error) => error instanceof AnalysisError && error.code === code, `expected ${code}`);

test('parseFrontendDiagnostics extracts line, column and kind (NFR-03)', () => {
  const stderr = '[Lexical Error] Line 3, Column 16: Unrecognized token \'@\'\n[Syntax Error] Line 3, Column 17: syntax error, unexpected TOK_ERROR\n[CodeGuardian] FAILED: x';
  assert.deepEqual(parseFrontendDiagnostics(stderr), [
    { path: '/source', kind: 'LEXICAL', line: 3, column: 16, message: "Unrecognized token '@'" },
    { path: '/source', kind: 'SYNTAX', line: 3, column: 17, message: 'syntax error, unexpected TOK_ERROR' },
  ]);
  assert.deepEqual(parseFrontendDiagnostics('nothing useful'), []);
});

test('source text reaches the frontend byte-for-byte and the temp file is removed afterwards', async () => {
  const script = "const fs=require('fs');const f=process.argv[1];console.log(JSON.stringify({file:f,text:fs.readFileSync(f,'utf8')}))";
  const source = 'int main() { "; rm -rf / #\n$(whoami) `id` | & }';
  const result = await compileSource(source, fake(script));
  assert.equal(result.text, source);
  assert.equal(existsSync(result.file), false, 'temporary file must be deleted');
});

test('frontend failure with Mini-C diagnostics becomes COMPILE_ERROR with positions', async () => {
  const script = "console.error('[Syntax Error] Line 2, Column 5: boom');console.error('[CodeGuardian] FAILED');process.exit(1)";
  await assert.rejects(compileSource('x', fake(script)), (error) => {
    assert.equal(error.code, 'COMPILE_ERROR');
    assert.equal(error.diagnostics[0].line, 2);
    assert.equal(error.diagnostics[0].column, 5);
    return true;
  });
});

test('frontend failure without parsable diagnostics still yields a diagnostic', async () => {
  await assert.rejects(compileSource('x', fake("console.error('Error: Unable to open file');process.exit(1)")), (error) => {
    assert.equal(error.code, 'COMPILE_ERROR');
    assert.match(error.diagnostics[0].message, /Unable to open file/);
    return true;
  });
});

test('frontend that hangs is killed and reported as FRONTEND_TIMEOUT', async () => {
  await rejects(compileSource('x', fake('setInterval(()=>{},1000)', { timeoutMs: 300 })), 'FRONTEND_TIMEOUT');
});

test('frontend that prints non-JSON is an INTERNAL error', async () => {
  await rejects(compileSource('x', fake("console.log('hello')")), 'INTERNAL');
});

test('missing or unrunnable frontend is FRONTEND_UNAVAILABLE', async () => {
  await rejects(compileSource('x', { frontendPath: null }), 'FRONTEND_UNAVAILABLE');
  await rejects(compileSource('x', { frontendPath: '/definitely/not/a/binary' }), 'FRONTEND_UNAVAILABLE');
});

test('input validation: non-string, NUL byte and oversize sources are rejected before running anything', async () => {
  await rejects(compileSource(42, fake('process.exit(0)')), 'INVALID_INPUT');
  await rejects(compileSource('a\0b', fake('process.exit(0)')), 'INVALID_INPUT');
  await rejects(compileSource('a'.repeat(MAX_SOURCE_CHARS + 1), fake('process.exit(0)')), 'PAYLOAD_TOO_LARGE');
});
