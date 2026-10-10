# Live State Ledger & Synchronization Memory — CodeGuardian
**Real-Time Status & Engineering Checkpoints**

---

## 1. Project Health & Sprint Metadata

- **Current State**: Phase 4 Complete (Security Engine, API Gateway & Dashboard) — Phase 5 (Verification & Packaging) next
- **Repository Health**: 🟢 GREEN — Compiler core, taint engine, HTTP gateway and dashboard integrated; all test suites passing
- **Active Sprint**: Phase 5 (Verification, Benchmarking & Demo Packaging)
- **Git Tracking**: Branch `main` tracking `origin/main` (`https://github.com/MayurRajeshKeni/codeguardian.git`)
- **Last Sync Timestamp**: 2026-10-10
- **Team Size**: Exactly 2 Members

---

## 2. Live Task Board (Split by Member)

### 👤 Member 1: Compiler Core & Front-End / Middle-End Lowering
> **Domain**: Flex Lexer, Bison Parser, AST Synthesis, SDT to TAC, Leader Partitioning, CFG Generation $\to$ `CFG.json`

#### 🟢 Completed
- [x] **[Phase 1]** Define deterministic Mini-C grammar bounds (no pointers, no dynamic heap, strict scalar types)
- [x] **[Phase 1]** Review & freeze `AST.json` and `CFG.json` data contracts with Member 2
- [x] **[Phase 1]** Initial `.gitignore` setup for compiler build artifacts (`lex.yy.c`, `parser.tab.*`, `*.o`, `*.exe`)
- [x] **[Phase 1]** Setup C Toolchain (`gcc` 15.2, `flex` 2.6.4, `bison` 3.8.2, GNU `make` 4.4.1, CMake) with portable root & core Makefiles
- [x] **[Phase 1]** Formalize rigorous BNF grammar specification for Mini-C in `compiler_core/BNF_Grammar.md`
- [x] **[Phase 1]** Author `scanner.l` token definitions with line/column tracking & structured error diagnostics
- [x] **[Phase 1]** Author initial LALR(1) `parser.y` eliminating all shift/reduce conflicts (0 conflicts)
- [x] **[Phase 1]** Verify zero lexical collisions across keywords, identifiers, and multi-char operators
- [x] **[Phase 1]** Build CLI test harness (`codeguardian-frontend`) with `--lex` and `--parse` flags
- [x] **[Phase 1]** Create automated test runner (`scripts/run_tests.ps1`) and unit tests (6/6 tests passing)
- [x] **[Phase 1]** Author standard test cases in `examples/` (`clean_flow.c`, `sql_injection.c`, `command_injection.c`, `complex_loop.c`)
- [x] **[Phase 1]** Establish `mock_CFG.json` and `mock_Audit.json` satisfying Milestone Acceptance Gate 1

- [x] **[Phase 2]** Implement `ast.h` / `ast.c` (In-memory AST node allocators, node types, and AST print/JSON routines)
- [x] **[Phase 2]** Implement `tac.h` / `tac.c` (Syntax-Directed Translation lowering AST to linear TAC quadruples)
- [x] **[Phase 2]** Implement Dragon Book 3-rule leader partitioning algorithm (`cfg.c`)
- [x] **[Phase 2]** Implement `cfg.h` / `cfg.c` (Form basic blocks and wire true/false/unconditional directed edges)
- [x] **[Phase 2]** Implement `json_emit.h` / `json_emit.c` (Serialize basic blocks and edges into valid `CFG.json`)
- [x] **[Phase 2]** Verify Milestone Acceptance Gate 2 (`codeguardian-frontend` compiles `clean_flow.c`, `sql_injection.c`, `command_injection.c`, `complex_loop.c` to valid `CFG.json`)

#### 🟡 In Progress / Next Up
- [ ] **[Phase 3]** End-to-End Pipeline Integration with Member 2 Solver (`codeguardian-frontend code.c | codeguardian-engine` $\to$ `Audit.json`)

#### ⚪ Backlog
- [ ] **[Phase 3]** Integration acceptance tests across all CWE scenarios
- [ ] **[Phase 5]** End-to-end performance benchmarking (< 300ms target)

---

### 👤 Member 2: Security Intelligence, Data-Flow Math Engine & UI
> **Domain**: Security Rules, Kildall Worklist Lattice Solver, Audit Synthesis, React + Cytoscape.js Dashboard

#### 🟢 Completed
- [x] **[Phase 1]** Define security threat model (Sources, Sanitizers, Sinks)
- [x] **[Phase 1]** Specify mathematical transfer equations ($IN$, $OUT$, $GEN$, $KILL$)
- [x] **[Phase 1]** Freeze `Audit.json` schema and create initial sample fixture
- [x] **[Phase 1]** Formal JSON Schemas (`cfg.schema.json`, `audit.schema.json`), `validate.js` validator and fixtures (`mock_CFG.json`, `mock_CFG_loop.json`, `mock_Audit.json`) satisfying Milestone Acceptance Gate 1

- [x] **[Phase 2]** Setup `security_engine/` environment and author `security_rules.json` (CWE-89, CWE-78, CWE-79)
- [x] **[Phase 2]** Implement block-level $GEN$ and $KILL$ set extractors from TAC instructions
- [x] **[Phase 2]** Implement Kildall monotone worklist fixpoint solver over powerset lattice $(\mathcal{P}(V), \subseteq)$:
  $$IN[B] = \bigcup_{P \in \text{Pred}[B]} OUT[P]$$
  $$OUT[B] = GEN[B] \cup (IN[B] \setminus KILL[B])$$
- [x] **[Phase 2]** Implement source-to-sink vulnerability path trace extractor
- [x] **[Phase 2]** Build solver verification unit tests (`solver.test.js` against sample CFG fixtures and real compiler output)

- [x] **[Phase 3]** HTTP analysis gateway (`POST /api/analyze`, `GET /api/examples`, `GET /health`) with compiler-frontend bridge (`server.js`, `compile.js`)
- [x] **[Phase 3]** Command-line engine (`src/cli.js`): `codeguardian-frontend code.c | node src/cli.js` $\to$ `Audit.json`

- [x] **[Phase 4]** Initialize Vite + React project in `dashboard/` with dark terminal styling tokens
- [x] **[Phase 4]** Implement dual-pane layout (code pane on left, Cytoscape canvas on right)
- [x] **[Phase 4]** Integrate Cytoscape.js with `dagre` layout and color states (Green = Clean, Cyan = Sanitized, Amber = Tainted, Red = Vulnerable)
- [x] **[Phase 4]** Build interactive Block Detail Drawer displaying full TAC table and $IN/OUT/GEN/KILL$ sets
- [x] **[Phase 4]** Build Vulnerability Trace Bar highlighting active attack paths on the graph (click a finding card or a vulnerable block)

#### 🟡 In Progress / Next Up
- [ ] **[Phase 4]** Replace the plain-text code pane with a Monaco/CodeMirror editor with Mini-C syntax highlighting (Phases.md Phase 4 spec)

#### ⚪ Backlog
- _None. Remaining Phase 5 work is tracked under Shared / Joint Milestones._

---

### 🤝 Shared / Joint Milestones

#### 🟢 Completed
- [x] **[Phase 1]** System Requirements & Syllabus Mapping ([PRD.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/PRD.md))
- [x] **[Phase 1]** System Architecture & Data Contracts ([Architecture.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/Architecture.md))
- [x] **[Phase 1]** Technical Guardrails & Rules ([Rules.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/Rules.md))
- [x] **[Phase 1]** 5-Phase Roadmap ([Phases.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/Phases.md))
- [x] **[Phase 1]** UI & Visual Styling Spec ([Design.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/Design.md))
- [x] **[Phase 1]** Remote Git Repository Linked & Pushed to GitHub
- [x] **[Phase 3]** End-to-End Pipeline Integration (`codeguardian-frontend code.c | codeguardian-engine` $\to$ `Audit.json`, also served over HTTP)
- [x] **[Phase 3]** Integration acceptance test suite (`clean_flow.c`, `sql_injection.c`, `command_injection.c`, `complex_loop.c`) in `security_engine/tests/pipeline.test.js` and `server.test.js`

#### ⚪ Backlog
- [ ] **[Phase 5]** End-to-end benchmark timing suite (< 300ms execution target)
- [ ] **[Phase 5]** BCSE307L / BCSE307P Academic Demo & Final Documentation Package

---

## 3. Synchronization Checkpoints & Data Contract Status

### 3.1 Contract Lock Status
- **`CFG.json` (Member 1 $\to$ Member 2)**: 🔒 **LOCKED** ([Architecture.md §3.2](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/Architecture.md#32-cfgjson-control-flow-graph-contract)). Member 2 builds against this contract independently.
  - Clarification found during integration: an instruction's `line` may be `0` for compiler-synthesized instructions (e.g. the empty `NOP` in a merge block).
- **`Audit.json` (Member 2 $\to$ Dashboard)**: 🔒 **LOCKED** ([Architecture.md §3.3](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/Architecture.md#33-auditjson-security-findings--taint-lattice-state)).
- **Transfer Functions (Mathematical Rigor)**: 🔒 **LOCKED**.
  $$IN[B] = \bigcup_{P \in \text{Pred}[B]} OUT[P]$$
  $$OUT[B] = GEN[B] \cup (IN[B] \setminus KILL[B])$$

---

## 4. Current Blockers & Active Risk Mitigations

| ID | Description | Impact | Mitigation Strategy | Owner |
| :--- | :--- | :--- | :--- | :--- |
| **RISK-01** | Shift/Reduce conflicts in grammar during dangling-else resolution. | Low | Use standard Bison precedence declarations: `%nonassoc LOWER_THAN_ELSE` and `%nonassoc ELSE`. | Member 1 |
| **RISK-02** | Cyclic CFG loops causing infinite fixpoint worklist iteration. | None | Monotonicity guarantees termination because variable sets over finite variables $V$ strictly accumulate/shrink. | Member 2 |
| **RISK-03** | JSON formatting divergence between C backend and JS parser. | Low | Schema validation step during integration test runs. | Joint |
