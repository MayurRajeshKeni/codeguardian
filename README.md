# CodeGuardian

> **Compiler-Based Static Security Analysis & Verification Engine**  
> Fulfilling theoretical and laboratory competencies across **BCSE307L (Compiler Design Theory)** & **BCSE307P (Compiler Design Lab)**

[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen.svg)]()
[![Standard](https://img.shields.io/badge/Language-C11-blue.svg)]()
[![Lexer](https://img.shields.io/badge/Lexer-GNU%20Flex%202.6.4-orange.svg)]()
[![Parser](https://img.shields.io/badge/Parser-GNU%20Bison%203.8.2%20LALR(1)-purple.svg)]()
[![Data Flow](https://img.shields.io/badge/Lattice-Kildall%20Monotone%20Worklist-red.svg)]()

---

## 1. Overview & System Mission

**CodeGuardian** is a deterministic static program analysis and compiler verification engine designed to detect software vulnerabilities at compile time. By synthesizing classic compiler front-end and middle-end construction techniques with monotone iterative data-flow analysis, CodeGuardian bridges theoretical compiler syllabus concepts with real-world application security.

The engine parses a deterministic subset of C (**Mini-C**), lowers source programs into an Abstract Syntax Tree (AST), generates linear Three-Address Code (TAC) via Syntax-Directed Translation (SDT), partitions instructions into Basic Blocks via canonical Dragon Book leader algorithms, and constructs a Control Flow Graph (CFG). A monotone data-flow lattice solver computes fixpoint taint propagations across the CFG to identify untrusted data flows from user-controlled **Sources** to critical execution **Sinks** without intermediate **Sanitizers**.

---

## 2. End-to-End Pipeline Architecture

CodeGuardian is partitioned into two decoupled subsystems interacting across strongly typed, frozen JSON data contracts (`CFG.json` and `Audit.json`):

```
                   ┌───────────────────────────────────────────────┐
                   │              Mini-C Source (.c)               │
                   └───────────────────────┬───────────────────────┘
                                           │
                                           ▼
    ========================== MEMBER 1 SUBSYSTEM ==========================
    ┌─────────────────────────────────────────────────────────────────────┐
    │ 1. LEXICAL ANALYZER (Flex: scanner.l)                               │
    │    • Emits token stream with line/col tags & symbol attributes      │
    └──────────────────────────────────┬──────────────────────────────────┘
                                       │
                                       ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │ 2. LALR(1) SYNTAX PARSER (Bison: parser.y)                          │
    │    • Builds AST nodes in-memory (ast.c / ast.h)                     │
    │    • Resolves dangling-else with %nonassoc (0 conflicts)            │
    │    • (Optional export: AST.json)                                    │
    └──────────────────────────────────┬──────────────────────────────────┘
                                       │
                                       ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │ 3. THREE-ADDRESS CODE (TAC) LOWERING (tac.c / tac.h)                │
    │    • SDT post-order traversal synthesizing linear quadruples        │
    │    • Allocates temporaries (t0, t1, ...) & labels (L0, L1, ...)     │
    └──────────────────────────────────┬──────────────────────────────────┘
                                       │
                                       ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │ 4. BASIC BLOCK & CFG SYNTHESIZER (cfg.c / cfg.h)                    │
    │    • Dragon Book 3-rule leader partitioning algorithm               │
    │    • Groups instructions into Basic Blocks (B0, B1, ...)            │
    │    • Resolves conditional (true/false) & unconditional jump edges   │
    │    • Serializes output to CFG.json                                  │
    └──────────────────────────────────┬──────────────────────────────────┘
                                       │
                             Emits CFG.json
                                       │
    ========================== MEMBER 2 SUBSYSTEM ==========================
                                       ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │ 5. DATA-FLOW SOLVER ENGINE (Node.js/Python)                         │
    │    • Computes GEN and KILL sets for each basic block                │
    │    • Solves Kildall iterative worklist fixpoint equations           │
    │    • Traces taint propagation paths from Source to Sink             │
    │    • Serializes findings to Audit.json                              │
    └──────────────────────────────────┬──────────────────────────────────┘
                                       │
                             Emits Audit.json
                                       │
                                       ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │ 6. INTERACTIVE VISUAL DASHBOARD (React + Cytoscape.js)              │
    │    • Dual-pane UI: Source Editor (left) & CFG Canvas (right)        │
    │    • Color states: Emerald Green (Clean), Crimson Red (Vulnerable)  │
    │    • Interactive block drawer: inspects TAC quadruples & IN/OUT sets│
    └─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Documentation & Engineering Artifacts (`DOC/`)

All project governance, theoretical specifications, roadmaps, and presentation slides are consolidated inside the [`DOC/`](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/DOC) directory:

| Document | Description | Direct Link |
| :--- | :--- | :--- |
| **System Operations Runbook** | Complete cross-platform setup, execution, CLI, and troubleshooting guide for Windows, Linux & macOS | [RUNBOOK.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/RUNBOOK.md) |
| **Product Requirements Document (PRD)** | System objectives, syllabus alignment, Mini-C language bounds, threat model, CWE taxonomy | [DOC/PRD.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/DOC/PRD.md) |
| **System Architecture Specification** | Component breakdown, frozen data contracts (`AST.json`, `CFG.json`, `Audit.json`), lattice math | [DOC/Architecture.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/DOC/Architecture.md) |
| **Technical Guardrails & Rules** | Engineering constraints, C11 memory safety, fail-closed verification, prohibited anti-patterns | [DOC/Rules.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/DOC/Rules.md) |
| **Phase Roadmap & Acceptance Gates** | 5-phase delivery model, milestone criteria, and acceptance test gates | [DOC/Phases.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/DOC/Phases.md) |
| **Visual Design & Graph Styling** | Dark terminal UI design tokens, Cytoscape.js layouts, color schemes, drawer interactions | [DOC/Design.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/DOC/Design.md) |
| **Live State Ledger & Memory** | Real-time sprint task board, contract lock states, completed checkpoints | [DOC/Memory.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/DOC/Memory.md) |
| **Development Log & Dev History** | Detailed daily engineering log, algorithm complexity, and interview quick-checks | [DOC/devlog.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/DOC/devlog.md) |
| **Academic Viva Defense Guide** | Comprehensive syllabus alignment (Modules 1-7), code mappings, and top 20 viva defense Q&A | [DOC/Viva_Preparation_Guide.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/DOC/Viva_Preparation_Guide.md) |
| **SLA & Performance Benchmark Report** | Quantitative timing analysis across all benchmarks verifying < 300ms SLA (NFR-02) | [DOC/Benchmark_Report.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/DOC/Benchmark_Report.md) |
| **Mini-C BNF Grammar** | Formal Backus-Naur Form grammar, precedence table, and ambiguity disambiguation rules | [compiler_core/BNF_Grammar.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/compiler_core/BNF_Grammar.md) |
| **Full Project Presentation (PDF)** | Comprehensive slide deck connecting syllabus theory to CodeGuardian implementation | [DOC/CodeGuardian Full Presentation.pdf](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/DOC/CodeGuardian%20Full%20Presentation.pdf) |
| **Project Review 1 Presentation (PDF)** | Phase 1 & 2 design review presentation for university evaluators | [DOC/CodeGuardian_ProjectReview1.pdf](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/DOC/CodeGuardian%20ProjectReview1.pdf) |
| **Architecture Diagram (PDF)** | High-resolution architectural poster from Compiler Core to Security Solver | [DOC/Compiler Core to Security_Arch_diag.pdf](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/DOC/Compiler%20Core%20to%20Security_Arch_diag.pdf) |

---

## 4. Repository Structure

```
CD_CodeGuardian/
├── README.md                              # Master overview & documentation hub
├── Makefile                               # Portable root build & test script
├── mock_CFG.json                          # Milestone 1 frozen CFG contract fixture
├── mock_Audit.json                        # Milestone 1 frozen Audit contract fixture
├── Audit.json                             # Active solver sample audit state
│
├── DOC/                                   # Complete documentation & presentations
│   ├── PRD.md
│   ├── Architecture.md
│   ├── Rules.md
│   ├── Phases.md
│   ├── Design.md
│   ├── Memory.md
│   ├── devlog.md
│   ├── CodeGuardian Full Presentation.pdf
│   ├── CodeGuardian_ProjectReview1.pdf
│   └── Compiler Core to Security_Arch_diag.pdf
│
├── compiler_core/                         # [Member 1] Front-End & Middle-End Lowering
│   ├── BNF_Grammar.md                     # Mini-C formal BNF grammar
│   ├── Makefile                           # Toolchain build script (Flex, Bison, GCC)
│   ├── CMakeLists.txt                     # CMake build configuration
│   ├── src/
│   │   ├── scanner.l                      # Flex lexer specification
│   │   ├── parser.y                       # Bison LALR(1) grammar specification
│   │   ├── tokens.h / tokens.c            # Token descriptors & string converters
│   │   ├── ast.h / ast.c                  # In-memory AST constructors & JSON emitter
│   │   ├── tac.h / tac.c                  # SDT lowering routines (AST -> TAC)
│   │   ├── cfg.h / cfg.c                  # Leader partitioning & edge synthesizer
│   │   ├── json_emit.h / json_emit.c      # CFG.json & AST.json serializers
│   │   └── main.c                         # codeguardian-frontend CLI driver
│   └── tests/                             # Unit tests for compiler front-end
│       ├── test_simple.c                  # Arithmetic & variable declarations
│       ├── test_branch.c                  # Conditional if-else branching
│       ├── test_loop.c                    # While loops & counter iterations
│       ├── test_sanitize.c                # Security primitive calls
│       ├── test_collision.c               # Lexical collision & operator boundary tests
│       └── test_invalid.c                 # Fail-closed lexical/syntax error tests
│
├── security_engine/                       # [Member 2] Security Engine & HTTP Gateway
│   ├── package.json                       # Dependencies (ajv) & test scripts
│   ├── README.md                          # Engine documentation & API specifications
│   ├── security_rules.json                # Source, Sanitizer, and Sink definitions
│   ├── schemas/                           # Frozen JSON schemas (cfg, audit)
│   ├── src/
│   │   ├── auditor.js                     # Taint auditor & vulnerability path tracer
│   │   ├── cli.js                         # Standalone analysis CLI (stdin -> Audit.json)
│   │   ├── compile.js                     # Bridge invoking compiler frontend safely
│   │   ├── errors.js                      # Structured diagnostic & analysis error types
│   │   ├── lattice.js                     # Powerset lattice operations (P(V), ⊆)
│   │   ├── rules.js                       # Security rules loader & validator
│   │   ├── server.js                      # HTTP analysis gateway (port 8787)
│   │   ├── solver.js                      # Kildall monotone worklist fixpoint solver
│   │   ├── transfer.js                    # GEN/KILL & instruction transfer functions
│   │   └── validate.js                    # Contract schema validation
│   └── tests/                             # Test suites (solver, compile, pipeline, server)
│
├── dashboard/                             # [Member 2] Interactive Visual Dashboard
│   ├── package.json                       # Dependencies (React 18, Cytoscape, Dagre, Vite)
│   ├── vite.config.js                     # Vite build configuration & server port
│   ├── index.html                         # Entry HTML with modern font imports
│   └── src/
│       ├── main.jsx                       # React entry point
│       ├── App.jsx                        # Dual-pane UI, line jump sync, theme toggle & controls
│       ├── Graph.jsx                      # Cytoscape.js Dagre canvas with theme-adaptive SVG nodes
│       ├── remediation.js                 # AST/TAC auto-remediation patch synthesizer & diff builder
│       ├── sarif.js                       # OASIS SARIF 2.1.0 security report generator
│       ├── styles.css                     # Dual Dark/Light cybersecurity theme tokens
│       └── samples/                       # Pre-bundled Mini-C benchmark programs (SQLi, CmdInj, XSS)
│
├── examples/                              # Shared Test Bench & Security Scenarios
│   ├── clean_flow.c                       # Source -> Sanitize -> Sink (0 Vulnerabilities)
│   ├── sql_injection.c                    # Unsanitized flow to execute_query (CWE-89)
│   ├── command_injection.c                # Unsanitized branch to system_exec (CWE-78)
│   ├── xss.c                              # Unsanitized flow to render_output (CWE-79)
│   ├── complex_loop.c                     # Multi-iteration loop taint accumulator
│   └── master_showcase.c                  # Multi-sink combined enterprise test case
│
└── scripts/
    ├── run_tests.ps1                      # Compiler unit test runner
    ├── benchmark.ps1                      # SLA performance latency benchmark runner
    ├── verify_all.ps1                     # Master 5-stage verification & gate review (Windows)
    └── verify_all.sh                      # Master 5-stage verification & gate review (POSIX)
```

---

## 5. Team Workload Division & Current Status

| Subsystem / Responsibility | Owner | Technical Scope | Status |
| :--- | :--- | :--- | :---: |
| **Lexer & Parser** | Member 1 | GNU Flex (`scanner.l`) & GNU Bison (`parser.y`) | 🟢 **Complete** |
| **AST Synthesis** | Member 1 | In-memory tree constructors & destructors (`ast.c`) | 🟢 **Complete** |
| **TAC SDT Lowering** | Member 1 | Quadruple generation, temporaries $t_i$, labels $L_i$ (`tac.c`) | 🟢 **Complete** |
| **CFG Partitioning** | Member 1 | Dragon Book 3-Rule Leader Partitioning & edge wiring (`cfg.c`) | 🟢 **Complete** |
| **JSON Serialization** | Member 1 | Emitting valid `CFG.json` matching frozen schema | 🟢 **Complete** |
| **Data-Flow Math Solver** | Member 2 | Kildall monotone worklist fixpoint solver over $(\mathcal{P}(V), \subseteq)$ | 🟢 **Complete** |
| **Vulnerability Auditor** | Member 2 | Source-Sanitizer-Sink path tracer $\to$ `Audit.json` | 🟢 **Complete** |
| **HTTP Analysis Gateway** | Member 2 | Zero-bloat HTTP API gateway (`/api/analyze`, `/api/examples`) | 🟢 **Complete** |
| **Interactive Dashboard** | Member 2 | Vite + React 18 + Cytoscape.js dual-pane visual UI | 🟢 **Complete** |

---

## 6. Build & Installation Guide

### Prerequisites
- **C Compiler & Tools**: GCC 11+ or Clang, GNU Flex (2.6.4+), GNU Bison (3.8.2+), GNU Make (4.4+) or CMake (3.15+)
- **Runtime Environment**: Node.js (v18.0.0+ LTS recommended) and npm

### 1. Build Compiler Core
From the repository root:
```bash
# Build the compiler frontend binary
make build

# Or on Windows using PowerShell:
# ./scripts/run_tests.ps1
```
The compiled executable is emitted to `compiler_core/bin/codeguardian-frontend.exe` (or `codeguardian-frontend` on UNIX).

### 2. Install & Start Security Engine
```bash
cd security_engine
npm install

# Run automated engine and pipeline test suite
npm test

# Launch the HTTP Gateway server on http://127.0.0.1:8787
npm start
```

### 3. Install & Launch Dashboard
In a separate terminal:
```bash
cd dashboard
npm install

# Start the Vite development server (defaults to http://localhost:5173)
npm run dev
```

---

---

## 7. Security Classification Glossary

In CodeGuardian, basic blocks and variables are assigned one of four distinct security classifications based on their monotone data-flow lattice state:

| Status | Terminal / UI Color | Formal Lattice Condition | Description & Trigger |
| :--- | :---: | :--- | :--- |
| **`CLEAN`** | **Emerald Green**<br>`🟢 #22c55e` | $OUT[B] = \emptyset$ | **Safe / Untainted Block**: The basic block contains zero active tainted variables leaving its boundary. All variables either never originated from untrusted sources or were completely cleansed/overwritten before block exit. |
| **`SANITIZED`** | **Cyan**<br>`🔵 #06b6d4` | $\text{Sanitizations}[B] > 0$<br>and $\text{SinkHits}[B] = 0$ | **Cleansed Block**: The basic block successfully invoked an authorized sanitizer routine (`sanitize()`, `escape_sql()`, `html_encode()`) on a tainted variable, neutralizing its danger and adding it to $KILL[B]$. |
| **`TAINTED`** | **Amber / Orange**<br>`🟠 #f59e0b` | $OUT[B] \neq \emptyset$<br>and $\text{SinkHits}[B] = 0$ | **Taint in Transit**: The basic block carries active untrusted data out of the block into successor blocks. Taint was either ingested via a source call (`read_input()`, `get_param()`) or propagated through assignments ($x = y$) or arithmetic ($x = y + z$). |
| **`VULNERABLE`** | **Crimson Red**<br>`🔴 #ef4444` | $\text{SinkHits}[B] > 0$ | **Exploitable Vulnerability Triggered**: The basic block contains a sensitive sink function (`execute_query`, `system_exec`, `render_output`) whose argument was evaluated to be tainted at the point of invocation without prior sanitization along that execution path (e.g., CWE-89, CWE-78, CWE-79). |

> 💡 **For CLI Commands, Pipeline Piping, and Master Showcase**: See the complete [RUNBOOK.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/RUNBOOK.md).

---

## 8. Mathematical Foundation: Monotone Data-Flow Lattice

The middle-end CFG structures directly feed the security engine's **Forward, May-Analysis** over the powerset lattice $(\mathcal{P}(V), \subseteq)$:

### Transfer Equations
For each basic block $B$:

$$IN[B] = \bigcup_{P \in \text{Pred}[B]} OUT[P]$$

$$OUT[B] = GEN[B] \cup (IN[B] \setminus KILL[B])$$

Where:
- $GEN[B]$: Set of variables tainted in block $B$ (assignments from `read_input()`, `get_param()`, or copying from tainted variables).
- $KILL[B]$: Set of variables sanitized in block $B$ (assignments passing through `sanitize()`, `escape_sql()`, `html_encode()`).

### Monotone Convergence Guarantee
Because the carrier set $\mathcal{P}(V)$ is finite (at most $|V|$ program variables) and the transfer functions $f_B(X)$ are monotonic ($X \subseteq Y \implies f_B(X) \subseteq f_B(Y)$), **Tarski's Fixed Point Theorem** guarantees that Kildall's iterative worklist algorithm strictly terminates at the unique **Least Fixed Point (LFP)** without infinite looping, even across cyclic loops.

---

## 9. Academic Syllabus Mapping Matrix

| Theoretical Concept | Syllabus Module | Implementation File | Verification Proof |
| :--- | :--- | :--- | :--- |
| **Regular Expressions & Lexical DFAs** | Lexical Analysis | [`compiler_core/src/scanner.l`](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/compiler_core/src/scanner.l) | Zero lexical collisions, token coordinates (`yylloc`) |
| **LALR(1) Parsing & Conflict Resolution** | Syntax Analysis | [`compiler_core/src/parser.y`](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/compiler_core/src/parser.y) | 0 shift/reduce conflicts, dangling-else `%nonassoc` |
| **Abstract Syntax Tree (AST)** | Intermediate Representation | [`compiler_core/src/ast.c`](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/compiler_core/src/ast.c) | Recursive node allocators, `AST.json` emitter |
| **Syntax-Directed Translation (SDT)** | Intermediate Code Gen | [`compiler_core/src/tac.c`](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/compiler_core/src/tac.c) | Linear quadruples, temporaries $t_i$, labels $L_i$ |
| **Dragon Book Leader Partitioning** | Code Optimization & CFG | [`compiler_core/src/cfg.c`](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/compiler_core/src/cfg.c) | Canonical 3-rule leader detection algorithm |
| **Control Flow Graphs (CFG)** | Control Flow Analysis | [`compiler_core/src/cfg.c`](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/compiler_core/src/cfg.c) | Predecessor/Successor sets, `CFG.json` output |
| **Kildall Monotone Worklist Solver** | Data-Flow Analysis | [`security_engine/src/solver.js`](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/security_engine/src/solver.js) | Powerset lattice join $\bigcup$, LFP convergence |

---

## 10. Verification Test Suite & Gate Review Results

Running the master verification suite (`powershell -File scripts/verify_all.ps1` or `./scripts/verify_all.sh`) evaluates all 5 Milestone Acceptance Gates end-to-end:

```
============================================================
   CodeGuardian Master Verification & Gate Review Suite     
============================================================

---> Running Stage: 1. Compiler Core Unit & Lexer/Parser Tests (Gate 1 & 2)...
     [STAGE PASSED] 1. Compiler Core Unit & Lexer/Parser Tests (Gate 1 & 2) (1021 ms)

---> Running Stage: 2. Security Engine & Fixpoint Solver Test Suite (Gate 2 & 3)...
     [STAGE PASSED] 2. Security Engine & Fixpoint Solver Test Suite (Gate 2 & 3) (1297 ms)

---> Running Stage: 3. End-to-End CLI Pipeline Verification (Gate 3)...
     [STAGE PASSED] 3. End-to-End CLI Pipeline Verification (Gate 3) (313 ms)

---> Running Stage: 4. Dashboard Production Build & Bundler Verification (Gate 4)...
     [STAGE PASSED] 4. Dashboard Production Build & Bundler Verification (Gate 4) (2869 ms)

---> Running Stage: 5. Performance & SLA Latency Benchmarks (Gate 5)...
     [STAGE PASSED] 5. Performance & SLA Latency Benchmarks (Gate 5) (6277 ms)

============================================================
                FINAL VERIFICATION SUMMARY                  
============================================================
  [PASS] 1. Compiler Core Unit & Lexer/Parser Tests (Gate 1 & 2) (  1021 ms)
  [PASS] 2. Security Engine & Fixpoint Solver Test Suite (Gate 2 & 3) (  1297 ms)
  [PASS] 3. End-to-End CLI Pipeline Verification (Gate 3)        (   313 ms)
  [PASS] 4. Dashboard Production Build & Bundler Verification (Gate 4) (  2869 ms)
  [PASS] 5. Performance & SLA Latency Benchmarks (Gate 5)        (  6277 ms)
------------------------------------------------------------
  Total Verification Time: 11.81 seconds
  VERDICT: ALL 5 GATES VERIFIED AND PASSING!
============================================================
```

### What We Achieved With These Results
1. **Zero Lexical & Grammar Ambiguities**: The C11 LALR(1) parser compiles Mini-C code with **0 shift/reduce conflicts** and **0 reduce/reduce conflicts**, ensuring deterministic parse trees.
2. **100% Contract & Schema Integrity**: Every basic block, instruction quadruple, and audit finding validates strictly against frozen schemas (`cfg.schema.json` and `audit.schema.json`) with zero runtime divergence.
3. **Sound Fixpoint Convergence**: Evaluated across 62 automated engine tests and canonical benchmarks—proving that cyclic loop back-edges converge deterministically to the unique Least Fixed Point (LFP) without infinite looping.
4. **Sub-Second Performance (< 300 ms SLA)**: Achieved an average end-to-end execution speed of **~200 ms** (Frontend ~25 ms + Security Engine ~175 ms), leaving **~100 ms of safety buffer** below the PRD NFR-02 SLA threshold.
5. **Turnkey Review Readiness**: Both team members' subsystems are fully verified across CLI, HTTP gateway, and Cytoscape.js interactive graph visualization boundaries.

---

## 11. Authors & Academic Credentials

- **Member 1 (Compiler Core & Middle-End Lowering)**: Flex Lexer, Bison LALR(1) Grammar, AST Construction, SDT to TAC Quadruples, Dragon Book Leader Partitioning, CFG Edge Synthesizer, JSON Serializer.
- **Member 2 (Security Intelligence, Solver & UI)**: Kildall Worklist Monotone Fixpoint Lattice Solver, Taint Path Tracer, Audit Finding Synthesizer, React + Cytoscape.js Visual Dashboard.
