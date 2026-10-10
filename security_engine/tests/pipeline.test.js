// End-to-end acceptance (Phases.md Gate 2 + Gate 3): Mini-C source -> codeguardian-frontend -> CFG.json -> engine -> Audit.json.
// Runs automatically when the compiler binary has been built (`make build` in the repo root); otherwise it is skipped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { analyze } from '../src/auditor.js';
import { findFrontend } from '../src/compile.js';
import { loadRules } from '../src/rules.js';
import { validateAudit, validateCfg } from '../src/validate.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const frontend = findFrontend();
const skip = frontend ? false : 'compiler not built: run `make build` in the repo root first';
const rules = loadRules();
const TS = '2026-10-07T00:00:00Z';

function compile(sourcePath) {
  const run = spawnSync(frontend, [sourcePath], { encoding: 'utf8' });
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}
const audit = (sourcePath) => {
  const { status, stdout, stderr } = compile(sourcePath);
  assert.equal(status, 0, `frontend failed on ${sourcePath}: ${stderr}`);
  const cfg = JSON.parse(stdout);
  const cfgCheck = validateCfg(cfg);
  assert.equal(cfgCheck.valid, true, JSON.stringify(cfgCheck.errors));
  const result = analyze(cfg, rules, { timestamp: TS });
  assert.equal(validateAudit(result).valid, true);
  return result;
};

const EXPECTED = {
  'clean_flow.c': [],
  'sql_injection.c': ['CWE-89'],
  'command_injection.c': ['CWE-78'],
  'complex_loop.c': ['CWE-89'],
};

for (const [file, cwes] of Object.entries(EXPECTED)) {
  test(`pipeline: examples/${file} -> ${cwes.length ? cwes.join(',') : 'CLEAN'}`, { skip }, () => {
    const result = audit(`${repoRoot}examples/${file}`);
    assert.deepEqual(result.vulnerabilities.map((v) => v.cwe), cwes);
  });
}

test('pipeline: every compiler_core unit-test program compiles and analyzes without error', { skip }, () => {
  const dir = `${repoRoot}compiler_core/tests/`;
  const programs = readdirSync(dir).filter((f) => f.endsWith('.c') && f !== 'test_invalid.c');
  assert.ok(programs.length > 0);
  for (const file of programs) assert.doesNotThrow(() => audit(dir + file), file);
});

test('pipeline: invalid Mini-C is rejected by the frontend (fail-closed)', { skip }, () => {
  assert.notEqual(compile(`${repoRoot}compiler_core/tests/test_invalid.c`).status, 0);
});

test('pipeline: whole chain is deterministic (NFR-01)', { skip }, () => {
  const first = JSON.stringify(audit(`${repoRoot}examples/complex_loop.c`));
  const second = JSON.stringify(audit(`${repoRoot}examples/complex_loop.c`));
  assert.equal(first, second);
});
