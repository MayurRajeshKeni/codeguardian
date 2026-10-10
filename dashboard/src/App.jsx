import { useEffect, useState } from 'react';
import Graph, { formatInstruction } from './Graph.jsx';

const samples = import.meta.glob('./samples/*.json', { eager: true, import: 'default' });
const sampleFor = (name) => samples[`./samples/${name.replace(/\.c$/, '')}.json`];

const Chips = ({ title, items }) => (
  <div className="sets"><span className="set-title">{title}</span>
    {items.length ? items.map((v) => <code key={v} className="chip">{v}</code>) : <em>∅</em>}
  </div>
);

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

  useEffect(() => {
    Promise.all([fetch('/health').then((r) => r.json()), fetch('/api/examples').then((r) => r.json())])
      .then(([health, data]) => {
        setEngine(health);
        setExamples(data.examples);
        if (data.examples[0]) { setName(data.examples[0].name); setSource(data.examples[0].source); }
      })
      .catch(() => setError({ error: 'Analysis engine is not running. Start it with "npm start" in security_engine.', diagnostics: [] }));
  }, []);

  const pick = (value) => {
    setName(value);
    setSource(examples.find((e) => e.name === value).source);
  };

  async function run() {
    setBusy(true); setError(null);
    const unchanged = examples.find((e) => e.name === name && e.source === source);
    const body = engine?.frontendAvailable ? { source } : unchanged && sampleFor(name) ? { cfg: sampleFor(name) } : null;
    if (!body) {
      setError({ error: 'The compiler is not built, so custom code cannot be compiled. Run an unchanged example, or build it with "make build".', diagnostics: [] });
      setBusy(false);
      return;
    }
    try {
      const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) setError(data);
      else { setResult(data); setBlock(null); setVuln(null); }
    } catch {
      setError({ error: 'Could not reach the analysis engine.', diagnostics: [] });
    }
    setBusy(false);
  }

  const audit = result?.audit;
  const shown = result && block ? result.cfg.blocks.find((b) => b.id === block) : null;
  const findings = audit?.vulnerabilities ?? [];

  return (
    <div className="app">
      <header>
        <h1>CodeGuardian</h1>
        <span className={`pill ${audit ? (findings.length ? 'bad' : 'good') : ''}`}>
          {audit ? (findings.length ? `${findings.length} vulnerabilit${findings.length > 1 ? 'ies' : 'y'}` : 'CLEAN') : 'ready'}
        </span>
        {engine && !engine.frontendAvailable && <span className="pill warn">compiler not built: examples only</span>}
      </header>
      <main>
        <section className="pane">
          <div className="bar">
            <select value={name} onChange={(e) => pick(e.target.value)}>
              {examples.map((e) => <option key={e.name}>{e.name}</option>)}
            </select>
            <button onClick={run} disabled={busy || !source}>{busy ? 'Analyzing…' : 'Run Static Analysis'}</button>
          </div>
          <textarea spellCheck="false" value={source} onChange={(e) => setSource(e.target.value)} />
          {error && (
            <div className="error">
              <strong>{error.error}</strong>
              {error.diagnostics?.map((d, k) => <div key={k}>{d.line ? `line ${d.line}, col ${d.column}: ` : ''}{d.message}</div>)}
            </div>
          )}
          {findings.length > 0 && <div className="hint">Click a finding to highlight its path on the graph.</div>}
          {findings.map((v) => (
            <div key={v.id} className={`vuln ${vuln === v.id ? 'active' : ''}`} onClick={() => setVuln(vuln === v.id ? null : v.id)}>
              <div><b>{v.cwe}</b> {v.type} <span className="sev">{v.severity}</span></div>
              <div>source <code>{v.sourceInstruction.sourceFunction}()</code> line {v.sourceInstruction.line} → sink <code>{v.sinkInstruction.sinkFunction}({v.variable})</code> line {v.sinkInstruction.line}</div>
              <div className="trace">{v.taintPath.join(' → ')}</div>
              {vuln === v.id && <div className="on">▶ Path highlighted on the graph (click again to clear)</div>}
              <div className="fix">{v.remediation}</div>
            </div>
          ))}
        </section>
        <section className="pane right">
          {result ? <Graph cfg={result.cfg} audit={audit} pathBlocks={findings.find((v) => v.id === vuln)?.taintPath ?? []} onSelect={setBlock} /> : <div className="empty">Run the analysis to see the control flow graph.</div>}
          <div className="legend"><i className="g" />clean <i className="c" />sanitized <i className="a" />tainted <i className="r" />vulnerable</div>
          {shown && (
            <aside className="drawer">
              <button className="close" onClick={() => setBlock(null)}>×</button>
              <h3>{shown.id} · {shown.label} <span className={`pill ${audit.blockStatus[shown.id] === 'VULNERABLE' ? 'bad' : ''}`}>{audit.blockStatus[shown.id]}</span></h3>
              <table><tbody>{shown.instructions.map((i) => <tr key={i.index}><td>{i.index}</td><td><code>{formatInstruction(i)}</code></td><td>L{i.line}</td></tr>)}</tbody></table>
              {['in', 'gen', 'kill', 'out'].map((k) => <Chips key={k} title={k.toUpperCase()} items={audit.latticeStates[shown.id][k]} />)}
            </aside>
          )}
        </section>
      </main>
    </div>
  );
}
