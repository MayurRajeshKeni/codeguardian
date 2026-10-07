# Project Requirements Document (PRD) — CodeGuardian
**Compiler-Based Static Security Analysis Engine**

---

## 1. Executive Summary & Objective

**CodeGuardian** is a deterministic static program analysis and compiler verification engine designed to detect software vulnerabilities at compile time. By coupling classic compiler front-end and middle-end construction techniques with monotone iterative data-flow analysis, CodeGuardian bridges theoretical compiler concepts with modern application security.

The engine parses a deterministic subset of C (**Mini-C**), lowers source programs into an Abstract Syntax Tree (AST), synthesizes a linear Three-Address Code (TAC) intermediate representation via Syntax-Directed Translation (SDT), partitions instructions into Basic Blocks via canonical leader algorithms, and constructs a Control Flow Graph (CFG). A monotone data-flow lattice solver computes fixpoint taint propagations across the CFG to flag untrusted data flows from user-controlled **Sources** to critical execution **Sinks** without intermediate **Sanitizers**.

The analysis results, along with interactive visual graphs of the CFG and instruction-level taint lattices, are presented on an engineer-grade dashboard powered by Cytoscape.js.

---

## 2. Academic Alignment & Syllabus Mapping

This project fulfills theoretical and laboratory competencies across **BCSE307L (Compiler Design Theory)** and **BCSE307P (Compiler Design Lab)**:

| Module / Topic Area | Syllabus Component (BCSE307L / BCSE307P) | CodeGuardian Implementation Component |
| :--- | :--- | :--- |
| **Lexical Analysis** | Regular expressions, Lex/Flex specifications, token generation, error handling | `scanner.l` (Flex specification for Mini-C tokens, literals, operators, keywords) |
| **Syntax Analysis** | Context-Free Grammars (CFG), LALR(1) Parsing, Bison specifications, shift/reduce conflict resolution | `parser.y` (Deterministic Bison LALR(1) grammar for statements, declarations, expressions) |
| **Intermediate Code Generation** | Syntax-Directed Translation (SDT), AST synthesis, Three-Address Code (TAC / Quadruples), temporary allocation | AST builder and SDT action routines generating linearized TAC with temporaries ($t_0, t_1, \dots$) and jump labels ($L_0, L_1, \dots$) |
| **Code Optimization / CFG** | Basic Block leader identification, Control Flow Graph construction, predecessor/successor tracking | Middle-end partitioning algorithm emitting Basic Blocks and directed edges into `CFG.json` |
| **Data-Flow Analysis** | Monotone frameworks, meet/join semi-lattices, Kildall iterative worklist algorithms, Available Expressions / Reaching Definitions | Fixpoint Taint Analysis Engine solving Gen/Kill/In/Out equations over the directed CFG lattice |
| **Static Verification** | Abstract Interpretation & Security Analysis | Policy engine detecting CWE-89 (SQL Injection), CWE-78 (Command Injection), and CWE-79 (XSS/Format String) |

---

## 3. Team Division of Labor (Exactly 2 Members)

The project architecture is strictly partitioned into two autonomous, testable subsystems linked by deterministic JSON data contracts:

```
[Mini-C Source]
       │
       ▼ (Member 1)
 ┌────────────────────────────────────────────────────────┐
 │ Frontend & Middle-End Engine                           │
 │   • Flex Lexer (scanner.l)                             │
 │   • Bison LALR(1) Parser (parser.y)                    │
 │   • AST Synthesis (ast.c / ast.h)                      │
 │   • SDT TAC Quadruple Generator (tac.c / tac.h)        │
 │   • Basic Block Leader Partitioning & CFG Synthesizer  │
 └────────────────────────────────────────────────────────┘
       │
       ▼ Emits: CFG.json (and AST.json)
 ┌────────────────────────────────────────────────────────┐
 │ Security Intelligence, Math Engine & UI (Member 2)     │
 │   • API Orchestration & Ingestion Gateway               │
 │   • Iterative Monotone Fixpoint Taint Solver (Kildall) │
 │   • Vulnerability Auditor (Source-Sanitizer-Sink Check)│
 │   • Emits: Audit.json                                  │
 │   • Dual-Pane Interactive Dashboard (React + Cytoscape)│
 └────────────────────────────────────────────────────────┘
```

### Member 1: Compiler Core & Front-End / Middle-End Lowering
- **Scope**: Lexical analysis, parsing, AST synthesis, SDT-driven TAC lowering, basic block partitioning, CFG edge construction, JSON serialization (`AST.json`, `CFG.json`).
- **Toolchain**: C11, GNU Flex (2.6+), GNU Bison (3.8+), CMake / Make.
- **Primary Deliverables**: `codeguardian-frontend` binary emitting compliant `CFG.json` and `AST.json`.

### Member 2: Security Intelligence, Data-Flow Math Engine & UI Dashboard
- **Scope**: Iterative Kildall worklist fixpoint taint solver, security rule definition (sources/sinks/sanitizers), audit finding synthesizer (`Audit.json`), and dashboard visualization.
- **Toolchain**: Node.js (v18+) or Python 3.11+, Express / FastAPI, React 18, Cytoscape.js, Lucide Icons.
- **Primary Deliverables**: Backend service executing fixpoint transfer functions, computing taint paths, and frontend dashboard with graph-level green/red taint visual states.

---

## 4. Language Specification: Mini-C Grammar Bounds

To guarantee deterministic LALR(1) parsing and well-founded static analysis, **Mini-C** enforces strict semantic boundaries:

### Supported Language Features
1. **Types**: Primitive integer (`int`), boolean (`bool`), void (`void`).
2. **Control Flow**: Conditionals (`if`, `if-else`), bounded loops (`while`).
3. **Operators**: Arithmetic (`+`, `-`, `*`, `/`, `%`), Relational (`==`, `!=`, `<`, `<=`, `>`, `>=`), Logical (`&&`, `||`, `!`), Assignment (`=`).
4. **Statements**: Variable declarations, assignments, block statements (`{ ... }`), function calls, return statements (`return`).
5. **Security Primitives**:
   - Built-in sources: `read_input()`, `get_param(name)`.
   - Built-in sanitizers: `sanitize(var)`, `escape_sql(var)`, `html_encode(var)`.
   - Built-in sinks: `execute_query(sql)`, `system_exec(cmd)`, `render_output(html)`.

### Deliberately Excluded Features (Out of Scope)
- Dynamic heap allocations (`malloc`, `free`) and pointer arithmetic.
- Complex data types (unions, recursive structures, multidimensional arrays).
- Function pointers, recursion, and interprocedural side effects (Single Translation Unit / Intraprocedural analysis baseline).
- Preprocessor macros (`#define`, `#include`) — inputs are pre-tokenized raw Mini-C units.

---

## 5. Security Model: Taint Tracking Framework

Static taint analysis is framed as a **Forward, May-Analysis** problem over the powerset lattice $(\mathcal{P}(V), \subseteq)$ where $V$ is the set of all program variables:

1. **Sources ($\mathcal{S}$)**: Statements where untrusted external data enters the system and assigns into variable $v$.
   - Example: `v = read_input();` $\implies GEN = \{v\}$.
2. **Sanitizers ($\mathcal{C}$)**: Cleansing routines that strip malicious properties from tainted variable $v$.
   - Example: `v = sanitize(v);` $\implies KILL = \{v\}$.
3. **Sinks ($\mathcal{K}$)**: Critical execution points where tainted variables must never appear.
   - Example: `execute_query(v);` — if $v \in IN[B]$, raise **CRITICAL VULNERABILITY**.
4. **Propagation**: If $v_1 \in IN[B]$ and statement is $v_2 = v_1 \text{ op } v_3$, then $v_2$ inherits taint.

---

## 6. Functional & Non-Functional Requirements

### Functional Requirements (FR)
- **FR-01 (Lexical Robustness)**: Flex lexer must correctly tokenize Mini-C syntax, maintain line and column metadata, and reject invalid tokens with descriptive errors.
- **FR-02 (Syntax Verification)**: Bison LALR(1) parser must parse valid Mini-C code with zero shift/reduce and zero reduce/reduce conflicts.
- **FR-03 (Linear TAC Generation)**: Syntax-directed translation must emit linearized TAC quadruples with deterministic temporary naming ($t_0, t_1, \dots$).
- **FR-04 (CFG Construction)**: Partition TAC into Basic Blocks according to Dragon Book leader criteria (Leader 1: first instruction; Leader 2: target of any jump; Leader 3: instruction immediately following any jump).
- **FR-05 (Contract Compliance)**: Frontend must output strictly compliant `CFG.json` matching the schema defined in `Architecture.md`.
- **FR-06 (Monotone Data-Flow Convergence)**: Data-flow solver must guarantee monotonic convergence to the Least Fixed Point (LFP) without infinite looping.
- **FR-07 (Taint Path Reconstruction)**: When a sink is triggered by tainted variables, the engine must extract the exact sequence of basic blocks and TAC instructions from source to sink.
- **FR-08 (Dual-Pane Interactive UI)**: Code editor on the left pane; Cytoscape.js directed graph on the right pane rendering Basic Blocks, predecessor/successor edges, and color-coded security statuses.

### Non-Functional Requirements (NFR)
- **NFR-01 (Determinism)**: Running the same Mini-C source code must yield bitwise-identical `CFG.json` and `Audit.json` representations across environments.
- **NFR-02 (Performance)**: Parse, TAC generation, and fixpoint taint analysis for a 200-line Mini-C program must execute in under 300 milliseconds.
- **NFR-03 (Fail-Safe Error Reporting)**: Lexical and syntax errors must produce structured diagnostic objects containing line number, column, and expected tokens.
- **NFR-04 (Zero Bloat)**: No external compiler generators beyond Flex and Bison; no heavy runtime dependencies.

---

## 7. Deliverables & Acceptance Criteria

1. **Compiler CLI (`codeguardian-frontend`)**: CLI producing `AST.json` and `CFG.json` given a `.c` file.
2. **Analysis Backend (`codeguardian-engine`)**: REST or direct solver service computing `Audit.json` from `CFG.json`.
3. **Web UI (`codeguardian-dashboard`)**: Vite/React dashboard featuring Cytoscape.js graph rendering with interactive node inspection.
4. **Verification Test Suite**:
   - `test_clean.c`: Clean input flow properly sanitized (must pass with 0 vulnerabilities).
   - `test_sqli.c`: Direct flow from `read_input` to `execute_query` (must flag SQL Injection at target node).
   - `test_branching.c`: Taint propagated conditionally through one branch of an `if-else` block.
   - `test_loop.c`: Taint accumulated across loop back-edges, verifying lattice fixpoint stability.