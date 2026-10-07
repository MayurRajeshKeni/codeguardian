// Structured, fail-closed diagnostics (Rules.md 1.3, PRD NFR-03).
export class AnalysisError extends Error {
  constructor(message, diagnostics = []) {
    super(message);
    this.name = 'AnalysisError';
    this.diagnostics = diagnostics;
  }
}
