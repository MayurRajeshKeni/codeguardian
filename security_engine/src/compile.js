// Bridge to Member 1's compiler frontend: Mini-C source text -> CFG.json object.
// The frontend only accepts a file path, so each submission is written to a private temporary directory,
// the binary is started with an argument array (never through a shell, so source text can not inject
// commands), and the directory is always removed afterwards.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AnalysisError } from './errors.js';

export const MAX_SOURCE_CHARS = 100_000;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

export function findFrontend(env = process.env) {
  if (env.CODEGUARDIAN_FRONTEND) return existsSync(env.CODEGUARDIAN_FRONTEND) ? env.CODEGUARDIAN_FRONTEND : null;
  const dir = `${REPO_ROOT}compiler_core/bin/`;
  return ['codeguardian-frontend.exe', 'codeguardian-frontend'].map((name) => dir + name).find(existsSync) ?? null;
}

// "[Syntax Error] Line 2, Column 12: syntax error, unexpected TOK_SEMI"
const FRONTEND_DIAGNOSTIC = /^\[(Lexical|Syntax) Error\] Line (\d+), Column (\d+): (.*)$/;

export function parseFrontendDiagnostics(stderr) {
  const diagnostics = [];
  for (const raw of stderr.split(/\r?\n/)) {
    const match = FRONTEND_DIAGNOSTIC.exec(raw.trim());
    if (match) {
      diagnostics.push({
        path: '/source',
        kind: match[1].toUpperCase(),
        line: Number(match[2]),
        column: Number(match[3]),
        message: match[4],
      });
    }
  }
  return diagnostics;
}

function runProcess(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(command, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      reject(new AnalysisError('Compiler frontend could not be started', [{ path: '/', message: error.message }], 'FRONTEND_UNAVAILABLE'));
      return;
    }
    const stdout = [];
    const stderr = [];
    let size = 0;
    let timedOut = false;
    let truncated = false;

    const collect = (bucket) => (chunk) => {
      size += chunk.length;
      if (size > MAX_OUTPUT_BYTES) {
        truncated = true;
        child.kill('SIGKILL');
        return;
      }
      bucket.push(chunk);
    };
    child.stdout.on('data', collect(stdout));
    child.stderr.on('data', collect(stderr));

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(new AnalysisError('Compiler frontend could not be started', [{ path: '/', message: error.message }], 'FRONTEND_UNAVAILABLE'));
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({
        code, signal, timedOut, truncated,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
  });
}

export async function compileSource(source, { frontendPath, frontendArgs = [], timeoutMs = 10_000 } = {}) {
  if (typeof source !== 'string') {
    throw new AnalysisError('source must be a string', [{ path: '/source', message: 'expected a string' }]);
  }
  if (source.length > MAX_SOURCE_CHARS) {
    throw new AnalysisError('source is too large', [{ path: '/source', message: `limit is ${MAX_SOURCE_CHARS} characters` }], 'PAYLOAD_TOO_LARGE');
  }
  if (source.includes('\0')) {
    throw new AnalysisError('source contains a NUL byte', [{ path: '/source', message: 'NUL bytes are not allowed' }]);
  }
  if (!frontendPath) {
    throw new AnalysisError('Compiler frontend is not available', [
      { path: '/', message: 'run `make build` in the repository root, or set CODEGUARDIAN_FRONTEND' },
    ], 'FRONTEND_UNAVAILABLE');
  }

  const directory = await mkdtemp(join(tmpdir(), 'codeguardian-'));
  try {
    const file = join(directory, 'input.c');
    await writeFile(file, source, { encoding: 'utf8', mode: 0o600 });
    const run = await runProcess(frontendPath, [...frontendArgs, file], timeoutMs);

    if (run.timedOut) throw new AnalysisError('Compiler frontend timed out', [{ path: '/', message: `no result within ${timeoutMs} ms` }], 'FRONTEND_TIMEOUT');
    if (run.truncated) throw new AnalysisError('Compiler frontend produced too much output', [], 'INTERNAL');
    if (run.code === null) throw new AnalysisError('Compiler frontend crashed', [{ path: '/', message: `terminated by ${run.signal}` }], 'INTERNAL');

    if (run.code !== 0) {
      let diagnostics = parseFrontendDiagnostics(run.stderr);
      if (diagnostics.length === 0) {
        const firstLine = run.stderr.split(/\r?\n/).find((line) => line.trim() !== '') ?? `frontend exited with code ${run.code}`;
        diagnostics = [{ path: '/source', message: firstLine.trim().slice(0, 200) }];
      }
      throw new AnalysisError('Mini-C source was rejected by the compiler frontend', diagnostics, 'COMPILE_ERROR');
    }

    try {
      return JSON.parse(run.stdout);
    } catch {
      throw new AnalysisError('Compiler frontend did not produce valid JSON', [], 'INTERNAL');
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
