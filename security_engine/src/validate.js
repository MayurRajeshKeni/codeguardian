// Contract validation for CFG.json and Audit.json (Architecture.md section 3).
// Fail-closed: invalid payloads yield a structured diagnostic list (Rules.md 1.3, NFR-03).
import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';

const load = (name) =>
  JSON.parse(readFileSync(new URL(`../schemas/${name}`, import.meta.url), 'utf8'));

const ajv = new Ajv2020({ allErrors: true, strict: true });
const cfgValidator = ajv.compile(load('cfg.schema.json'));
const auditValidator = ajv.compile(load('audit.schema.json'));

const toDiagnostics = (errors) =>
  (errors ?? []).map((e) => ({ path: e.instancePath || '/', message: e.message }));

// Structural checks that JSON Schema cannot express: referential integrity of the graph.
function cfgIntegrity(cfg) {
  const problems = [];
  const byId = new Map(cfg.blocks.map((b) => [b.id, b]));
  if (byId.size !== cfg.blocks.length) problems.push({ path: '/blocks', message: 'duplicate block id' });
  if (!byId.has(cfg.entryBlock)) problems.push({ path: '/entryBlock', message: 'entry block not found' });
  if (!byId.has(cfg.exitBlock)) problems.push({ path: '/exitBlock', message: 'exit block not found' });
  for (const b of cfg.blocks) {
    for (const ref of [...b.predecessors, ...b.successors]) {
      if (!byId.has(ref)) problems.push({ path: `/blocks/${b.id}`, message: `references unknown block ${ref}` });
    }
  }
  for (const e of cfg.edges) {
    const from = byId.get(e.from);
    const to = byId.get(e.to);
    if (!from || !to) {
      problems.push({ path: '/edges', message: `edge ${e.from}->${e.to} references unknown block` });
      continue;
    }
    if (!from.successors.includes(e.to)) problems.push({ path: '/edges', message: `${e.from} missing successor ${e.to}` });
    if (!to.predecessors.includes(e.from)) problems.push({ path: '/edges', message: `${e.to} missing predecessor ${e.from}` });
  }
  return problems;
}

export function validateCfg(cfg) {
  if (!cfgValidator(cfg)) return { valid: false, errors: toDiagnostics(cfgValidator.errors) };
  const problems = cfgIntegrity(cfg);
  return { valid: problems.length === 0, errors: problems };
}

export function validateAudit(audit) {
  const valid = auditValidator(audit);
  return { valid, errors: valid ? [] : toDiagnostics(auditValidator.errors) };
}
