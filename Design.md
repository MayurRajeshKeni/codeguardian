# UI/UX & Visual Design Specification — CodeGuardian
**Dual-Pane Static Security Analysis Dashboard**

---

## 1. Design Philosophy & Aesthetic Identity

CodeGuardian's visual interface bridges high-performance compiler tooling with an elite cybersecurity command center. The design language prioritizes:
- **High Information Density**: Compact, legible telemetry displaying compiler structures without visual clutter.
- **Terminal & Dark Engineering Aesthetic**: Deep obsidian backgrounds (`#0B0F17`), subtle borders (`#1E293B`), vivid status accents (Emerald, Amber, Crimson).
- **Mathematical Clarity**: Data-flow lattice states ($IN$, $OUT$, $GEN$, $KILL$) displayed in monospace tabular cards.
- **Dynamic Graph Feedback**: Real-time graph node state transitions using Cytoscape.js directed visual layout.

---

## 2. Color Palette & Design Tokens

### 2.1 CSS Custom Properties
```css
:root {
  /* Surface & Background */
  --bg-canvas: #07090E;           /* Deepest background */
  --bg-surface: #0D1117;          /* Card & panel surfaces */
  --bg-elevated: #161B22;         /* Hover states & dropdowns */
  --bg-editor: #0A0D14;           /* Code editor background */
  
  /* Borders & Dividers */
  --border-subtle: #21262D;       /* Standard panel borders */
  --border-focus: #388BFD;        /* Focused elements */
  
  /* Typography */
  --text-primary: #F0F6FC;        /* High-contrast headings & code */
  --text-secondary: #8B949E;      /* Labels & metadata */
  --text-muted: #484F58;          /* Watermarks & disabled states */
  
  /* Security & Lattice Accents */
  --state-clean: #238636;         /* Emerald: Untainted / Safe */
  --state-clean-glow: rgba(35, 134, 54, 0.25);
  
  --state-tainted: #D29922;       /* Amber: Tainted in transit */
  --state-tainted-glow: rgba(210, 153, 34, 0.25);
  
  --state-vulnerable: #DA3633;    /* Crimson: Exploitable sink triggered */
  --state-vulnerable-glow: rgba(218, 54, 51, 0.35);
  
  --state-neutral: #58A6FF;       /* Cyan/Blue: Control flow & jumps */
}
```

### 2.2 Typography
- **Code & Intermediate Representations**: `JetBrains Mono`, `Fira Code`, or `ui-monospace`, monospace (weights: 400, 600).
- **Interface & Metrics**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, sans-serif (weights: 400, 500, 600, 700).

---

## 3. Layout Architecture: Dual-Pane Dashboard

The layout occupies 100vw $\times$ 100vh with no global page scroll:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ HEADER: CodeGuardian Logo | Sample Dropdown | [Run Static Analysis ⚡] | Status  │
├─────────────────────────────────────────┬────────────────────────────────────────┤
│ LEFT PANE (45% Width):                  │ RIGHT PANE (55% Width):                │
│ ┌─────────────────────────────────────┐ │ ┌────────────────────────────────────┐ │
│ │ Mini-C Source Code Editor           │ │ │ Cytoscape.js CFG Canvas            │ │
│ │ (Monaco/CodeMirror)                 │ │ │ (Zoom, Pan, Fit, Center Controls)  │ │
│ │                                     │ │ │                                    │ │
│ │  int main() {                       │ │ │        [ B0: Entry (Amber) ]       │ │
│ │    int x = read_input();            │ │ │              /        \            │ │
│ │    if (x > 10) {                    │ │ │       (True)/          \(False)    │ │
│ │      x = sanitize(x);               │ │ │      [B1: Safe]      [B2: Taint]   │ │
│ │    }                                │ │ │             \          /           │ │
│ │    execute_query(x);                │ │ │              v        v            │ │
│ │  }                                  │ │ │       [ B3: Sink (Crimson) ]       │ │
│ └─────────────────────────────────────┘ │ └────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │ ┌────────────────────────────────────┐ │
│ │ Compiler Console / Diagnostics Output│ │ Block Drawer / Lattice State Card   │ │
│ │ (Tokens, AST summary, TAC stream)   │ │ (IN, OUT, GEN, KILL, Remediation)    │ │
│ └─────────────────────────────────────┘ │ └────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Cytoscape.js Canvas Rules & Node States

### 4.1 Node Visual Definitions
Each basic block in `CFG.json` renders as a structured composite node:
- **Dimensions**: Width: 220px, Height: variable based on instruction count (min 90px).
- **Shape**: Rounded rectangle (`round-rectangle`, border-radius: 8px).
- **Node Content**:
  - **Header**: Block ID (`B0`, `B1`, etc.) + Block Role (`Entry`, `Branch`, `Sink`).
  - **Body**: First 2–3 TAC instructions formatted in monospace.
  - **Footer Badge**: Current Security State (`CLEAN`, `TAINTED`, `VULNERABLE`).

### 4.2 State Styling Rules
1. **Neutral / Unanalyzed**:
   - `background-color`: `#161B22`
   - `border-color`: `#30363D`
   - `border-width`: 2px
2. **Clean / Sanitized (`CLEAN`)**:
   - `background-color`: `#0D2214`
   - `border-color`: `#238636`
   - `border-width`: 2px
   - `box-shadow`: subtle green glow
3. **Tainted In Transit (`TAINTED`)**:
   - `background-color`: `#261C08`
   - `border-color`: `#D29922`
   - `border-width`: 2px
   - `box-shadow`: subtle amber glow
4. **Vulnerable Sink Triggered (`VULNERABLE`)**:
   - `background-color`: `#2A0E11`
   - `border-color`: `#DA3633`
   - `border-width`: 3px
   - `box-shadow`: pulsing crimson glow

### 4.3 Edge Styling Rules
- **Edge Shape**: Directed bezier curves (`taxi` or `bezier`).
- **Arrow Head**: Filled triangle (`triangle`), scale: 1.2.
- **Unconditional Edge**: `#388BFD`, solid line, width 2px.
- **True Branch Edge**: `#238636`, dashed line with label `"true"`.
- **False Branch Edge**: `#D29922`, dashed line with label `"false"`.
- **Active Vulnerability Path**: When a vulnerability is selected, all edges forming the trace path from Source to Sink are highlighted in **pulsing Crimson (`#DA3633`)** with width 4px.

### 4.4 Graph Layout Engine
- **Layout Algorithm**: `dagre` (hierarchical directed top-to-bottom layout).
  - `rankDir`: `'TB'` (Top to Bottom).
  - `nodeSep`: 60 (horizontal spacing between nodes).
  - `rankSep`: 80 (vertical spacing between ranks).
  - `animate`: `true` (300ms cubic-bezier transition upon layout recalculation).

---

## 5. Interactive Components & Drawers

### 5.1 Block Detail Drawer
Triggered on node click. Opens smoothly on the right overlay or bottom drawer:
- **Basic Block Header**: e.g., `Block B3 (Merge & Sink)`
- **Full TAC Quadruple Table**:
  | Index | Op | Arg1 | Arg2 | Result | Line |
  | :--- | :--- | :--- | :--- | :--- | :--- |
  | 7 | `CALL` | `execute_query` | `x` | `null` | 9 |
- **Lattice Fixed Point Values**:
  - $IN[B_3] = \{x, t_0\}$ (Highlighted in red if tainted)
  - $GEN[B_3] = \emptyset$
  - $KILL[B_3] = \emptyset$
  - $OUT[B_3] = \{x, t_0\}$

### 5.2 Vulnerability Trace Bar
When vulnerabilities are detected:
- Displays a prominent alert badge: `CRITICAL: SQL Injection (CWE-89) in Block B3`.
- Clicking "Highlight Path" animates the flow:
  `Source: B0 (read_input) ──> B2 (False Branch) ──> B3 (execute_query)`
- Provides exact line numbers and contextual remediation guidance.
