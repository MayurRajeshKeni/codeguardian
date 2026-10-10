// Structured, fail-closed diagnostics (Rules.md 1.3, PRD NFR-03).
// `code` lets the HTTP layer map failures to status codes without string matching.
export class AnalysisError extends Error {
  constructor(message, diagnostics = [], code = 'INVALID_INPUT') {
    super(message);
    this.name = 'AnalysisError';
    this.diagnostics = diagnostics;
    this.code = code;
  }
}
