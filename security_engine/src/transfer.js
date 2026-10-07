// Instruction-level taint semantics and block-level GEN/KILL extraction.
//
// Facts are variable names; a variable is in the state iff it may hold attacker-controlled data
// (forward, may-analysis; PRD section 5). The per-instruction function is
//   f(X) = (X \ {r}) U ({r} if the value written to r is tainted)
// which is monotone (X subset-of Y implies f(X) subset-of f(Y)), so every block function composed
// from it is monotone as well (Aho et al., 2nd ed., section 9.3.3 / Algorithm 9.25 preconditions).
import { AnalysisError } from './errors.js';

const BINARY_OPS = new Set(['ADD', 'SUB', 'MUL', 'DIV', 'MOD', 'EQ', 'NEQ', 'LT', 'LE', 'GT', 'GE', 'AND', 'OR']);
const UNARY_OPS = new Set(['NOT']);
const NON_WRITING_OPS = new Set(['NOP', 'LABEL', 'GOTO', 'IF_FALSE', 'IF_TRUE', 'RETURN']);
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const TEMPORARY = /^t[0-9]+$/;

export const isVariable = (name) => typeof name === 'string' && IDENTIFIER.test(name);
export const isTemporary = (name) => typeof name === 'string' && TEMPORARY.test(name);

// ---------------------------------------------------------------- rules

export function buildRuleIndex(rules) {
  const problems = [];
  const index = { sources: new Map(), sanitizers: new Map(), sinks: new Map() };
  const owner = new Map();
  const isIndex = (n) => Number.isInteger(n) && n >= 0;

  if (rules === null || typeof rules !== 'object') {
    throw new AnalysisError('Invalid security rules', [{ path: '/', message: 'rules must be an object' }]);
  }

  const categories = [
    ['sources', (r) => (typeof r.taintsResult === 'boolean' ? null : 'taintsResult must be boolean')],
    ['sanitizers', (r) =>
      !isIndex(r.cleansArgIndex) ? 'cleansArgIndex must be a non-negative integer'
        : typeof r.cleansResult !== 'boolean' ? 'cleansResult must be boolean' : null],
    ['sinks', (r) =>
      !isIndex(r.vulnerableArgIndex) ? 'vulnerableArgIndex must be a non-negative integer'
        : ['cwe', 'type', 'severity'].some((k) => typeof r[k] !== 'string' || r[k] === '')
          ? 'cwe, type and severity must be non-empty strings' : null],
  ];

  for (const [key, check] of categories) {
    const list = rules[key];
    if (!Array.isArray(list)) {
      problems.push({ path: `/${key}`, message: 'must be an array' });
      continue;
    }
    list.forEach((rule, i) => {
      const path = `/${key}/${i}`;
      if (rule === null || typeof rule !== 'object' || !isVariable(rule.name)) {
        problems.push({ path, message: 'rule needs an identifier name' });
        return;
      }
      if (owner.has(rule.name)) {
        problems.push({ path, message: `'${rule.name}' already defined as ${owner.get(rule.name)}` });
        return;
      }
      const issue = check(rule);
      if (issue) {
        problems.push({ path, message: issue });
        return;
      }
      owner.set(rule.name, key);
      index[key].set(rule.name, rule);
    });
  }

  if (problems.length > 0) throw new AnalysisError('Invalid security rules', problems);
  return index;
}

// ---------------------------------------------------------------- instruction helpers

export const writesVariable = (instr) => !NON_WRITING_OPS.has(instr.op) && instr.result !== null;

// Call arguments. The CFG contract carries at most one argument, in arg2 (arg1 is the callee name).
export const callArguments = (instr) => (instr.arg2 === null ? [] : [instr.arg2]);

// Variables read by an instruction (literals excluded).
export function operandsOf(instr) {
  let raw;
  if (instr.op === 'CALL') raw = callArguments(instr);
  else if (instr.op === 'ASSIGN' || UNARY_OPS.has(instr.op) || instr.op === 'IF_FALSE' || instr.op === 'IF_TRUE' || instr.op === 'RETURN') raw = [instr.arg1];
  else if (BINARY_OPS.has(instr.op)) raw = [instr.arg1, instr.arg2];
  else raw = [];
  return raw.filter(isVariable);
}

export function classifyCall(instr, ruleIndex) {
  const callee = instr.arg1;
  if (ruleIndex.sources.has(callee)) return 'source';
  if (ruleIndex.sanitizers.has(callee)) return 'sanitizer';
  if (ruleIndex.sinks.has(callee)) return 'sink';
  return 'other';
}

function assertKnownOp(instr) {
  const known = instr.op === 'ASSIGN' || instr.op === 'CALL' || BINARY_OPS.has(instr.op)
    || UNARY_OPS.has(instr.op) || NON_WRITING_OPS.has(instr.op);
  if (!known) {
    throw new AnalysisError(`Unknown TAC opcode '${instr.op}'`, [
      { path: `/instruction/${instr.index}`, message: `opcode '${instr.op}' is not supported by the solver` },
    ]);
  }
}

// Does the value written by this instruction carry taint, given the state before it executes?
function writtenValueIsTainted(state, instr, ruleIndex) {
  const anyOperandTainted = () => operandsOf(instr).some((v) => state.has(v));
  if (instr.op !== 'CALL') return anyOperandTainted();

  if (!isVariable(instr.arg1)) {
    throw new AnalysisError('CALL without a callee name', [{ path: `/instruction/${instr.index}`, message: 'arg1 must name a function' }]);
  }
  switch (classifyCall(instr, ruleIndex)) {
    case 'source':
      return ruleIndex.sources.get(instr.arg1).taintsResult ? true : anyOperandTainted();
    case 'sanitizer':
      // A sanitizer cleans its *result*. The argument variable itself is only cleaned when the
      // result is assigned back to it (x = sanitize(x)); a bare sanitize(x); statement is
      // conservatively treated as having no effect on x.
      return ruleIndex.sanitizers.get(instr.arg1).cleansResult ? false : anyOperandTainted();
    default:
      // Sinks and unknown callees: conservative propagation from the argument to the result.
      return anyOperandTainted();
  }
}

// Pure single-instruction transfer. Returns the next state (a new Set when a write occurs).
export function stepInstruction(state, instr, ruleIndex) {
  assertKnownOp(instr);
  if (!writesVariable(instr)) return { state, written: null };
  if (!isVariable(instr.result)) {
    throw new AnalysisError(`Instruction ${instr.index} writes to a non-variable '${instr.result}'`, [
      { path: `/instruction/${instr.index}`, message: 'result must be an identifier' },
    ]);
  }
  const next = new Set(state);
  if (writtenValueIsTainted(state, instr, ruleIndex)) next.add(instr.result);
  else next.delete(instr.result);
  return { state: next, written: instr.result };
}

// ---------------------------------------------------------------- block transfer

// Runs the block's instructions in order from `inState`.
// before[k] is the taint state just before instruction k; sinkHits / sanitizations record events.
export function transferBlock(block, inState, ruleIndex) {
  const before = [];
  const written = new Set();
  const sinkHits = [];
  const sanitizations = [];
  let state = inState;

  block.instructions.forEach((instr, pos) => {
    before.push(state);
    if (instr.op === 'CALL') {
      const kind = classifyCall(instr, ruleIndex);
      const args = callArguments(instr);
      if (kind === 'sink') {
        const rule = ruleIndex.sinks.get(instr.arg1);
        const arg = args[rule.vulnerableArgIndex];
        if (isVariable(arg) && state.has(arg)) sinkHits.push({ pos, instr, rule, arg });
      } else if (kind === 'sanitizer') {
        const arg = args[ruleIndex.sanitizers.get(instr.arg1).cleansArgIndex];
        if (isVariable(arg) && state.has(arg)) sanitizations.push({ pos, instr, arg });
      }
    }
    const step = stepInstruction(state, instr, ruleIndex);
    if (step.written !== null) written.add(step.written);
    state = step.state;
  });

  return { out: new Set(state), before, written, sinkHits, sanitizations };
}

// GEN[B]  = variables written in B whose final value is tainted.
// KILL[B] = variables written in B whose final value is clean (sanitized / overwritten by clean data).
// Because every variable written in B is in exactly one of the two sets, the identity
//   OUT[B] = GEN[B] U (IN[B] \ KILL[B])
// holds exactly for the IN[B] the transfer was evaluated with.
export function extractGenKill(transfer) {
  const gen = new Set();
  const kill = new Set();
  for (const variable of transfer.written) {
    if (transfer.out.has(variable)) gen.add(variable);
    else kill.add(variable);
  }
  return { gen, kill };
}
