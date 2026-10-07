import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateCfg, validateAudit } from '../src/validate.js';

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

test('mock_CFG.json satisfies the CFG contract (Gate 1)', () => {
  const r = validateCfg(fixture('mock_CFG.json'));
  assert.equal(r.valid, true, JSON.stringify(r.errors));
});

test('mock_CFG_loop.json (back-edge) satisfies the CFG contract', () => {
  const r = validateCfg(fixture('mock_CFG_loop.json'));
  assert.equal(r.valid, true, JSON.stringify(r.errors));
});

test('mock_Audit.json satisfies the Audit contract', () => {
  const r = validateAudit(fixture('mock_Audit.json'));
  assert.equal(r.valid, true, JSON.stringify(r.errors));
});

test('CFG with an unknown extra field is rejected', () => {
  const cfg = fixture('mock_CFG.json');
  cfg.extra = 1;
  assert.equal(validateCfg(cfg).valid, false);
});

test('CFG with an invalid edge type is rejected', () => {
  const cfg = fixture('mock_CFG.json');
  cfg.edges[0].type = 'MAYBE';
  assert.equal(validateCfg(cfg).valid, false);
});

test('CFG whose edge disagrees with successor lists is rejected', () => {
  const cfg = fixture('mock_CFG.json');
  cfg.blocks[0].successors = ['B1'];
  const r = validateCfg(cfg);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.message.includes('missing successor')));
});

test('Audit with an unknown block status is rejected', () => {
  const audit = fixture('mock_Audit.json');
  audit.blockStatus.B0 = 'SPICY';
  assert.equal(validateAudit(audit).valid, false);
});
