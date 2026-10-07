# Phase Roadmap & Milestones — CodeGuardian

---

## 1. Overview & Phased Execution Model

The development of CodeGuardian is partitioned into **Five Distinct Phases**. To ensure uninterrupted velocity, Member 1 and Member 2 work in lockstep against frozen data contracts (`CFG.json` and `Audit.json`), enabling concurrent frontend compiler development and backend/UI development.

---

## 2. Phase Breakdown

### Phase 1: Environment Setup, Grammar Specification & Data Contracts
**Target Completion**: Day 1–2
- **Member 1 (Compiler Core)**:
  - Setup C toolchain (`gcc`/`clang`, `flex`, `bison`, `make`/`cmake`).
  - Formalize BNF grammar for Mini-C (`int`, `bool`, expressions, `if-else`, `while`, calls).
  - Draft `scanner.l` token definitions and verify zero lexical collisions.
- **Member 2 (Security & Dashboard)**:
  - Setup Node.js/Python backend and Vite + React UI scaffolding.
  - Formalize JSON schemas for `CFG.json` and `Audit.json`.
  - Create static mock fixtures (`mock_CFG.json`, `mock_Audit.json`) to decouple UI and solver development.
- **Milestone Acceptance Gate 1**:
  - `mock_CFG.json` validates against the schema defined in [Architecture.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/Architecture.md).
  - Both team members verify local build environments.

---

### Phase 2: Core Subsystem Development (Independent Tracks)
**Target Completion**: Day 3–5
- **Member 1 (Frontend & Middle-End Lowering)**:
  - **Lexer & Parser**: Complete `scanner.l` and `parser.y`. Eliminate shift/reduce conflicts using operator precedence declarations (`%left`, `%right`).
  - **AST Construction**: Implement `ast.c` / `ast.h` allocating tree nodes for declarations, assignments, binary ops, branches, and loops.
  - **TAC Lowering (SDT)**: Implement syntax-directed translation traversing AST to emit linear quadruples with temporary numbering ($t_0, t_1, \dots$).
  - **Leader Partitioning**: Implement leader identification:
    1. First instruction is a leader.
    2. Any target of a conditional or unconditional jump is a leader.
    3. Any instruction immediately following a jump is a leader.
  - **CFG Synthesizer**: Form basic blocks and connect directed predecessor/successor edges.
  - **JSON Serializer**: Implement `json_emit.c` to serialize basic blocks and edges into `CFG.json`.
- **Member 2 (Data-Flow Math Engine & Solver)**:
  - **Security Rules Ingestion**: Load `security_rules.json` (sources, sanitizers, sinks).
  - **GEN/KILL Extraction**: Implement block-level variable set extraction for all instructions in basic blocks.
  - **Kildall Fixpoint Solver**: Implement the monotone worklist solver:
    $$IN[B] = \bigcup_{P \in \text{Pred}[B]} OUT[P]$$
    $$OUT[B] = GEN[B] \cup (IN[B] \setminus KILL[B])$$
  - **Taint Auditor**: Flag any sink instruction in block $B$ where the evaluated sink argument $\in IN[B]$ (or tainted within block).
  - Verify convergence on `mock_CFG.json` with branch and loop structures.
- **Milestone Acceptance Gate 2**:
  - Member 1's CLI compiles `examples/clean_flow.c` and outputs valid `CFG.json`.
  - Member 2's solver ingests the emitted `CFG.json` and terminates at fixpoint with correct IN/OUT bitsets.

---

### Phase 3: Integration & End-to-End Pipeline
**Target Completion**: Day 6–7
- **Joint Integration**:
  - Connect `codeguardian-frontend` output directly into Member 2's analysis service via file stream or lightweight API gateway (`POST /api/analyze`).
  - Verify test cases:
    1. `clean_flow.c`: Source $\to$ Sanitize $\to$ Sink (0 vulnerabilities detected, status: CLEAN).
    2. `sql_injection.c`: Direct unsanitized flow to `execute_query` (CWE-89 flagged, status: VULNERABLE).
    3. `command_injection.c`: Branching flow where one path leaves variable unsanitized before `system_exec` (CWE-78 flagged).
    4. `complex_loop.c`: Taint accumulated across loop iterations, confirming fixpoint termination.
- **Milestone Acceptance Gate 3**:
  - CLI pipeline `codeguardian-frontend code.c | codeguardian-engine` emits valid `Audit.json` with full source-to-sink vulnerability trace paths.

---

### Phase 4: Interactive Dashboard & Cytoscape.js Visualization
**Target Completion**: Day 8–9
- **Member 2 (UI Dashboard)**:
  - **Layout & Aesthetic**: Dark cybersecurity terminal theme (JetBrains Mono / Inter, deep obsidian backgrounds, emerald accents for clean, crimson for vulnerable).
  - **Left Pane (Editor)**: Monaco or CodeMirror editor with Mini-C syntax highlighting and pre-loaded test case selector.
  - **Right Pane (Cytoscape Graph)**:
    - Directed acyclic/cyclic layout using `dagre` or `klay`.
    - Nodes render as rounded rectangles containing Block IDs (`B0`, `B1`, etc.) and instruction previews.
    - Node color scheme: Emerald Green (Clean), Amber (Tainted in transit), Crimson Red (Vulnerability Sink Triggered).
    - Edges render with directional arrows; True/False branches labeled.
  - **Interactive Drawer**: Clicking a block displays:
    - Complete TAC quadruple listing for that block.
    - Real-time data-flow sets ($IN$, $GEN$, $KILL$, $OUT$).
    - Remediation advice for flagged vulnerabilities.
- **Member 1 (Verification Support)**:
  - Assist in edge case test bench construction and timing benchmarks.
- **Milestone Acceptance Gate 4**:
  - User can click "Run Static Analysis" in dashboard, observe CFG render in Cytoscape, inspect blocks, and trace the red vulnerable path dynamically.

---

### Phase 5: Verification, Benchmarking & Course Presentation Packaging
**Target Completion**: Day 10
- **Both Members**:
  - Run full benchmark suite across all test files.
  - Compile final demonstration presentation linking theoretical syllabus concepts (LR parsing, SDT, Leaders, Kildall LFP) to CodeGuardian's implementation.
  - Finalize repository documentation, ensuring reproducible one-step build scripts (`make build`, `npm run start`).
- **Milestone Acceptance Gate 5**:
  - Live, flawless demonstration of Mini-C source compilation to CFG, fixpoint taint propagation, and Cytoscape.js visual graph rendering for BCSE307L / BCSE307P review.
