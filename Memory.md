# Live State Ledger & Synchronization Memory — CodeGuardian
**Real-Time Status & Engineering Checkpoints**

---

## 1. Project Health & Sprint Metadata

- **Current State**: Phase 1 Complete (Governance & Architectural Baseline Locked)
- **Repository Health**: 🟢 GREEN — Architecture, Data Contracts & Git Remote Linked
- **Active Sprint**: Sprint 1 (Phase 2 Core Implementation)
- **Git Tracking**: Branch `main` tracking `origin/main` (`https://github.com/MayurRajeshKeni/codeguardian.git`)
- **Last Sync Timestamp**: 2026-10-06T23:51:00+05:30
- **Team Size**: Exactly 2 Members

---

## 2. Live Task Board (Split by Member)

### 👤 Member 1: Compiler Core & Front-End / Middle-End Lowering
> **Domain**: Flex Lexer, Bison Parser, AST Synthesis, SDT to TAC, Leader Partitioning, CFG Generation $\to$ `CFG.json`

#### 🟢 Completed
- [x] **[Phase 1]** Define deterministic Mini-C grammar bounds (no pointers, no dynamic heap, strict scalar types)
- [x] **[Phase 1]** Review & freeze `AST.json` and `CFG.json` data contracts with Member 2
- [x] **[Phase 1]** Initial `.gitignore` setup for compiler build artifacts (`lex.yy.c`, `parser.tab.*`, `*.o`, `*.exe`)

#### 🟡 In Progress / Next Up
- [ ] **[Phase 2]** Author `compiler_core/src/scanner.l` (Flex token specs for keywords, identifiers, literals, operators)
- [ ] **[Phase 2]** Author `compiler_core/src/parser.y` (Bison LALR(1) grammar; resolve dangling-else with `%nonassoc`)
- [ ] **[Phase 2]** Implement `ast.h` / `ast.c` (In-memory AST node allocators, node types, and AST print/JSON routines)

#### ⚪ Backlog
- [ ] **[Phase 2]** Implement `tac.h` / `tac.c` (Syntax-Directed Translation lowering AST to linear TAC quadruples)
- [ ] **[Phase 2]** Implement Dragon Book 3-rule leader partitioning algorithm
- [ ] **[Phase 2]** Implement `cfg.h` / `cfg.c` (Group basic blocks and wire true/false/unconditional directed edges)
- [ ] **[Phase 2]** Implement `json_emit.c` (Serialize basic blocks and edges into valid `CFG.json`)
- [ ] **[Phase 2]** Unit test suite in `compiler_core/tests/` (`test_simple.c`, `test_branch.c`, `test_loop.c`)

---

### 👤 Member 2: Security Intelligence, Data-Flow Math Engine & UI
> **Domain**: Security Rules, Kildall Worklist Lattice Solver, Audit Synthesis, React + Cytoscape.js Dashboard

#### 🟢 Completed
- [x] **[Phase 1]** Define security threat model (Sources, Sanitizers, Sinks)
- [x] **[Phase 1]** Specify mathematical transfer equations ($IN$, $OUT$, $GEN$, $KILL$)
- [x] **[Phase 1]** Freeze `Audit.json` schema and create initial sample fixture

#### 🟡 In Progress / Next Up
- [ ] **[Phase 2]** Setup `security_engine/` environment and author `security_rules.json` (CWE-89, CWE-78, CWE-79)
- [ ] **[Phase 2]** Implement block-level $GEN$ and $KILL$ set extractors from TAC instructions
- [ ] **[Phase 2]** Implement Kildall monotone worklist fixpoint solver over powerset lattice $(\mathcal{P}(V), \subseteq)$:
  $$IN[B] = \bigcup_{P \in \text{Pred}[B]} OUT[P]$$
  $$OUT[B] = GEN[B] \cup (IN[B] \setminus KILL[B])$$

#### ⚪ Backlog
- [ ] **[Phase 2]** Implement source-to-sink vulnerability path trace extractor
- [ ] **[Phase 2]** Build solver verification unit tests (`solver.test.js` against sample CFG fixtures)
- [ ] **[Phase 4]** Initialize Vite + React project in `dashboard/` with dark terminal styling tokens
- [ ] **[Phase 4]** Implement dual-pane layout (Code editor on left, Cytoscape canvas on right)
- [ ] **[Phase 4]** Integrate Cytoscape.js with `dagre` layout and color states (Green = Clean, Amber = Tainted, Red = Vulnerable)
- [ ] **[Phase 4]** Build interactive Block Detail Drawer displaying full TAC table and $IN/OUT/GEN/KILL$ sets
- [ ] **[Phase 4]** Build Vulnerability Trace Bar highlighting active attack paths on the graph

---

### 🤝 Shared / Joint Milestones

#### 🟢 Completed
- [x] **[Phase 1]** System Requirements & Syllabus Mapping ([PRD.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/PRD.md))
- [x] **[Phase 1]** System Architecture & Data Contracts ([Architecture.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/Architecture.md))
- [x] **[Phase 1]** Technical Guardrails & Rules ([Rules.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/Rules.md))
- [x] **[Phase 1]** 5-Phase Roadmap ([Phases.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/Phases.md))
- [x] **[Phase 1]** UI & Visual Styling Spec ([Design.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/Design.md))
- [x] **[Phase 1]** Remote Git Repository Linked & Pushed to GitHub

#### ⚪ Backlog
- [ ] **[Phase 3]** End-to-End Pipeline Integration (`codeguardian-frontend code.c | codeguardian-engine` $\to$ `Audit.json`)
- [ ] **[Phase 3]** Integration acceptance test suite (`clean_flow.c`, `sql_injection.c`, `command_injection.c`, `complex_loop.c`)
- [ ] **[Phase 5]** End-to-end benchmark timing suite (< 300ms execution target)
- [ ] **[Phase 5]** BCSE307L / BCSE307P Academic Demo & Final Documentation Package

---

## 3. Synchronization Checkpoints & Data Contract Status

### 3.1 Contract Lock Status
- **`CFG.json` (Member 1 $\to$ Member 2)**: 🔒 **LOCKED** ([Architecture.md §3.2](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/Architecture.md#32-cfgjson-control-flow-graph-contract)). Member 2 builds against this contract independently.
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
