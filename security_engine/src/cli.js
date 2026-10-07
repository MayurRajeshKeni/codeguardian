#!/usr/bin/env node
// codeguardian-engine: CFG.json (file or stdin) -> Audit.json (stdout).
//   codeguardian-frontend examples/sql_injection.c | node src/cli.js
//   node src/cli.js cfg.json --timestamp 2026-01-01T00:00:00Z
import { readFileSync } from 'node:fs';
import { analyze } from './auditor.js';
import { AnalysisError } from './errors.js';
import { loadRules } from './rules.js';

function parseArgs(argv) {
  const options = { file: null, timestamp: new Date().toISOString(), rules: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--timestamp') options.timestamp = argv[++i];
    else if (argv[i] === '--rules') options.rules = argv[++i];
    else if (options.file === null) options.file = argv[i];
    else throw new AnalysisError('Unexpected argument', [{ path: '/argv', message: argv[i] }]);
  }
  return options;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const source = readFileSync(options.file && options.file !== '-' ? options.file : 0, 'utf8');
  let cfg;
  try {
    cfg = JSON.parse(source);
  } catch (error) {
    throw new AnalysisError('Input is not valid JSON', [{ path: '/', message: error.message }]);
  }
  const rules = options.rules ? loadRules(options.rules) : loadRules();
  process.stdout.write(`${JSON.stringify(analyze(cfg, rules, { timestamp: options.timestamp }), null, 2)}\n`);
} catch (error) {
  const diagnostics = error instanceof AnalysisError ? error.diagnostics : [{ path: '/', message: String(error.message ?? error) }];
  process.stderr.write(`${JSON.stringify({ error: error.message, diagnostics }, null, 2)}\n`);
  process.exitCode = 1;
}
