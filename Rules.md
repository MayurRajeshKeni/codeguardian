# Technical Guardrails & Development Rules — CodeGuardian

---

## 1. Core Engineering Principles

CodeGuardian is an academic and production-grade compiler static analysis tool. Every component must be built with deterministic, verifiable, and mathematically grounded principles.

1. **Deterministic Execution**: The compiler and solver pipelines must be 100% deterministic. Random seeds, unordered set iterations, or non-deterministic hash maps that alter block numbering or variable indexing are strictly forbidden.
2. **Explicit Contracts**: Subsystems interact solely through validated JSON payloads (`AST.json`, `CFG.json`, `Audit.json`). In-memory monkey-patching or informal string passing between subsystems is disallowed.
3. **Fail-Closed Verification**: If an unexpected grammar token or invalid TAC quadruple is encountered, the engine must abort with a structured error diagnostic rather than silently continuing.

---

## 2. Forbidden Technologies & Anti-Patterns

### 2.1 Compiler Front-End (Member 1)
- **STRICTLY FORBIDDEN**: Using third-party compiler front-end libraries or parser generators (e.g., ANTLR, Tree-sitter, PEG.js, LLVM libraries, Clang LibTooling).
  - *Mandate*: Parsing must strictly use **GNU Flex** and **GNU Bison**.
- **FORBIDDEN**: Dynamic memory leaks in AST construction. Every allocated AST node must have an associated free/teardown lifecycle.
- **FORBIDDEN**: Arbitrary global state leaks in Bison actions. Use reentrant parser options or well-encapsulated root AST pointers (`%parse-param`).
- **FORBIDDEN**: Complex language constructs (pointers, structs, multidimensional arrays, dynamic heap allocation). Mini-C must remain strictly within the language bounds defined in [PRD.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/PRD.md).

### 2.2 Security Engine & Solver (Member 2)
- **FORBIDDEN**: Heuristic or regex-based security detection (e.g., searching for `execute_query` strings with regex).
  - *Mandate*: Security detection must be derived strictly through the **monotone iterative data-flow lattice solver** operating over the basic block graph.
- **FORBIDDEN**: Non-terminating data-flow loops. The lattice must enforce monotonicity ($IN[B]$ and $OUT[B]$ monotonically grow or shrink toward the fixed point).
- **FORBIDDEN**: Bloated external graph database dependencies (e.g., Neo4j, RedisGraph). The graph representation in memory must be lightweight adjacency structures or native node/edge lists.

### 2.3 Dashboard & UI (Member 2)
- **FORBIDDEN**: Tailwind CSS unless explicitly agreed upon; default to clean, modular Vanilla CSS with modern CSS custom properties (`--bg-primary`, `--accent-crimson`, etc.).
- **FORBIDDEN**: Generic placeholder graphics, empty mock tables, or unstyled default HTML form elements.
- **FORBIDDEN**: Client-side execution of untrusted system shell commands.

---

## 3. Coding Standards & Conventions

### 3.1 C Language Standards (Compiler Core)
- **Standard**: C11 compliant (`-std=c11 -Wall -Wextra -Wpedantic -Werror=vla`).
- **Memory Safety**: No raw variable-length arrays (VLAs). Dynamic arrays must check allocation failure (`malloc` / `calloc` checked against `NULL`).
- **Naming Conventions**:
  - Structs: PascalCase (e.g., `AstNode`, `TacInstruction`, `BasicBlock`).
  - Functions: snake_case with module prefixes (e.g., `ast_create_node()`, `tac_emit_quad()`, `cfg_partition_leaders()`).
  - Macros & Constants: SCREAMING_SNAKE_CASE (e.g., `MAX_OP_LEN`, `OP_ASSIGN`).
- **File Structure**: Clean separation of headers (`.h`) containing public signatures and source files (`.c`) containing internal logic.

### 3.2 JavaScript / TypeScript Standards (Solver & Dashboard)
- **Module System**: Modern ECMAScript Modules (`import` / `export`).
- **State Management**: Predictable state flows. Data-flow solver functions must be pure functions where input `(CFG, Rules)` produces `AuditState` without mutating input parameters.
- **Linting & Formatting**: Clean ESLint / Prettier adherence with 2-space indentation.

---

## 4. Workload Division & Boundaries

| Responsibility Area | Member 1 (Compiler Core) | Member 2 (Security & UI) |
| :--- | :--- | :--- |
| **Source Tokenization** | **Full Ownership** (`scanner.l`) | Forbidden from modifying parser rules |
| **Grammar & AST** | **Full Ownership** (`parser.y`, `ast.c`) | May inspect `AST.json` for validation |
| **TAC Generation** | **Full Ownership** (`tac.c`, `tac.h`) | Consumes TAC instructions in `CFG.json` |
| **CFG Partitioning** | **Full Ownership** (`cfg.c`, `cfg.h`) | Validates edge invariants |
| **Data-Flow Math Solver** | Out of Scope | **Full Ownership** (`solver.js` / `solver.py`) |
| **Security Rules & Policies** | Out of Scope | **Full Ownership** (`security_rules.json`) |
| **Audit Synthesis** | Out of Scope | **Full Ownership** (`auditor.js`) |
| **Dashboard & Graph Visuals** | Out of Scope | **Full Ownership** (`dashboard/`) |

---

## 5. AI-Assisted Code Generation Guardrails

When using AI pair-programming assistants within this codebase, the following directives are enforced:
1. **No Pseudocode or Stubs**: Generated code must be complete, compilable, and executable. Comments such as `// TODO: implement remaining operators` or `/* handle other cases */` are prohibited.
2. **Explicit JSON Serialization**: Handlers outputting JSON must properly escape special characters and format array brackets without trailing commas.
3. **Preserve Academic Grounding**: All algorithm implementations (Leader identification, AST creation, Kildall fixpoint worklist) must cite the corresponding textbook algorithms (Aho, Lam, Sethi, Ullman - Compilers: Principles, Techniques, and Tools).
4. **Verification First**: Any generated code block must have an accompanying test harness or verification input in `compiler_core/tests` or `security_engine/tests`.
