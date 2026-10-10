// codeguardian-engine HTTP gateway (Phases.md section 3: POST /api/analyze).
//   POST /api/analyze   { "source": "<Mini-C>" } or { "cfg": { ...CFG.json } }  ->  { cfg, audit, meta }
//   GET  /api/examples  bundled example programs for the dashboard's test-case selector
//   GET  /health
// Uses node:http only (PRD NFR-04, no bloat) and binds to 127.0.0.1 by default.
import { createServer as createHttpServer } from 'node:http';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { analyze } from './auditor.js';
import { compileSource, findFrontend, MAX_SOURCE_CHARS } from './compile.js';
import { AnalysisError } from './errors.js';
import { loadRules } from './rules.js';

const MAX_BODY_BYTES = 1024 * 1024;
const DEFAULT_EXAMPLES_DIR = fileURLToPath(new URL('../../examples/', import.meta.url));
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const STATUS = {
  INVALID_INPUT: 400, COMPILE_ERROR: 422, PAYLOAD_TOO_LARGE: 413, UNSUPPORTED_MEDIA_TYPE: 415,
  NOT_FOUND: 404, METHOD_NOT_ALLOWED: 405, FRONTEND_UNAVAILABLE: 503, FRONTEND_TIMEOUT: 504, INTERNAL: 500,
};

const fail = (message, code, diagnostics = []) => new AnalysisError(message, diagnostics, code);

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size <= MAX_BODY_BYTES) chunks.push(chunk);
      else if (size > MAX_BODY_BYTES * 8) request.destroy();
    });
    request.on('end', () => {
      if (size > MAX_BODY_BYTES) reject(fail('Request body is too large', 'PAYLOAD_TOO_LARGE', [{ path: '/', message: `limit is ${MAX_BODY_BYTES} bytes` }]));
      else resolve(Buffer.concat(chunks).toString('utf8'));
    });
    request.on('error', reject);
  });
}

function listExamples(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith('.c'))
    .sort()
    .filter((name) => statSync(directory + name).size <= MAX_SOURCE_CHARS)
    .map((name) => ({ name, source: readFileSync(directory + name, 'utf8') }));
}

export function createServer({
  frontendPath = findFrontend(),
  frontendArgs = [],
  rules = loadRules(),
  examplesDir = DEFAULT_EXAMPLES_DIR,
  now = () => new Date().toISOString(),
  compile = compileSource,
  compileTimeoutMs = 10_000,
} = {}) {
  async function analyzeRequest(rawBody) {
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (error) {
      throw fail('Request body is not valid JSON', 'INVALID_INPUT', [{ path: '/', message: error.message }]);
    }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      throw fail('Request body must be a JSON object', 'INVALID_INPUT', [{ path: '/', message: 'expected an object' }]);
    }
    const unknown = Object.keys(body).filter((key) => key !== 'source' && key !== 'cfg');
    if (unknown.length > 0) {
      throw fail('Unknown request fields', 'INVALID_INPUT', unknown.map((key) => ({ path: `/${key}`, message: 'not allowed' })));
    }
    const hasSource = Object.hasOwn(body, 'source');
    const hasCfg = Object.hasOwn(body, 'cfg');
    if (hasSource === hasCfg) {
      throw fail('Provide exactly one of "source" or "cfg"', 'INVALID_INPUT', [{ path: '/', message: 'exactly one of source, cfg is required' }]);
    }

    const started = performance.now();
    const cfg = hasSource
      ? await compile(body.source, { frontendPath, frontendArgs, timeoutMs: compileTimeoutMs })
      : body.cfg;
    let audit;
    try {
      audit = analyze(cfg, rules, { timestamp: now() });
    } catch (error) {
      // A CFG the frontend itself produced must satisfy the contract; if not, it is our bug, not the caller's.
      if (hasSource && error instanceof AnalysisError && error.code === 'INVALID_INPUT') {
        throw fail('Compiler frontend produced a CFG that violates the CFG.json contract', 'INTERNAL', error.diagnostics);
      }
      throw error;
    }
    return { cfg, audit, meta: { compiled: hasSource, durationMs: Math.round(performance.now() - started) } };
  }

  async function route(request, response, send) {
    const { pathname } = new URL(request.url, 'http://localhost');
    const method = request.method;
    const allow = (...methods) => {
      if (!methods.includes(method)) {
        response.setHeader('Allow', methods.join(', '));
        throw fail('Method not allowed', 'METHOD_NOT_ALLOWED', [{ path: pathname, message: `use ${methods.join(' or ')}` }]);
      }
    };

    if (pathname === '/health') {
      allow('GET');
      return send(200, { status: 'ok', frontendAvailable: Boolean(frontendPath) });
    }
    if (pathname === '/api/examples') {
      allow('GET');
      return send(200, { examples: listExamples(examplesDir) });
    }
    if (pathname === '/api/analyze') {
      allow('POST');
      if (!String(request.headers['content-type'] ?? '').toLowerCase().includes('application/json')) {
        throw fail('Content-Type must be application/json', 'UNSUPPORTED_MEDIA_TYPE', []);
      }
      return send(200, await analyzeRequest(await readBody(request)));
    }
    throw fail('Not found', 'NOT_FOUND', [{ path: pathname, message: 'unknown route' }]);
  }

  return createHttpServer(async (request, response) => {
    const origin = request.headers.origin;
    if (typeof origin === 'string' && LOCAL_ORIGIN.test(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');

    const send = (status, payload) => {
      const text = JSON.stringify(payload);
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text) });
      response.end(text);
    };

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }
    try {
      await route(request, response, send);
    } catch (error) {
      if (error instanceof AnalysisError) {
        send(STATUS[error.code] ?? 400, { error: error.message, code: error.code, diagnostics: error.diagnostics });
      } else {
        send(500, { error: 'Internal server error', code: 'INTERNAL', diagnostics: [] });
      }
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 8787);
  const host = process.env.HOST ?? '127.0.0.1';
  const frontend = findFrontend();
  createServer({ frontendPath: frontend }).listen(port, host, () => {
    process.stdout.write(`codeguardian-engine listening on http://${host}:${port}\n`);
    if (!frontend) process.stdout.write('warning: compiler frontend not found; only { "cfg": ... } requests work. Run `make build`.\n');
  });
}
