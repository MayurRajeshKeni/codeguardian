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
| **Product Requirements Document (PRD)** | System objectives, syllabus alignment, Mini-C language bounds, threat model, CWE taxonomy | [DOC/PRD.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/DOC/PRD.md) |
| **System Architecture Specification** | Component breakdown, frozen data contracts (`AST.json`, `CFG.json`, `Audit.json`), lattice math | [DOC/Architecture.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/DOC/Architecture.md) |
| **Technical Guardrails & Rules** | Engineering constraints, C11 memory safety, fail-closed verification, prohibited anti-patterns | [DOC/Rules.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/DOC/Rules.md) |
| **Phase Roadmap & Acceptance Gates** | 5-phase delivery model, milestone criteria, and acceptance test gates | [DOC/Phases.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/DOC/Phases.md) |
| **Visual Design & Graph Styling** | Dark terminal UI design tokens, Cytoscape.js layouts, color schemes, drawer interactions | [DOC/Design.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/DOC/Design.md) |
| **Live State Ledger & Memory** | Real-time sprint task board, contract lock states, completed checkpoints | [DOC/Memory.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/DOC/Memory.md) |
| **Development Log & Viva Guide** | Detailed daily engineering log, algorithm complexity, and interview quick-checks | [DOC/devlog.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/DOC/devlog.md) |
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
├── compiler_core/                         # [Member 1] Front-End & Middle-End
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
├── examples/                              # Shared Test Bench & Security Scenarios
│   ├── clean_flow.c                       # Source -> Sanitize -> Sink (0 Vulnerabilities)
│   ├── sql_injection.c                    # Unsanitized flow to execute_query (CWE-89)
│   ├── command_injection.c                # Unsanitized branch to system_exec (CWE-78)
│   └── complex_loop.c                     # Multi-iteration loop taint accumulator
│
└── scripts/
    └── run_tests.ps1                      # Comprehensive automated test runner
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
| **Data-Flow Math Solver** | Member 2 | Kildall monotone worklist fixpoint solver over $(\mathcal{P}(V), \subseteq)$ | 🟡 *In Progress* |
| **Vulnerability Auditor** | Member 2 | Source-Sanitizer-Sink path tracer $\to$ `Audit.json` | 🟡 *In Progress* |
| **Interactive Dashboard** | Member 2 | Vite + React + Cytoscape.js dual-pane UI | ⚪ *Queued* |

---

## 6. Build & Installation Guide

### Prerequisites
- **C Compiler**: GCC 11+ or Clang (e.g. MSYS2 UCRT64 `gcc 15.2.0` on Windows, or standard `gcc` on Linux/macOS)
- **Lexer Generator**: GNU Flex (2.6.4+)
- **Parser Generator**: GNU Bison (3.8.2+)
- **Build Utilities**: GNU Make (4.4+) or CMake (3.15+)

### One-Step Build
From the repository root:
```bash
# Build the compiler frontend binary
make build

# Run the comprehensive 10-test automated verification suite
make test

# Clean build artifacts
make clean
```

The compiled executable is emitted to:
`compiler_core/bin/codeguardian-frontend.exe` (or `codeguardian-frontend` on UNIX).

---

## 7. CLI Usage & Options

The compiler core CLI provides versatile operational modes:

```bash
# 1. Synthesize Control Flow Graph and emit CFG.json (Default)
./compiler_core/bin/codeguardian-frontend examples/clean_flow.c

# 2. Save CFG.json directly to an output file
./compiler_core/bin/codeguardian-frontend -o clean_flow.json examples/clean_flow.c

# 3. Emit AST.json syntax tree representation
./compiler_core/bin/codeguardian-frontend --ast examples/clean_flow.c

# 4. Lower AST to human-readable linear Three-Address Code (TAC)
./compiler_core/bin/codeguardian-frontend --tac examples/clean_flow.c

# 5. Stream lexical token coordinates [LINE, COL, TOKEN_TYPE, LEXEME]
./compiler_core/bin/codeguardian-frontend --lex examples/clean_flow.c

# 6. Syntax validation only (returns exit code 0 on valid, 1 on invalid)
./compiler_core/bin/codeguardian-frontend --parse examples/clean_flow.c
```

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
| **Kildall Monotone Worklist Solver** | Data-Flow Analysis | [`DOC/Architecture.md §4`](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/DOC/Architecture.md#4-mathematical-foundations-monotone-data-flow-lattice) | Powerset lattice join $\bigcup$, LFP convergence |

---

## 10. Verification Test Suite Results

Running `make test` executes `scripts/run_tests.ps1`, validating the entire compiler pipeline:

```
============================================================
   CodeGuardian Comprehensive Test Verification Suite       
============================================================

--- [PART 1: Unit Test Suite in compiler_core/tests/] ---

--> Testing: test_simple.c
    [PASS] test_simple.c passed Lexer, Parser, and emitted valid CFG.json.
--> Testing: test_branch.c
    [PASS] test_branch.c passed Lexer, Parser, and emitted valid CFG.json.
--> Testing: test_loop.c
    [PASS] test_loop.c passed Lexer, Parser, and emitted valid CFG.json.
--> Testing: test_sanitize.c
    [PASS] test_sanitize.c passed Lexer, Parser, and emitted valid CFG.json.
--> Testing: test_collision.c
    [PASS] test_collision.c passed Lexer, Parser, and emitted valid CFG.json.
--> Testing: test_invalid.c
    [PASS] test_invalid.c correctly rejected invalid syntax/lexemes fail-closed.

--- [PART 2: Shared Benchmark Suite in examples/] ---

--> Benchmarking Example: clean_flow.c
    [PASS] clean_flow.c synthesized CFG with 1 blocks, 0 edges.
--> Benchmarking Example: sql_injection.c
    [PASS] sql_injection.c synthesized CFG with 1 blocks, 0 edges.
--> Benchmarking Example: command_injection.c
    [PASS] command_injection.c synthesized CFG with 4 blocks, 4 edges.
--> Benchmarking Example: complex_loop.c
    [PASS] complex_loop.c synthesized CFG with 4 blocks, 4 edges.

============================================================
  Summary: 10 PASSED, 0 FAILED
============================================================
```

---

## 11. Authors & Academic Credentials

- **Member 1 (Compiler Core & Middle-End Lowering)**: Flex Lexer, Bison LALR(1) Grammar, AST Construction, SDT to TAC Quadruples, Dragon Book Leader Partitioning, CFG Edge Synthesizer, JSON Serializer.
- **Member 2 (Security Intelligence, Solver & UI)**: Kildall Worklist Monotone Fixpoint Lattice Solver, Taint Path Tracer, Audit Finding Synthesizer, React + Cytoscape.js Visual Dashboard.
