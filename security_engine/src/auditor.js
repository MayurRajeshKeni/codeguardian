// Vulnerability auditor: runs the Kildall solver, checks every sink against the fixpoint,
// reconstructs a source-to-sink trace (FR-07) and assembles Audit.json.
// analyze() is a pure function: (CFG, Rules, timestamp) -> Audit. The caller supplies the timestamp so
// identical inputs give bitwise-identical output (NFR-01).
import { AnalysisError } from './errors.js';
import { makeVariableComparator, toOrderedArray } from './lattice.js';
import { solveTaint } from './solver.js';
import {
  buildRuleIndex, classifyCall, extractGenKill, isTemporary,
  operandsOf, transferBlock, writesVariable,
} from './transfer.js';
import { validateAudit, validateCfg } from './validate.js';

const SANITIZER_HINT = { SQL_INJECTION: 'escape_sql', COMMAND_INJECTION: 'sanitize', XSS: 'html_encode' };
const blockNumber = (id) => Number(id.slice(1));

// Backward def-use search for a derivation of `variable` (tainted just before instruction `pos` of the block)
// back to a source call. Depth-first with a global visited set: sufficient for reachability, so it terminates on
// cyclic CFGs, and it finds a derivation whenever one exists because taint is the least fixed point.
function traceToSource(ctx, blockId, pos, variable, visited) {
  const key = `${blockId}|${pos}|${variable}`;
  if (visited.has(key)) return null;
  visited.add(key);

  const block = ctx.blocks.get(blockId);
  const { before } = ctx.transfers.get(blockId);

  for (let k = pos - 1; k >= 0; k -= 1) {
    const instr = block.instructions[k];
    if (!writesVariable(instr) || instr.result !== variable) continue;

    if (instr.op === 'CALL' && classifyCall(instr, ctx.ruleIndex) === 'source') {
      return {
        source: { block: blockId, instructionIndex: instr.index, sourceFunction: instr.arg1, line: instr.line },
        blocks: [blockId],
        vars: [variable],
      };
    }
    for (const operand of operandsOf(instr).filter((v) => before[k].has(v))) {
      const child = traceToSource(ctx, blockId, k, operand, visited);
      if (child) {
        const blocks = child.blocks.slice();
        if (blocks[blocks.length - 1] !== blockId) blocks.push(blockId);
        return { source: child.source, blocks, vars: [...child.vars, variable] };
      }
    }
    return null;
  }

  const predecessors = [...block.predecessors].sort((a, b) => blockNumber(a) - blockNumber(b));
  for (const predecessor of predecessors) {
    if (!ctx.out.get(predecessor).has(variable)) continue;
    const child = traceToSource(ctx, predecessor, ctx.blocks.get(predecessor).instructions.length, variable, visited);
    if (child) {
      const blocks = child.blocks.slice();
      if (blocks[blocks.length - 1] !== blockId) blocks.push(blockId);
      return { source: child.source, blocks, vars: child.vars };
    }
  }
  return null;
}

export function analyze(cfg, rules, { timestamp } = {}) {
  if (typeof timestamp !== 'string' || timestamp === '') {
    throw new AnalysisError('A timestamp string is required', [{ path: '/timestamp', message: 'pass { timestamp } explicitly' }]);
  }
  const cfgCheck = validateCfg(cfg);
  if (!cfgCheck.valid) throw new AnalysisError('CFG.json violates the data contract', cfgCheck.errors);
  const ruleIndex = buildRuleIndex(rules);

  // 1. Least fixed point of the taint equations (Kildall worklist).
  const solution = solveTaint(cfg, ruleIndex);

  // 2. Re-run each block once from its fixpoint IN set to get per-instruction states, GEN/KILL and events.
  const blocks = new Map(cfg.blocks.map((block) => [block.id, block]));
  const transfers = new Map(cfg.blocks.map((block) => [block.id, transferBlock(block, solution.in.get(block.id), ruleIndex)]));
  const ctx = { blocks, transfers, out: solution.out, ruleIndex };

  const compare = makeVariableComparator(cfg.variables);
  const ordered = (set) => toOrderedArray(set, compare);

  // 3. Findings: a sink argument that is tainted at the sink.
  const vulnerabilities = [];
  for (const block of cfg.blocks) {
    for (const hit of transfers.get(block.id).sinkHits) {
      const trace = traceToSource(ctx, block.id, hit.pos, hit.arg, new Set());
      if (!trace) {
        throw new AnalysisError('Internal error: tainted sink argument has no source derivation', [
          { path: `/instruction/${hit.instr.index}`, message: `no trace for '${hit.arg}'` },
        ]);
      }
      const assignedTo = trace.vars.find((name) => !isTemporary(name)) ?? trace.vars[0];
      const hint = SANITIZER_HINT[hit.rule.type] ?? 'sanitize';
      vulnerabilities.push({
        id: `VULN-${String(vulnerabilities.length + 1).padStart(3, '0')}`,
        type: hit.rule.type,
        cwe: hit.rule.cwe,
        severity: hit.rule.severity,
        variable: hit.arg,
        sinkInstruction: {
          block: block.id,
          instructionIndex: hit.instr.index,
          op: hit.instr.op,
          sinkFunction: hit.instr.arg1,
          taintedArg: hit.arg,
          line: hit.instr.line,
        },
        sourceInstruction: { ...trace.source, assignedTo },
        taintPath: trace.blocks,
        remediation: `Pass '${hit.arg}' through ${hint}() on every path (${trace.blocks.join(' -> ')}) before it reaches '${hit.instr.arg1}'.`,
      });
    }
  }

  // 4. Lattice state and block status for the dashboard.
  const latticeStates = {};
  const blockStatus = {};
  for (const block of cfg.blocks) {
    const transfer = transfers.get(block.id);
    const { gen, kill } = extractGenKill(transfer);
    latticeStates[block.id] = {
      in: ordered(solution.in.get(block.id)),
      gen: ordered(gen),
      kill: ordered(kill),
      out: ordered(solution.out.get(block.id)),
    };
    if (transfer.sinkHits.length > 0) blockStatus[block.id] = 'VULNERABLE';
    else if (transfer.sanitizations.length > 0) blockStatus[block.id] = 'SANITIZED';
    else if (solution.out.get(block.id).size > 0) blockStatus[block.id] = 'TAINTED';
    else blockStatus[block.id] = 'CLEAN';
  }

  const audit = {
    timestamp,
    programSummary: {
      totalBlocks: cfg.blocks.length,
      totalInstructions: cfg.blocks.reduce((n, b) => n + b.instructions.length, 0),
      vulnerabilitiesFound: vulnerabilities.length,
    },
    latticeStates,
    blockStatus,
    vulnerabilities,
  };

  const self = validateAudit(audit);
  if (!self.valid) throw new AnalysisError('Internal error: produced Audit.json violates its contract', self.errors);
  return audit;
}
