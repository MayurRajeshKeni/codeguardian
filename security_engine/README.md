# security_engine (Member 2)

Taint analysis engine: `CFG.json` in, `Audit.json` out.

## Run

```
npm install
npm test                      # unit + integration tests (pipeline tests need the compiler: `make build` in the repo root)
npm start                     # HTTP gateway on http://127.0.0.1:8787  (PORT / HOST env vars override)
```

Command line (Gate 3):

```
codeguardian-frontend examples/sql_injection.c | node src/cli.js
node src/cli.js cfg.json --timestamp 2026-01-01T00:00:00Z
```

## HTTP API

| Method | Path | Body | Result |
| :--- | :--- | :--- | :--- |
| GET | `/health` | | `{ status, frontendAvailable }` |
| GET | `/api/examples` | | `{ examples: [{ name, source }] }` |
| POST | `/api/analyze` | `{ "source": "<Mini-C>" }` **or** `{ "cfg": {...} }` | `{ cfg, audit, meta }` |

Errors are `{ error, code, diagnostics }`:

| Status | code | Meaning |
| :--- | :--- | :--- |
| 400 | `INVALID_INPUT` | bad JSON, wrong fields, or a CFG that breaks the contract |
| 413 | `PAYLOAD_TOO_LARGE` | body over 1 MiB or source over 100,000 characters |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Content-Type is not application/json |
| 422 | `COMPILE_ERROR` | Mini-C rejected; `diagnostics` hold `kind`, `line`, `column`, `message` |
| 503 | `FRONTEND_UNAVAILABLE` | compiler not built (set `CODEGUARDIAN_FRONTEND` or run `make build`) |
| 504 | `FRONTEND_TIMEOUT` | compiler took longer than 10 s |
| 500 | `INTERNAL` | engine or frontend bug (for example a frontend CFG that violates the contract) |

Source text is written to a private temp file and the compiler is started without a shell, so submitted code can not run commands.
The server binds to localhost only, and CORS allows only `localhost` / `127.0.0.1` origins (the Vite dev server).

## Layout

`src/transfer.js` instruction semantics and GEN/KILL, `src/solver.js` Kildall worklist, `src/auditor.js` findings and traces,
`src/compile.js` frontend bridge, `src/server.js` HTTP gateway, `src/cli.js` command line, `schemas/` data contracts.
