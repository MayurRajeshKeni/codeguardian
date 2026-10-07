import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyze } from '../src/auditor.js';
import { AnalysisError } from '../src/errors.js';
import { difference, equals, union } from '../src/lattice.js';
import { loadRules } from '../src/rules.js';
import { solveTaint } from '../src/solver.js';
import { buildRuleIndex, extractGenKill, transferBlock } from '../src/transfer.js';
import { validateAudit } from '../src/validate.js';

const TS = '2026-10-07T00:00:00Z';
const rules = loadRules();
const ruleIndex = buildRuleIndex(rules);
const load = (path) => JSON.parse(readFileSync(new URL(`./fixtures/${path}`, import.meta.url), 'utf8'));
const run = (path) => analyze(load(path), rules, { timestamp: TS });

const ins = (index, op, arg1, arg2, result, line = 1) => ({ index, op, arg1, arg2, result, line });
function singleBlockCfg(instructions, variables) {
  return {
    version: '1.0', entryBlock: 'B0', exitBlock: 'B0', variables,
    blocks: [{ id: 'B0', label: 'Entry Block', instructions, predecessors: [], successors: [] }],
    edges: [],
  };
}
const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(deepFreeze);
  }
  return o;
};

// ------------------------------------------------ acceptance programs compiled by Member 1's frontend

test('clean_flow.c: source -> sanitize -> sink has 0 vulnerabilities (Gate 3 case 1)', () => {
  const audit = run('real/clean_flow.json');
  assert.equal(audit.programSummary.vulnerabilitiesFound, 0);
  assert.deepEqual(audit.vulnerabilities, []);
  assert.equal(audit.blockStatus.B0, 'SANITIZED');
});

test('sql_injection.c: direct flow to execute_query is CWE-89', () => {
  const [v] = run('real/sql_injection.json').vulnerabilities;
  assert.equal(v.cwe, 'CWE-89');
  assert.equal(v.type, 'SQL_INJECTION');
  assert.equal(v.variable, 'user_input');
  assert.equal(v.sourceInstruction.sourceFunction, 'read_input');
  assert.equal(v.sourceInstruction.assignedTo, 'user_input');
  assert.deepEqual(v.taintPath, ['B0']);
});

test('command_injection.c: only the unsanitized else-branch reaches system_exec (CWE-78)', () => {
  const audit = run('real/command_injection.json');
  assert.equal(audit.vulnerabilities.length, 1);
  const [v] = audit.vulnerabilities;
  assert.equal(v.cwe, 'CWE-78');
  assert.equal(v.sinkInstruction.block, 'B3');
  assert.deepEqual(v.taintPath, ['B0', 'B2', 'B3']);
  assert.equal(audit.blockStatus.B1, 'SANITIZED');
  assert.equal(audit.blockStatus.B3, 'VULNERABLE');
});

test('complex_loop.c: taint accumulated through the loop back-edge reaches the sink', () => {
  const audit = run('real/complex_loop.json');
  assert.equal(audit.vulnerabilities.length, 1);
  const [v] = audit.vulnerabilities;
  assert.equal(v.variable, 'accumulator');
  assert.equal(v.sourceInstruction.assignedTo, 'data');
  assert.equal(v.taintPath[0], 'B0');
  assert.equal(v.taintPath.at(-1), 'B3');
  assert.ok(v.taintPath.includes('B2'), 'path must pass through the loop body');
});

// ------------------------------------------------ Architecture.md fixtures

test('mock_CFG.json: tainted along the else branch (B2) only', () => {
  const audit = run('mock_CFG.json');
  const [v] = audit.vulnerabilities;
  assert.deepEqual(v.taintPath, ['B0', 'B2', 'B3']);
  assert.equal(v.sourceInstruction.assignedTo, 'x');
  assert.deepEqual(audit.latticeStates.B1.kill, ['x']);
  assert.equal(audit.latticeStates.B1.out.includes('x'), false);
  assert.ok(audit.latticeStates.B3.in.includes('x'));
});

test('mock_CFG_loop.json: taint reaches x only on the second iteration, solver still converges', () => {
  const cfg = load('mock_CFG_loop.json');
  const solution = solveTaint(cfg, ruleIndex);
  assert.ok(solution.out.get('B1').has('y'));
  assert.ok(solution.out.get('B1').has('x'), 'x = y inside the loop must become tainted after iteration 2');
  assert.ok(solution.iterations > cfg.blocks.length, 'a back-edge forces revisiting blocks');
  const [v] = analyze(cfg, rules, { timestamp: TS }).vulnerabilities;
  assert.equal(v.sinkInstruction.block, 'B3');
});

// ------------------------------------------------ mathematical properties

const ALL = ['real/clean_flow.json', 'real/sql_injection.json', 'real/command_injection.json',
  'real/complex_loop.json', 'mock_CFG.json', 'mock_CFG_loop.json'];

test('fixpoint satisfies IN = union of pred OUTs and OUT = GEN u (IN \\ KILL) for every block', () => {
  for (const path of ALL) {
    const cfg = load(path);
    const solution = solveTaint(cfg, ruleIndex);
    for (const block of cfg.blocks) {
      let expectedIn = new Set();
      for (const p of block.predecessors) expectedIn = union(expectedIn, solution.out.get(p));
      assert.ok(equals(solution.in.get(block.id), expectedIn), `${path} ${block.id}: IN equation`);
      const transfer = transferBlock(block, solution.in.get(block.id), ruleIndex);
      const { gen, kill } = extractGenKill(transfer);
      const rhs = union(gen, difference(solution.in.get(block.id), kill));
      assert.ok(equals(solution.out.get(block.id), rhs), `${path} ${block.id}: OUT equation`);
    }
  }
});

test('worklist result equals the least fixed point from naive round-robin iteration', () => {
  for (const path of ALL) {
    const cfg = load(path);
    const out = new Map(cfg.blocks.map((b) => [b.id, new Set()]));
    let changed = true;
    while (changed) {
      changed = false;
      for (const block of cfg.blocks) {
        let inSet = new Set();
        for (const p of block.predecessors) inSet = union(inSet, out.get(p));
        const next = transferBlock(block, inSet, ruleIndex).out;
        if (!equals(next, out.get(block.id))) { out.set(block.id, next); changed = true; }
      }
    }
    const solution = solveTaint(cfg, ruleIndex);
    for (const block of cfg.blocks) assert.ok(equals(solution.out.get(block.id), out.get(block.id)), `${path} ${block.id}`);
  }
});

test('block transfer function is monotone: X subset-of Y implies f(X) subset-of f(Y)', () => {
  const cfg = load('real/complex_loop.json');
  const vars = cfg.variables;
  for (const block of cfg.blocks) {
    for (let mask = 0; mask < 1 << vars.length; mask += 1) {
      const small = new Set(vars.filter((_, i) => mask & (1 << i)));
      for (const extra of vars) {
        const big = new Set([...small, extra]);
        const fs = transferBlock(block, small, ruleIndex).out;
        const fb = transferBlock(block, big, ruleIndex).out;
        for (const v of fs) assert.ok(fb.has(v), `${block.id}: monotonicity violated for ${v}`);
      }
    }
  }
});

// ------------------------------------------------ semantics edge cases

test('x = sanitize(x) cleans x, but a bare sanitize(x); does not (conservative)', () => {
  const vars = ['x', 't0', 't1'];
  const cleaned = singleBlockCfg([
    ins(0, 'CALL', 'read_input', null, 't0'), ins(1, 'ASSIGN', 't0', null, 'x'),
    ins(2, 'CALL', 'sanitize', 'x', 't1'), ins(3, 'ASSIGN', 't1', null, 'x'),
    ins(4, 'CALL', 'execute_query', 'x', null),
  ], vars);
  assert.equal(analyze(cleaned, rules, { timestamp: TS }).vulnerabilities.length, 0);

  const bare = singleBlockCfg([
    ins(0, 'CALL', 'read_input', null, 't0'), ins(1, 'ASSIGN', 't0', null, 'x'),
    ins(2, 'CALL', 'sanitize', 'x', null),
    ins(3, 'CALL', 'execute_query', 'x', null),
  ], vars);
  assert.equal(analyze(bare, rules, { timestamp: TS }).vulnerabilities.length, 1);
});

test('taint propagates through arithmetic and is killed by a constant overwrite', () => {
  const vars = ['a', 'b', 't0', 't1'];
  const base = [
    ins(0, 'CALL', 'get_param', '"id"', 't0'), ins(1, 'ASSIGN', 't0', null, 'a'),
    ins(2, 'ADD', 'a', '1', 't1'), ins(3, 'ASSIGN', 't1', null, 'b'),
  ];
  const through = singleBlockCfg([...base, ins(4, 'CALL', 'render_output', 'b', null)], vars);
  const [v] = analyze(through, rules, { timestamp: TS }).vulnerabilities;
  assert.equal(v.cwe, 'CWE-79');
  assert.equal(v.severity, 'HIGH');

  const overwritten = singleBlockCfg([...base, ins(4, 'ASSIGN', '0', null, 'b'), ins(5, 'CALL', 'render_output', 'b', null)], vars);
  assert.equal(analyze(overwritten, rules, { timestamp: TS }).vulnerabilities.length, 0);
});

test('a literal passed to a sink is never reported', () => {
  const cfg = singleBlockCfg([ins(0, 'CALL', 'execute_query', '"SELECT 1"', null)], []);
  assert.equal(analyze(cfg, rules, { timestamp: TS }).vulnerabilities.length, 0);
});

// ------------------------------------------------ determinism, purity, fail-closed

test('analysis is deterministic: identical input gives bitwise-identical Audit.json (NFR-01)', () => {
  for (const path of ALL) {
    assert.equal(JSON.stringify(run(path)), JSON.stringify(run(path)));
  }
});

test('analysis is pure: deep-frozen inputs are accepted and not mutated', () => {
  const cfg = deepFreeze(load('real/complex_loop.json'));
  const frozenRules = deepFreeze(loadRules());
  assert.doesNotThrow(() => analyze(cfg, frozenRules, { timestamp: TS }));
});

test('every produced Audit.json satisfies the Audit contract', () => {
  for (const path of ALL) assert.equal(validateAudit(run(path)).valid, true, path);
});

test('unknown opcode fails closed with a structured diagnostic', () => {
  const cfg = singleBlockCfg([ins(0, 'FROBNICATE', 'a', null, 'b')], ['a', 'b']);
  assert.throws(() => analyze(cfg, rules, { timestamp: TS }), (e) => e instanceof AnalysisError && e.diagnostics.length > 0);
});

test('contract-violating CFG is rejected before analysis', () => {
  const cfg = load('mock_CFG.json');
  cfg.blocks[0].successors = ['B9'];
  assert.throws(() => analyze(cfg, rules, { timestamp: TS }), AnalysisError);
});

test('malformed security rules are rejected', () => {
  const cfg = load('mock_CFG.json');
  const bad = { ...loadRules(), sinks: [{ name: 'execute_query', vulnerableArgIndex: -1 }] };
  assert.throws(() => analyze(cfg, bad, { timestamp: TS }), AnalysisError);
  const duplicate = { ...loadRules(), sinks: [...loadRules().sinks, { name: 'read_input', vulnerableArgIndex: 0, cwe: 'CWE-1', type: 'X', severity: 'LOW' }] };
  assert.throws(() => analyze(cfg, duplicate, { timestamp: TS }), AnalysisError);
});

test('timestamp must be supplied by the caller', () => {
  assert.throws(() => analyze(load('mock_CFG.json'), rules), AnalysisError);
});
