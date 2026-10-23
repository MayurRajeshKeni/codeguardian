import { useEffect, useState, useRef } from 'react';
import Graph, { formatInstruction } from './Graph.jsx';
import { generateSarifReport, downloadJsonFile } from './sarif.js';
import { computeRemediationPatch } from './remediation.js';

const samples = import.meta.glob('./samples/*.json', { eager: true, import: 'default' });
const sampleFor = (name) => samples[`./samples/${name.replace(/\.c$/, '')}.json`];

const Chips = ({ title, items }) => (
  <div className="sets"><span className="set-title">{title}</span>
    {items.length ? items.map((v) => <code key={v} className="chip">{v}</code>) : <em>∅</em>}
  </div>
);

function detectLanguage(code) {
  if (!code || !code.trim()) return { status: 'empty', label: 'Empty', hint: '' };

  if (/^\s*(def\s+[a-zA-Z_]|import\s+[a-zA-Z_]|from\s+[a-zA-Z_]|elif\s+|print\()/m.test(code)) {
    return { status: 'invalid', label: 'Python Detected', hint: 'Mini-C requires C syntax: explicit types (int/bool/void), braces { }, and semicolons ;' };
  }
  if (/^\s*(const\s+[a-zA-Z_]|let\s+[a-zA-Z_]|function\s+[a-zA-Z_]|console\.log)/m.test(code)) {
    return { status: 'invalid', label: 'JavaScript Detected', hint: 'Mini-C requires typed functions (e.g. int main()) rather than JavaScript.' };
  }
  if (/^\s*<(!DOCTYPE|html|div|script)/i.test(code)) {
    return { status: 'invalid', label: 'HTML/XML Detected', hint: 'Expected Mini-C source code.' };
  }
  if (/#include\s*<iostream>|std::|public\s+class\s+|System\.out\.print/.test(code)) {
    return { status: 'invalid', label: 'C++/Java Detected', hint: 'CodeGuardian analyzes Mini-C (simplified C subset). #include and classes are not supported.' };
  }

  const hasFunction = /\b(int|bool|void)\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)\s*\{/.test(code);
  if (!hasFunction) {
    return { status: 'warn', label: 'Incomplete Mini-C', hint: 'Mini-C source must declare at least one function with a body, e.g. int main() { ... }' };
  }

  return { status: 'valid', label: 'Mini-C', hint: 'Syntax conforms to Mini-C grammar' };
}

function CodeEditor({ value, onChange, isCustom, highlightedLine, flashKey, editorShellRef, onSelectLine }) {
  const cleanSource = (value || '').replace(/\r/g, '');
  const allLines = cleanSource.split('\n');
  const lineCount = Math.max(1, allLines.length);
  const lines = Array.from({ length: lineCount }, (_, i) => i + 1);
  const textareaRef = useRef(null);
  const gutterRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const langCheck = detectLanguage(value);

  const handleScroll = (e) => {
    const currentScrollTop = e.target.scrollTop;
    setScrollTop(currentScrollTop);
    if (gutterRef.current) {
      gutterRef.current.scrollTop = currentScrollTop;
    }
  };

  useEffect(() => {
    if (highlightedLine && textareaRef.current) {
      const textarea = textareaRef.current;
      const clean = (textarea.value || value || '').replace(/\r/g, '');
      const codeLines = clean.split('\n');

      // 1. Calculate exact character offset for target line (1-indexed)
      let startChar = 0;
      for (let i = 0; i < highlightedLine - 1 && i < codeLines.length; i++) {
        startChar += codeLines[i].length + 1; // +1 for '\n'
      }
      const targetLineText = codeLines[highlightedLine - 1] ?? '';
      const endChar = startChar + targetLineText.length;

      // 2. Natively highlight text line and focus (prevent jumping parent scroll container)
      try {
        textarea.focus({ preventScroll: true });
        textarea.setSelectionRange(startChar, endChar);
      } catch (err) {}

      // 3. Scroll line smoothly to the center of the editor viewport
      const lineHeight = 20;
      const paddingTop = 10;
      const targetTop = (highlightedLine - 1) * lineHeight + paddingTop;
      const clientHeight = textarea.clientHeight;
      const targetScroll = Math.max(0, targetTop - clientHeight / 2 + lineHeight / 2);

      textarea.scrollTo({ top: targetScroll, behavior: 'smooth' });
      if (gutterRef.current) {
        gutterRef.current.scrollTop = targetScroll;
      }
      setScrollTop(targetScroll);
    }
  }, [highlightedLine, flashKey]);

  return (
    <div className="editor-shell" ref={editorShellRef}>
      <div className="editor-header">
        <div className="editor-header-left">
          <span className="editor-tab">
            <svg className="editor-tab-icon" viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
              <path d="M4 1.5A1.5 1.5 0 0 0 2.5 3v10A1.5 1.5 0 0 0 4 14.5h8a1.5 1.5 0 0 0 1.5-1.5V6.707a1 1 0 0 0-.293-.707L9.5 2.293A1 1 0 0 0 8.793 2H4z" />
            </svg>
            {isCustom ? 'Custom Mini-C *' : 'Mini-C Source'}
          </span>
          <span className={`lang-badge ${langCheck.status}`} title={langCheck.hint || 'Mini-C syntax verified'}>
            <span className="lang-dot"></span>
            {langCheck.label}
          </span>
        </div>
        <span className="editor-stats">{lineCount} lines · UTF-8</span>
      </div>
      {langCheck.status === 'invalid' && (
        <div className="editor-lang-warning">
          <svg className="warning-icon" viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
            <path d="M7.938 2.016A.13.13 0 0 0 7.82 2.08l-6.26 10.85c-.05.087-.02.2.067.25.026.015.056.023.086.023h12.528c.1 0 .18-.08.18-.18 0-.03-.01-.06-.023-.086L8.14 2.08a.13.13 0 0 0-.115-.064h-.087zM8 5c.55 0 1 .45 1 1v3a1 1 0 0 1-2 0V6c0-.55.45-1 1-1zm0 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
          </svg>
          <strong>Language Mismatch:</strong> {langCheck.hint}
        </div>
      )}
      <div className="editor-body">
        <div className="editor-gutter" ref={gutterRef}>
          {lines.map((num) => (
            <div
              key={num}
              className={`gutter-line ${highlightedLine === num ? 'flash-line' : ''}`}
              onClick={() => onSelectLine?.(num)}
              title={`Line ${num}`}
            >
              {num}
            </div>
          ))}
        </div>
        <div className="editor-textarea-wrapper">
          {highlightedLine && (
            <div
              className="editor-line-highlight-bar"
              style={{
                top: `${(highlightedLine - 1) * 20 + 10 - scrollTop}px`,
              }}
            />
          )}
          <textarea
            ref={textareaRef}
            spellCheck="false"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={handleScroll}
            className="editor-textarea"
            placeholder="// Type or paste custom Mini-C source code (e.g. int main() { ... })"
          />
        </div>
      </div>
    </div>
  );
}

const CUSTOM_TEMPLATE = {
  name: 'custom_template.c (Custom Template)',
  source: `int main() {
    int user_input;
    int sanitized_input;

    // 1. Ingest untrusted input (Taint Source)
    user_input = read_input();

    // 2. Try uncommenting the sanitizer below to fix the vulnerability:
    // sanitized_input = escape_sql(user_input);
    // execute_query(sanitized_input);

    // 3. Dangerous execution without sanitization (CWE-89 SQL_INJECTION)
    execute_query(user_input);

    return 0;
}
`,
};

const BLANK_TEMPLATE = {
  name: 'blank.c (Empty Editor)',
  source: `int main() {
    
    return 0;
}
`,
};

function RemediationModal({ vuln, source, onClose, onApplyFix }) {
  if (!vuln) return null;
  const patch = computeRemediationPatch(source, vuln);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-icon-badge">FIX</span>
            <div>
              <h3>Remediation Diff Preview</h3>
              <p className="modal-subtitle">
                Resolve <strong>{vuln.cwe} {vuln.type}</strong> at line {vuln.sinkInstruction.line}
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="remediation-summary-card">
            <div className="summary-item">
              <span className="summary-label">VULNERABILITY</span>
              <span className="summary-val">{vuln.cwe} · {vuln.type.replace(/_/g, ' ')}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">SENSITIVE SINK</span>
              <span className="summary-val"><code>{vuln.sinkInstruction.sinkFunction}()</code> (Line {vuln.sinkInstruction.line})</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">APPLIED SANITIZER</span>
              <span className="summary-val sanitizer-pill"><code>{patch?.sanitizer}()</code></span>
            </div>
          </div>

          <div className="diff-viewer">
            <div className="diff-header">
              <span>PROPOSED CODE CHANGES (UNIFIED DIFF)</span>
              <span>Line {vuln.sinkInstruction.line}</span>
            </div>
            <div className="diff-lines">
              {patch ? (
                <>
                  <div className="diff-line diff-del">
                    <span className="diff-marker">−</span>
                    <span className="diff-num">{patch.sinkLineNum}</span>
                    <code>{patch.originalLine}</code>
                  </div>
                  {patch.addedLines.map((line, idx) => (
                    <div key={idx} className="diff-line diff-add">
                      <span className="diff-marker">+</span>
                      <span className="diff-num">{patch.sinkLineNum + idx}</span>
                      <code>{line}</code>
                    </div>
                  ))}
                </>
              ) : (
                <div className="diff-error">Unable to compute automatic patch for this instruction.</div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary-apply"
            disabled={!patch}
            onClick={() => onApplyFix(patch.patchedSource)}
          >
            Apply Fix & Re-Analyze
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [engine, setEngine] = useState(null);
  const [examples, setExamples] = useState([]);
  const [name, setName] = useState('');
  const [source, setSource] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [block, setBlock] = useState(null);
  const [vuln, setVuln] = useState(null);

  // New interactive UI states
  const editorRef = useRef(null);
  const [highlightedLine, setHighlightedLine] = useState(null);
  const [flashKey, setFlashKey] = useState(0);
  const [focusTarget, setFocusTarget] = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(460);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [activeDiffVuln, setActiveDiffVuln] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('cg-theme') || 'dark');

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('cg-theme', next);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    Promise.all([fetch('/health').then((r) => r.json()), fetch('/api/examples').then((r) => r.json())])
      .then(([health, data]) => {
        setEngine(health);
        setExamples(data.examples);
        if (data.examples[0]) {
          setName(data.examples[0].name);
          setSource(data.examples[0].source);
        }
      })
      .catch(() => setError({ error: 'Analysis engine is not running. Start it with "npm start" in security_engine.', diagnostics: [] }));
  }, []);

  const pick = (value) => {
    setName(value);
    let newSource = '';
    if (value === CUSTOM_TEMPLATE.name) {
      newSource = CUSTOM_TEMPLATE.source;
    } else if (value === BLANK_TEMPLATE.name) {
      newSource = BLANK_TEMPLATE.source;
    } else {
      const found = examples.find((e) => e.name === value);
      if (found) newSource = found.source;
    }
    setSource(newSource);
    // Do not run analysis automatically; reset any existing findings until user clicks "Run Static Analysis"
    setResult(null);
    setBlock(null);
    setVuln(null);
    setHighlightedLine(null);
    setError(null);
  };

  async function run(overrideSource, overrideName, overrideEngine) {
    const codeToAnalyze = typeof overrideSource === 'string' ? overrideSource : source;
    const currentName = overrideName || name;
    const currentEngine = overrideEngine || engine;
    setBusy(true);
    setError(null);
    const unchanged = examples.find((e) => e.name === currentName && e.source === codeToAnalyze);
    const body = currentEngine?.frontendAvailable ? { source: codeToAnalyze } : unchanged && sampleFor(currentName) ? { cfg: sampleFor(currentName) } : null;
    if (!body) {
      setError({ error: 'The compiler is not built, so custom code cannot be compiled. Run an unchanged example, or build it with "make build".', diagnostics: [] });
      setBusy(false);
      return;
    }
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) setError(data);
      else {
        setResult(data);
        setBlock(null);
        setVuln(null);
      }
    } catch {
      setError({ error: 'Could not reach the analysis engine.', diagnostics: [] });
    }
    setBusy(false);
  }

  const jumpToLine = (line) => {
    if (!line) return;
    setHighlightedLine(line);
    setFlashKey((k) => k + 1);
    if (editorRef.current) {
      editorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const handleTracePath = (v) => {
    const nextVuln = vuln === v.id ? null : v.id;
    setVuln(nextVuln);
    if (nextVuln) {
      setFocusTarget({ type: 'path', blocks: v.taintPath, timestamp: Date.now() });
    }
  };

  const handleFocusBlock = (blockId) => {
    setBlock(blockId);
    setFocusTarget({ type: 'block', blockId, timestamp: Date.now() });
  };

  // Draggable sidebar resize handlers
  const handleResizeStart = (e) => {
    e.preventDefault();
    setResizing(true);
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (moveEvent) => {
      const newWidth = Math.min(Math.max(300, startWidth + (moveEvent.clientX - startX)), window.innerWidth - 320);
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      setResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Export handlers
  const handleExportSarif = () => {
    if (!result) return;
    const sarif = generateSarifReport({ audit: result.audit, source, name, cfg: result.cfg });
    downloadJsonFile(`${name.replace(/\.c$/, '') || 'codeguardian'}-report.sarif`, sarif);
    setExportMenuOpen(false);
  };

  const handleExportJson = () => {
    if (!result) return;
    downloadJsonFile(`${name.replace(/\.c$/, '') || 'codeguardian'}-audit.json`, result);
    setExportMenuOpen(false);
  };

  const handlePrintReport = () => {
    setExportMenuOpen(false);
    window.print();
  };

  const handleApplyFix = (newSource) => {
    setSource(newSource);
    setActiveDiffVuln(null);
    run(newSource);
  };

  const audit = result?.audit;
  const shown = result && block ? result.cfg.blocks.find((b) => b.id === block) : null;
  const findings = audit?.vulnerabilities ?? [];

  return (
    <div className={`app ${theme}-theme ${resizing ? 'is-resizing' : ''}`}>
      <header className="app-header">
        <div className="header-left">
          <h1>CodeGuardian</h1>
          <span className={`pill ${audit ? (findings.length ? 'bad' : 'good') : ''}`}>
            {audit ? (findings.length ? `${findings.length} vulnerabilit${findings.length > 1 ? 'ies' : 'y'}` : 'CLEAN') : 'ready'}
          </span>
          {engine && !engine.frontendAvailable && (
            <span className="pill warn">compiler not built: examples only</span>
          )}
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="btn-theme-toggle"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? (
              <>
                <svg className="theme-icon" viewBox="0 0 20 20" width="13" height="13" fill="currentColor">
                  <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
                </svg>
                <span>Light</span>
              </>
            ) : (
              <>
                <svg className="theme-icon" viewBox="0 0 20 20" width="13" height="13" fill="currentColor">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
                <span>Dark</span>
              </>
            )}
          </button>

          <button
            type="button"
            className={`btn-toggle-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? "Show source editor and findings (Expand)" : "Hide sidebar for full screen graph (Collapse)"}
          >
            {isSidebarCollapsed ? '▶▶ Show Source & Controls' : '◀◀ Full Graph'}
          </button>

          <div className="export-dropdown-wrapper">
            <button
              type="button"
              className="btn-export"
              disabled={!result}
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              title={!result ? 'Run static analysis first to export reports' : 'Export reports in SARIF, JSON or PDF format'}
            >
              Export Report ▾
            </button>
            {result && exportMenuOpen && (
              <div className="export-menu">
                <div className="export-item" onClick={handleExportSarif}>
                  <span className="export-pill">SARIF</span>
                  <div>
                    <strong>Download SARIF 2.1.0</strong>
                    <span className="export-desc">OASIS standard for GitHub Code Scanning</span>
                  </div>
                </div>
                <div className="export-item" onClick={handleExportJson}>
                  <span className="export-pill">JSON</span>
                  <div>
                    <strong>Download Full Audit JSON</strong>
                    <span className="export-desc">Complete CFG, lattice states & traces</span>
                  </div>
                </div>
                <div className="export-item" onClick={handlePrintReport}>
                  <span className="export-pill">PRINT</span>
                  <div>
                    <strong>Print / PDF Executive Summary</strong>
                    <span className="export-desc">Formatted printable security report</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        {!isSidebarCollapsed && (
          <section className="pane left-pane" style={{ width: `${sidebarWidth}px` }}>
            <div className="pane-header-title">
              <div className="pane-title-left">
                <svg className="pane-icon-svg" width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z" />
                </svg>
                <span className="pane-name">SOURCE CODE &amp; SECURITY FINDINGS</span>
              </div>
              <span className="pane-tag">LEFT PANEL</span>
            </div>

            <div className="bar">
              <select value={name} onChange={(e) => pick(e.target.value)}>
                <optgroup label="Custom / Blank Templates">
                  <option value={CUSTOM_TEMPLATE.name}>Custom Template (Mini-C)</option>
                  <option value={BLANK_TEMPLATE.name}>Blank Editor (Empty main)</option>
                </optgroup>
                <optgroup label="Bundled Examples">
                  {examples.map((e) => <option key={e.name} value={e.name}>{e.name}</option>)}
                </optgroup>
              </select>
              <button
                type="button"
                className="btn-run"
                onClick={() => run()}
                disabled={busy || !source}
              >
                {busy ? 'Analyzing…' : 'Run Static Analysis'}
              </button>
              <button
                type="button"
                className="btn-icon collapse-btn"
                onClick={() => setIsSidebarCollapsed(true)}
                title="Collapse sidebar into full graph canvas view"
              >
                ◀
              </button>
            </div>

            <CodeEditor
              value={source}
              onChange={(newVal) => {
                setSource(newVal);
                if (result) {
                  setResult(null);
                  setBlock(null);
                  setVuln(null);
                  setHighlightedLine(null);
                }
              }}
              isCustom={!examples.some((e) => e.name === name && e.source === source)}
              highlightedLine={highlightedLine}
              flashKey={flashKey}
              editorShellRef={editorRef}
              onSelectLine={jumpToLine}
            />

            <div className="findings-list-wrapper">
              {error && (
                <div className="error">
                  <strong>{error.error}</strong>
                  {error.diagnostics?.map((d, k) => (
                    <div key={k}>{d.line ? `line ${d.line}, col ${d.column}: ` : ''}{d.message}</div>
                  ))}
                </div>
              )}

              {findings.length > 0 && (
                <div className="findings-header">
                  <span className="findings-title">SECURITY VULNERABILITIES ({findings.length})</span>
                  <span className="findings-subtitle">Click card to trace attack path · Click line to jump</span>
                </div>
              )}

            {findings.map((v) => (
              <div
                key={v.id}
                className={`vuln-card ${vuln === v.id ? 'active' : ''}`}
                onClick={() => handleTracePath(v)}
              >
                <div className="vuln-top">
                  <div className="vuln-badges">
                    <span className="cwe-pill">{v.cwe}</span>
                    <span className="type-pill">{v.type.replace(/_/g, ' ')}</span>
                    <span className={`sev-pill ${v.severity.toLowerCase()}`}>{v.severity}</span>
                  </div>
                  <span className="vuln-id">#{v.id}</span>
                </div>

                <div className="vuln-flow">
                  <div className="flow-node source-node">
                    <span className="flow-dot source-dot"></span>
                    <div className="flow-details">
                      <span className="flow-role">TAINT SOURCE</span>
                      <span className="flow-target">
                        <code>{v.sourceInstruction.sourceFunction}()</code>
                        <span
                          className="loc-badge clickable"
                          onClick={(e) => { e.stopPropagation(); jumpToLine(v.sourceInstruction.line); }}
                          title="Click to jump and highlight line in editor"
                        >
                          Line {v.sourceInstruction.line} ↗
                        </span>
                      </span>
                      <span className="flow-sub">Assigned to: <code>{v.sourceInstruction.assignedTo || v.variable}</code></span>
                    </div>
                  </div>

                  <div className="flow-connector">
                    <span className="connector-arrow">▼</span>
                  </div>

                  <div className="flow-node sink-node">
                    <span className="flow-dot sink-dot"></span>
                    <div className="flow-details">
                      <span className="flow-role">COMPROMISED SINK</span>
                      <span className="flow-target">
                        <code>{v.sinkInstruction.sinkFunction}()</code>
                        <span
                          className="loc-badge clickable"
                          onClick={(e) => { e.stopPropagation(); jumpToLine(v.sinkInstruction.line); }}
                          title="Click to jump and highlight line in editor"
                        >
                          Line {v.sinkInstruction.line} ↗
                        </span>
                      </span>
                      <span className="flow-sub">Tainted Arg: <code className="tainted-highlight">{v.variable}</code></span>
                    </div>
                  </div>
                </div>

                <div className="vuln-trace">
                  <span className="trace-label">PROPAGATION PATH:</span>
                  <div className="trace-path">
                    {v.taintPath.map((blockId, idx) => (
                      <span key={idx} className="trace-step">
                        <span
                          className={`block-badge ${idx === v.taintPath.length - 1 ? 'is-sink' : idx === 0 ? 'is-source' : 'is-transit'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFocusBlock(blockId);
                          }}
                          title={`Focus block ${blockId} on graph`}
                        >
                          {blockId}
                        </span>
                        {idx < v.taintPath.length - 1 && <span className="trace-divider">→</span>}
                      </span>
                    ))}
                  </div>
                </div>

                {vuln === v.id ? (
                  <div className="active-glow-tag">
                    <span className="live-pulse"></span>
                    <span>Attack path highlighted & focused on graph (click to deselect)</span>
                  </div>
                ) : (
                  <div className="click-to-trace">
                    <span>Click to trace attack path on graph ➔</span>
                  </div>
                )}

                <div className="vuln-remediation">
                  <div className="remediation-title">
                    <div className="remediation-left">
                      <span className="remediation-tag">FIX</span>
                      <span>REMEDIATION</span>
                    </div>
                    <div className="remediation-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn-diff-preview"
                        onClick={() => setActiveDiffVuln(v)}
                        title="Preview code diff and apply fix automatically"
                      >
                        Preview Diff / Fix
                      </button>
                    </div>
                  </div>
                  <div className="remediation-desc">{v.remediation}</div>
                </div>
              </div>
            ))}
            </div>
          </section>
        )}

        {!isSidebarCollapsed && (
          <div
            className="panel-resizer"
            onMouseDown={handleResizeStart}
            title="Drag to resize panels"
          >
            <div className="resizer-line" />
          </div>
        )}

        <section className="pane right">
          <div className="graph-top-bar">
            <div className="graph-title-label">
              <svg className="graph-title-svg" width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1 11a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-4zm6-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7zm6-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V2z" />
              </svg>
              <span>CONTROL FLOW GRAPH (CFG) &amp; DATAFLOW ANALYSIS</span>
              <span className="pane-tag right-tag">RIGHT PANEL</span>
            </div>
            {result && (
              <div className="graph-meta-chip">
                {result.cfg.blocks.length} blocks · {findings.length} vuln{findings.length === 1 ? '' : 's'}
              </div>
            )}
          </div>

          {isSidebarCollapsed && (
            <button
              type="button"
              className="expand-floating-btn"
              onClick={() => setIsSidebarCollapsed(false)}
              title="Show source editor & findings"
            >
              &gt;
            </button>
          )}

          {result ? (
            <Graph
              cfg={result.cfg}
              audit={audit}
              pathBlocks={findings.find((v) => v.id === vuln)?.taintPath ?? []}
              focusTarget={focusTarget}
              onSelect={setBlock}
              resizeTrigger={sidebarWidth + (isSidebarCollapsed ? 1 : 0)}
              theme={theme}
            />
          ) : (
            <div className="empty">
              <div className="empty-state-card">
                <div className="empty-icon-wrap">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="10 8 16 12 10 16 10 8" />
                  </svg>
                </div>
                <h3>Ready for Static Analysis</h3>
                <p>Click <strong>Run Static Analysis</strong> to compute the Control Flow Graph and detect vulnerabilities.</p>
              </div>
            </div>
          )}

          <div className="glossary-bar">
            <span className="glossary-title">LATTICE GLOSSARY:</span>
            <div className="glossary-item" title="OUT[B] = ∅: Zero active tainted variables leaving block. Clean & safe.">
              <i className="g" /><strong>CLEAN</strong> <span className="glossary-detail">OUT = ∅</span>
            </div>
            <div className="glossary-item" title="Sanitizer called (sanitize, escape_sql, html_encode), neutralizing taint into KILL[B].">
              <i className="c" /><strong>SANITIZED</strong> <span className="glossary-detail">Cleansed (KILL)</span>
            </div>
            <div className="glossary-item" title="OUT[B] ≠ ∅: Active untrusted data in transit via source ingestion or arithmetic propagation.">
              <i className="a" /><strong>TAINTED</strong> <span className="glossary-detail">In Transit (GEN)</span>
            </div>
            <div className="glossary-item" title="Sink hit (execute_query, system_exec, render_output) with an unwashed tainted argument.">
              <i className="r" /><strong>VULNERABLE</strong> <span className="glossary-detail">Sink Triggered (CWE)</span>
            </div>
          </div>

          {shown && (
            <aside className="drawer">
              <button type="button" className="close" onClick={() => setBlock(null)} title="Close panel">×</button>
              <h3>
                {shown.id} · {shown.label}{' '}
                <span className={`pill ${audit.blockStatus[shown.id] === 'VULNERABLE' ? 'bad' : ''}`}>
                  {audit.blockStatus[shown.id]}
                </span>
              </h3>
              <table>
                <tbody>
                  {shown.instructions.map((i) => (
                    <tr key={i.index}>
                      <td>{i.index}</td>
                      <td><code>{formatInstruction(i)}</code></td>
                      <td>
                        <span
                          className="loc-badge clickable"
                          onClick={() => jumpToLine(i.line)}
                          title="Jump to line"
                        >
                          L{i.line}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {['in', 'gen', 'kill', 'out'].map((k) => (
                <Chips key={k} title={k.toUpperCase()} items={audit.latticeStates[shown.id][k]} />
              ))}
            </aside>
          )}
        </section>
      </main>

      {activeDiffVuln && (
        <RemediationModal
          vuln={activeDiffVuln}
          source={source}
          onClose={() => setActiveDiffVuln(null)}
          onApplyFix={handleApplyFix}
        />
      )}
    </div>
  );
}
