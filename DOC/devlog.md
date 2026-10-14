# CodeGuardian — Engineering Development Log

This document tracks daily technical progress, architectural decisions, algorithm implementations, and viva preparation checkpoints for the **CodeGuardian** compiler static analysis engine.

---

# Development Log - Session 1 (Day 1)

## 1. What Was Built Today (High-Level Summary)
Architected and locked the complete system governance, mathematical foundation, and decoupled data contracts for CodeGuardian. Created five core system specifications:
- `PRD.md`: Formal syllabus mapping to BCSE307L/BCSE307P, threat model (Sources, Sanitizers, Sinks), and CWE taxonomy (CWE-89 SQLi, CWE-78 Command Injection, CWE-79 XSS).
- `Architecture.md`: 6-stage compiler & static analysis pipeline, Kildall monotone data-flow lattice transfer equations, and frozen JSON schemas (`AST.json`, `CFG.json`, `Audit.json`).
- `Rules.md`: Strict technical guardrails (zero dynamic memory leaks, C11 standard compliance, pure Flex/Bison front-end mandate, fail-closed verification).
- `Phases.md`: 5-phase roadmap with explicit milestone acceptance gates decoupling Member 1 (compiler frontend) from Member 2 (security solver & UI).
- `Design.md`: Visual styling specification for the dual-pane cybersecurity terminal dashboard.

## 2. Significance & Engineering Purpose
In traditional compiler and analysis projects, front-end AST/CFG generation and back-end analysis are frequently tangled in a monolithic codebase, causing blocking dependencies between team members. By freezing the `CFG.json` and `Audit.json` data contracts on Day 1:
- **Member 1** can implement lexical analysis, AST lowering, TAC quadruples, and basic block synthesis in C11 without waiting for the solver.
- **Member 2** can build the monotone Kildall worklist fixpoint solver and React/Cytoscape dashboard against static mock fixtures (`mock_CFG.json`) in parallel.
- Mathematical rigor is established before writing code: the taint analysis is formally cast as a **Forward, May-Analysis** over the powerset lattice $(\mathcal{P}(V), \subseteq)$, guaranteeing termination to the Least Fixed Point (LFP).

## 3. Core Code Concepts Explained Simply

**Key Data Contracts & Mathematical Formulations:**
- **Control Flow Graph Contract (`CFG.json`)**: Encapsulates program basic blocks ($B_0, B_1, \dots$), instructions in 3-Address Code (TAC), predecessor lists, successor lists, and typed control-flow edges (`TRUE_BRANCH`, `FALSE_BRANCH`, `UNCONDITIONAL`).
- **Security Audit Contract (`Audit.json`)**: Captures per-block lattice states ($IN, OUT, GEN, KILL$), block vulnerability classifications (`CLEAN`, `TAINTED`, `VULNERABLE`), and end-to-end source-to-sink taint paths.
- **Transfer Functions**:
  $$IN[B] = \bigcup_{P \in \text{Pred}[B]} OUT[P]$$
  $$OUT[B] = GEN[B] \cup (IN[B] \setminus KILL[B])$$
  where $GEN[B]$ taints variables via untrusted source calls (`read_input`, `get_param`) and $KILL[B]$ cleanses variables via sanitizers (`sanitize`, `escape_sql`).

**Time & Space Complexity:**
- **Lattice Solver Time Complexity**: $\mathcal{O}(|V| \times |E|)$ where $|V|$ is the number of program variables and $|E|$ is the number of control-flow edges. Because the lattice height is bounded by $|V|$ and transfer functions are monotonic, each basic block can be re-evaluated at most $|V|$ times.
- **Space Complexity**: $\mathcal{O}(|B| \times |V|)$ storing the bitset/hash set of tainted variables for each basic block.

**Why Not the Naive Way?**
- *Naive Approach*: Searching for dangerous function names (like `execute_query(x)`) with Regular Expressions or AST tree grep.
- *Why it Fails*: Regex cannot evaluate runtime paths, cannot distinguish if `x` was previously sanitized in an enclosing branch, and is completely blind to loop accumulators or variable aliases. The monotone data-flow lattice tracks actual semantic value propagation across all execution paths.

## 4. Viva / Interview Quick-Check

**Q:** Why is static taint analysis formulated as a **Forward, May-Analysis**?  
**A:** It is a *Forward* analysis because taint flows in the direction of program execution (from source statements to sinks). It is a *May-Analysis* because a variable is considered tainted at the entrance of a block if it can be tainted along *any* incoming execution path (joined via set union $\bigcup$).

**Q:** What mathematical property guarantees that Kildall's worklist algorithm will terminate on cyclic loops?  
**A:** **Monotonicity** over a **finite lattice**. The carrier set $\mathcal{P}(V)$ is finite (at most $|V|$ variables). The transfer function $f_B(X) = GEN[B] \cup (X \setminus KILL[B])$ is monotonic ($X \subseteq Y \implies f_B(X) \subseteq f_B(Y)$). By Tarski's Fixed Point Theorem, iteratively evaluating monotonic functions over a finite semi-lattice must converge to the unique Least Fixed Point (LFP) without infinite looping.

**Q:** Why are third-party parser generators like ANTLR or Tree-sitter prohibited in `Rules.md`?  
**A:** BCSE307L/BCSE307P requires implementing fundamental compiler front-ends using classic compiler tools (GNU Flex and GNU Bison) to demonstrate mastery of DFA state minimization, LALR(1) item sets, and shift/reduce conflict resolution.

---

# Development Log - Session 2 (Day 2)

## 1. What Was Built Today (High-Level Summary)
Completed **Member 1 Phase 1 (Compiler Core)**:
- Built the automated C11 build toolchain supporting GNU Flex (2.6.4), GNU Bison (3.8.2), GNU Make (4.4.1), and GCC (15.2.0) with portable Windows/MSYS2 path resolution.
- Authored the formal BNF Grammar for Mini-C (`compiler_core/BNF_Grammar.md`) specifying types, control flow, stratified expression precedence, and security primitives.
- Implemented the deterministic Flex lexer (`compiler_core/src/scanner.l`) with line and column tracking, block comment state machine, and verified zero lexical collisions.
- Authored the initial Bison LALR(1) grammar (`compiler_core/src/parser.y`) eliminating all shift/reduce and reduce/reduce conflicts (0 conflicts).
- Created the CLI entry point (`compiler_core/src/main.c`) supporting `--lex` and `--parse` modes.
- Authored the test runner (`scripts/run_tests.ps1`) and verified 6 unit tests with a 100% pass rate.
- Added 4 shared benchmark programs in `examples/` and static contract fixtures (`mock_CFG.json`, `mock_Audit.json`) satisfying Milestone Acceptance Gate 1.

## 2. Significance & Engineering Purpose
Lexical analysis and grammar formalization form the foundational base of the entire static analysis pipeline. If the lexer produces token collisions (e.g., misclassifying the identifier `integer` as the keyword `int`, or mistaking `==` for two `=` tokens), every subsequent phase (AST, TAC, and CFG) is corrupted. 

Achieving a clean LALR(1) grammar with **zero shift/reduce conflicts** guarantees that Mini-C code is parsed deterministically without backtracking or ambiguous parse trees. Furthermore, providing precise line and column metadata enables the final security engine to pinpoint vulnerability locations directly in developer source code.

## 3. Core Code Concepts Explained Simply

**Key Functions & Architectural Elements:**
- `yylex()` (`scanner.l`) — Scans source characters using regular expressions, updates `yylloc` coordinates, and emits token IDs to the parser.
- `update_loc()` (`scanner.l`) — Macro/helper that sets `yylloc.first_line`, `yylloc.first_column`, `yylloc.last_column`, and increments `current_column` by `yyleng`.
- `token_type_to_string()` (`tokens.c`) — Translates raw integer token codes into human-readable strings (e.g., `TOK_ASSIGN`, `TOK_IDENTIFIER`) for CLI diagnostics.
- `run_lexer_mode()` (`main.c`) — Streams tokens from source files, printing a formatted columnated table of line, column, token type, and lexeme.
- `run_parser_mode()` (`main.c`) — Executes `yyparse()`, returning structured success/failure diagnostics.
- `yyerror()` (`parser.y`) — Custom syntax error handler reporting exact line and column numbers upon encountering syntax errors.

**Time & Space Complexity:**
- **Lexical Analysis (Flex)**: $\mathcal{O}(N)$ time where $N$ is the number of source characters. Flex compiles regular expressions into a Deterministic Finite Automaton (DFA), processing each input character in $\mathcal{O}(1)$ time with zero backtracking. Space complexity is $\mathcal{O}(1)$ buffer storage.
- **Parsing (Bison LALR(1))**: $\mathcal{O}(M)$ time where $M$ is the number of tokens. LALR(1) parsing uses a deterministic pushdown automaton (PDA), executing exactly one shift or reduce action per token transition. Stack depth is $\mathcal{O}(D)$ where $D$ is the maximum parse tree depth.

**Why Not the Naive Way?**
- *Lexical Collisions*: A naive lexer might define keywords using loose patterns or place identifiers before keywords. In Flex, rule order resolves ties for equal-length matches. Placing keywords (`int`, `bool`, `void`) *before* the generic identifier pattern `[a-zA-Z_][a-zA-Z0-9_]*` guarantees keywords are recognized as reserved tokens, while longer identifiers like `internal_counter` match the identifier rule due to the **Maximal Munch (Longest Match)** principle.
- *Dangling-Else Ambiguity*: In standard C, an ambiguous grammar cannot decide which `if` an `else` binds to. Rather than rewriting the grammar into complex matched/unmatched non-terminals, we declared `%nonassoc LOWER_THAN_ELSE` and `%nonassoc TOK_ELSE`, resolving the shift/reduce ambiguity by explicitly favoring shifting `else` to match the innermost `if`.

## 4. Viva / Interview Quick-Check

**Q:** What is the "Maximal Munch" (or Longest Match) rule in Flex, and why is it critical?  
**A:** When multiple regular expressions match the input stream, Flex always chooses the rule that matches the *longest sequence of characters*. For example, given the input `integer`, the keyword rule for `int` matches 3 characters, but the identifier rule matches all 7 characters. Maximal Munch ensures `integer` is correctly tokenized as an identifier, not as `TOK_INT` followed by an error.

**Q:** What happens when two Flex rules match the exact same number of characters?  
**A:** Flex breaks the tie by selecting the rule that appears *first in the specification file*. This is why keywords must always be defined before the generic identifier rule.

**Q:** How does Bison handle the classical "Dangling-Else" ambiguity?  
**A:** The dangling-else grammar has a shift/reduce conflict when encountering `else`: it can either shift `else` (binding it to the inner `if`) or reduce the inner `if` statement (binding `else` to the outer `if`). In `parser.y`, we resolved this using precedence tokens `%nonassoc LOWER_THAN_ELSE` and `%nonassoc TOK_ELSE`, instructing Bison to shift `else`, which adheres to standard C language semantics.

**Q:** How does `scanner.l` maintain accurate column numbers across multi-character tokens and tabs?  
**A:** We define `YY_USER_ACTION` / `update_loc()` which assigns `yylloc.first_column = current_column` and increments `current_column += yyleng` for every matched token. When a newline `\n` is encountered, `current_line` is incremented and `current_column` resets to 1.

**Q:** What was the result of running the verification test suite on the Member 1 frontend?  
**A:** All 6 test cases passed:
1. `test_simple.c`: Validated basic arithmetic, variable declarations, and return statements.
2. `test_branch.c`: Validated nested `if-else` control flow.
3. `test_loop.c`: Validated `while` loop conditions and body parsing.
4. `test_sanitize.c`: Validated calls to security functions (`read_input`, `sanitize`, `execute_query`).
5. `test_collision.c`: Confirmed zero lexical collisions for identifiers starting with keyword prefixes (`boolean_status`, `internal_counter`) and adjacent operators (`==`, `!=`, `<=`, `>=`).
6. `test_invalid.c`: Confirmed that illegal characters (`@`, `$`) trigger fail-closed diagnostics with exact line and column numbers.

---

# Development Log - Session 3 (Day 3)

## 1. What Was Built Today (High-Level Summary)
Completed **Member 1 Phase 2 (Frontend & Middle-End Lowering)**:
- **AST Synthesis Engine** (`compiler_core/src/ast.h`, `ast.c`): In-memory tree allocators with full recursive destruction (`ast_free`), tree inspection (`ast_print`), and JSON serialization (`ast_to_json`).
- **Bison Parser Integration** (`compiler_core/src/parser.y`): Wired semantic reduction rules in Bison to build the AST in-memory with zero shift/reduce and zero reduce/reduce conflicts.
- **Three-Address Code (TAC) Engine** (`compiler_core/src/tac.h`, `tac.c`): Implemented Syntax-Directed Translation (SDT) lowering the AST into linear quadruples (`op`, `arg1`, `arg2`, `result`) with deterministic temporary ($t_0, t_1, \dots$) and jump label ($L_0, L_1, \dots$) allocation.
- **Dragon Book Leader Partitioning & CFG Synthesizer** (`compiler_core/src/cfg.h`, `cfg.c`): Implemented the textbook 3-rule leader partitioning algorithm to isolate basic blocks ($B_0, B_1, \dots$) and synthesized directed control-flow edges (`TRUE_BRANCH`, `FALSE_BRANCH`, `UNCONDITIONAL`).
- **JSON Serializer** (`compiler_core/src/json_emit.h`, `json_emit.c`): Formatted and validated emission of `CFG.json` matching the frozen contract.
- **CLI & Test Harness Upgrade** (`compiler_core/src/main.c`, `scripts/run_tests.ps1`): Added `--cfg`, `--ast`, `--tac`, and `-o` CLI options. Validated that all 6 unit tests and 4 benchmark examples pass with 100% success (10/10 tests passing). Emitted valid `CFG.json` for `clean_flow.c`, satisfying **Milestone Acceptance Gate 2**.

## 2. Significance & Engineering Purpose
This session completes the entire compiler middle-end. While Phase 1 guaranteed that syntax is valid, Phase 2 bridges the semantic gap between high-level structured programming (nested `if`, `while` loops, expressions) and low-level control-flow graphs required for monotone data-flow analysis.

By lowering the AST to Three-Address Code and partitioning it into Basic Blocks via the canonical Dragon Book algorithm:
- Complex nested expressions are linearized into simple atomic binary quadruples.
- Control-flow jumps are made explicit with labels and branch instructions.
- The control flow graph explicitly defines predecessor and successor sets for every block, giving Member 2's fixpoint solver the exact mathematical topology needed to compute taint lattices ($IN, OUT, GEN, KILL$).

## 3. Core Code Concepts Explained Simply

**Key Functions & Architectural Elements:**
- `ast_create_node()` / `ast_add_child()` (`ast.c`) — Dynamically allocates AST nodes and child pointer arrays with checked heap allocation and safe string cloning (`safe_strdup`).
- `ast_free()` (`ast.c`) — Recursively traverses the tree in post-order, freeing all node attributes, child arrays, and nodes to guarantee zero memory leaks.
- `tac_lower_ast()` / `lower_expr()` / `lower_stmt()` (`tac.c`) — Syntax-Directed Translation routines that traverse the AST:
  - For binary expressions: recursively lowers operands, generates temporary $t_i$, and emits `TAC_OP, left, right, ti`.
  - For conditionals (`if`): evaluates condition, emits `IF_FALSE cond L_else`, lowers then-branch, emits `GOTO L_merge`, emits `LABEL L_else`, lowers else-branch, emits `LABEL L_merge`.
  - For loops (`while`): emits `LABEL L_head`, evaluates condition, emits `IF_FALSE cond L_exit`, lowers body, emits `GOTO L_head`, emits `LABEL L_exit`.
- `cfg_build_from_tac()` (`cfg.c`) — Executes Dragon Book 3-Rule Leader Partitioning over linear TAC quadruples:
  1. Instruction 0 is a leader.
  2. Any target of a jump (`IF_FALSE`, `IF_TRUE`, `GOTO`) is a leader.
  3. Any instruction immediately following a jump or return is a leader.
- `cfg_add_edge()` (`cfg.c`) — Links directed predecessor/successor edges and tags edge types (`TRUE_BRANCH`, `FALSE_BRANCH`, `UNCONDITIONAL`).
- `json_emit_cfg()` (`json_emit.c`) — Serializes the graph topology into clean, valid `CFG.json` without trailing commas.

**Time & Space Complexity:**
- **AST Construction**: $\mathcal{O}(M)$ time and $\mathcal{O}(M)$ space, where $M$ is the number of tokens in the program.
- **TAC Lowering (SDT)**: $\mathcal{O}(A)$ time where $A$ is the number of AST nodes, visiting each node in a single post-order traversal. Emits $\mathcal{O}(A)$ quadruples.
- **Leader Partitioning & CFG Construction**: $\mathcal{O}(K)$ time where $K$ is the number of TAC instructions. Scanning instructions and mapping labels is linear $\mathcal{O}(K)$, creating blocks and edges in $\mathcal{O}(|B| + |E|)$ time.
- **Space Complexity**: $\mathcal{O}(K)$ storing linear TAC instructions and basic block node/edge adjacency structures.

**Why Not the Naive Way?**
- *Naive CFG Construction*: Naively splitting blocks based on arbitrary semicolons or curly braces creates malformed blocks where jumps occur in the middle of a block.
- *Why Dragon Book Leaders are Essential*: By definition, a Basic Block must have a single entry point (the leader) and a single exit point (the terminator jump/return). The 3-rule leader algorithm guarantees that if the first instruction of a block executes, all instructions within that block execute sequentially without branching out or being jumped into mid-block.

## 4. Viva / Interview Quick-Check

**Q:** What is Three-Address Code (TAC), and why is it preferred over the raw AST for data-flow analysis?  
**A:** TAC is an intermediate representation where every instruction has at most one operator and at most three address operands (e.g., $x = y \text{ op } z$). While an AST represents nested hierarchical syntax, TAC linearizes computation and makes all temporary values, branches, and control flow transfers explicit, which is necessary for computing basic block transfer equations.

**Q:** State the three canonical rules for identifying basic block leaders (Dragon Book Algorithm).  
**A:**
1. **Rule 1**: The first instruction of the intermediate code is a leader.
2. **Rule 2**: Any instruction that is the target of a conditional or unconditional jump is a leader.
3. **Rule 3**: Any instruction that immediately follows a conditional or unconditional jump (or return) is a leader.

**Q:** How are predecessor and successor edges determined when a block ends with an `IF_FALSE` instruction?  
**A:** When block $B_i$ ends with `IF_FALSE cond L_target`:
- The **False Branch** edge connects $B_i \to B_{\text{target}}$ (where $B_{\text{target}}$ is the block with label `L_target`), tagged with `EDGE_FALSE_BRANCH`.
- The **True Branch** edge connects $B_i \to B_{i+1}$ (the sequential fall-through block), tagged with `EDGE_TRUE_BRANCH`.

**Q:** How does `tac_lower_ast` handle a `while` loop to guarantee correct control-flow cycles?  
**A:** It emits:
1. `LABEL L_head` (marking loop entry leader).
2. Condition evaluation into temporary $t_{\text{cond}}$.
3. `IF_FALSE t_cond L_exit` (exit branch).
4. Lowered statements of loop body.
5. `GOTO L_head` (unconditional back-edge jumping to loop head).
6. `LABEL L_exit` (loop exit leader).  
This creates a cyclic directed graph where the body block has a successor edge pointing back to the header block.

**Q:** What is Milestone Acceptance Gate 2, and how was it verified?  
**A:** Milestone Acceptance Gate 2 requires Member 1's CLI to compile `examples/clean_flow.c` and emit valid `CFG.json`. Running `codeguardian-frontend -o clean_flow.json examples/clean_flow.c` synthesized block $B_0$ with 6 sequential quadruples, which successfully validated against the `CFG.json` JSON schema. Furthermore, all 10 automated test suites passed with 0 errors.

---

# Development Log - Session 4 (Day 4)

## 1. What Was Built Today (High-Level Summary)
Completed **Member 2 Phase 2 (Data-Flow Math Engine, Fixpoint Solver & Auditor)**:
- **Security Rules Engine** (`security_engine/src/rules.js`): Ingestion and validation of `security_rules.json` declaring untrusted Sources (`read_input`, `get_param`), Sanitizers (`sanitize`, `escape_sql`, `html_encode`), and sensitive Sinks mapped to CWE IDs (`execute_query` $\to$ CWE-89 SQLi, `system_exec` $\to$ CWE-78 Command Injection, `render_html` $\to$ CWE-79 XSS).
- **GEN / KILL & Transfer Logic** (`security_engine/src/transfer.js`): Implemented block-level and instruction-level transfer functions. Taint propagates through variable assignments ($x = y$, $x = y \text{ op } z$), is generated on Source calls, and is killed on Sanitizer calls or constant overwrites.
- **Lattice Math Utilities** (`security_engine/src/lattice.js`): Set operations over the powerset lattice $(\mathcal{P}(V), \subseteq)$ supporting union, difference, and subset inclusion checks.
- **Kildall Worklist Fixpoint Solver** (`security_engine/src/solver.js`): Implemented the iterative monotone worklist solver over CFG basic blocks:
  $$IN[B] = \bigcup_{P \in \text{Pred}[B]} OUT[P]$$
  $$OUT[B] = GEN[B] \cup (IN[B] \setminus KILL[B])$$
- **Taint Auditor & Path Tracer** (`security_engine/src/auditor.js`): Evaluates sink instructions against incoming and block-accumulated taint sets, detects vulnerabilities, classifies block statuses (`CLEAN`, `SANITIZED`, `TAINTED`, `VULNERABLE`), reconstructs source-to-sink trace paths, and serializes `Audit.json`.
- **Command-Line Engine** (`security_engine/src/cli.js`): CLI utility reading `CFG.json` from stdin or file and streaming formatted `Audit.json`.
- **Unit Test Suite** (`security_engine/tests/solver.test.js`, `validate.test.js`): Automated verification of lattice monotonicity, fixpoint convergence on branch and loop structures, and contract compliance.

## 2. Significance & Engineering Purpose
While Member 1 partitions code into control-flow topology, Member 2's data-flow solver computes actual semantic reachability of untrusted user input. 
By casting taint tracking as an iterative forward may-analysis over a finite powerset lattice:
- Analysis handles arbitrary branch combinations without path explosion.
- Monotonicity guarantees deterministic convergence to the unique Least Fixed Point (LFP).
- The auditor reconstructs exact execution paths through basic blocks from the origin source statement to the affected sink call.

## 3. Core Code Concepts Explained Simply

**Key Functions & Architectural Elements:**
- `computeBlockGenKill()` (`transfer.js`) — Evaluates all TAC quadruples inside a block sequentially, updating accumulated generated taint and killed variables.
- `solveLattice()` (`solver.js`) — Initializes worklist with all basic blocks, iterates over blocks updating $IN[B]$ and $OUT[B]$. If $OUT[B]$ changes, adds all successors $\text{Succ}[B]$ back to the worklist until the queue is empty.
- `auditBlock()` / `traceVulnerabilityPath()` (`auditor.js`) — Flags any sink quadruple whose argument exists in the block's taint set and backtracks through predecessor blocks to find the generating source instruction.

**Time & Space Complexity:**
- **Worklist Solver**: $\mathcal{O}(|V| \times |E|)$ where $|V|$ is the number of program variables and $|E|$ is the number of CFG edges.
- **Space Complexity**: $\mathcal{O}(|B| \times |V|)$ storing the bitset/hash set of tainted variables for each basic block.

## 4. Viva / Interview Quick-Check

**Q:** Why does an assignment $x = \text{const}$ act as a $KILL$ for variable $x$?  
**A:** In data-flow analysis, overwriting a variable with a safe constant or independent literal destroys any previous data dependency on untrusted input, removing $x$ from the active taint set.

**Q:** Why is the worklist algorithm more efficient than naive round-robin iteration over all blocks?  
**A:** Naive round-robin re-evaluates every block in the program on every iteration $\mathcal{O}(|B|)$ times. The worklist algorithm only re-evaluates a block when at least one of its predecessor blocks has actually changed its $OUT$ set, skipping unaffected subgraphs.

---

# Development Log - Session 5 (Day 5)

## 1. What Was Built Today (High-Level Summary)
Completed **Phase 3 (Integration & HTTP Gateway)** and **Phase 4 (Interactive Cytoscape.js Dashboard)**:
- **Compiler Bridge** (`security_engine/src/compile.js`): In-memory execution bridge invoking `codeguardian-frontend` with byte-for-byte source piping, strict timeouts, subprocess memory limits, and structured diagnostic parsing (line/column numbers).
- **HTTP Analysis Gateway** (`security_engine/src/server.js`): Zero-dependency Node.js HTTP server (`node:http`) on port 8787:
  - `POST /api/analyze`: Accepts `{ "source": "<Mini-C>" }` or `{ "cfg": { ... } }`, returning compiled CFG, computed `Audit.json`, and performance metadata.
  - `GET /api/examples`: Serves standard test cases (`clean_flow.c`, `sql_injection.c`, `command_injection.c`, `complex_loop.c`).
  - `GET /health`: Health and compiler readiness probe.
- **Interactive React Dashboard** (`dashboard/`): Modern Vite + React 18 single-page application:
  - `dashboard/src/App.jsx`: Dual-pane cybersecurity terminal interface with sample selector, source code editor, CFG JSON inspector, audit finding cards, block detail drawer, and live analysis dispatch.
  - `dashboard/src/Graph.jsx`: Cytoscape.js interactive graph canvas using `cytoscape-dagre` layout. Renders blocks as rounded cards with block IDs and TAC previews, colored by security status (Emerald Green for Clean, Cyan for Sanitized, Amber for Tainted, Crimson Red for Vulnerable).
  - **Taint Path Highlighting**: Dynamically styles edges and blocks along the vulnerable source-to-sink path with an animated crimson glow upon clicking a vulnerability card.
- **End-to-End Pipeline & Integration Tests** (`security_engine/tests/server.test.js`, `pipeline.test.js`): Verified end-to-end execution of all 4 canonical CWE scenarios across CLI and HTTP interfaces, satisfying **Milestone Acceptance Gate 3** and **Gate 4**.

## 2. Significance & Engineering Purpose
This milestone completes the full end-to-end integration of CodeGuardian. The compiler frontend, data-flow security engine, HTTP gateway, and visual dashboard now operate as a unified, production-ready developer tool. 

Evaluators and developers can write or paste Mini-C source code, execute analysis in sub-second time, and visually observe the control flow topology and vulnerability propagation paths directly on the interactive graph canvas.

## 3. Core Code Concepts Explained Simply

**Key Functions & Architectural Elements:**
- `compileSource()` (`compile.js`) — Spawns `codeguardian-frontend` with temporary file/stdin piping and converts syntax errors into structured HTTP 422 diagnostics.
- `createHttpServer()` (`server.js`) — Implements lightweight JSON routing, CORS headers for local dashboard origins, payload limit checks (1 MiB), and deterministic responses.
- `CytoscapeComponent` (`Graph.jsx`) — Initializes Cytoscape instance, mounts Dagre layout, maps block statuses to terminal color tokens, and applies highlighted styles to nodes/edges along `taintPath`.
- `App.jsx` — Manages state for selected example, source code, CFG graph data, active audit findings, and selected block drawer.

## 4. Viva / Interview Quick-Check

**Q:** How does the dashboard visually differentiate a clean program from a vulnerable one?  
**A:** In a clean program (e.g. `clean_flow.c`), all blocks remain emerald green or cyan (sanitized), and no red warning indicators are displayed. When a vulnerability is detected (e.g. `command_injection.c`), the affected sink block turns crimson red, finding cards detail the CWE ID and remediation steps, and clicking the finding animates the exact traversal path ($B_0 \to B_2 \to B_3$) with a crimson stroke.

**Q:** Why is the compiler bridge decoupled from the HTTP gateway using standard process boundaries?  
**A:** Decoupling via subprocess execution guarantees process isolation: if a malformed source file causes a segmentation fault or memory exhaustion in native code, the HTTP server catches the process exit code fail-closed without crashing the gateway or dashboard.

---

# Development Log - Session 6 (Day 6)

## 1. What Was Built Today (High-Level Summary)
Completed **Member 1 & Shared Phase 5 (Verification, Benchmarking & Course Presentation Packaging)**:
- **Performance Benchmarking Suite** (`scripts/benchmark.ps1`):
  - Automated stopwatch-instrumented benchmark runner executing multiple iterations across all 4 canonical programs (`clean_flow.c`, `sql_injection.c`, `command_injection.c`, `complex_loop.c`).
  - Separates front-end lowering latency (Flex + Bison + TAC + CFG) from security engine latency (Ajv validation + Kildall worklist fixpoint + path tracing).
  - Validates PRD NFR-02 SLA (< 300 ms end-to-end execution budget).
  - Automatically emits markdown report at `DOC/Benchmark_Report.md`.
- **Master 5-Stage System Verification Suite** (`scripts/verify_all.ps1`):
  - Single-command orchestration verifying all 5 Milestone Acceptance Gates:
    1. Stage 1: Compiler core unit tests & lexer/parser tests (Gate 1 & 2).
    2. Stage 2: Security engine & fixpoint solver test suite (62/62 passing) (Gate 2 & 3).
    3. Stage 3: Direct end-to-end CLI pipeline (`frontend | engine`) (Gate 3).
    4. Stage 4: Dashboard production bundle build with Vite (Gate 4).
    5. Stage 5: End-to-end performance latency benchmarks (Gate 5).
- **Academic Viva Defense & Syllabus Mapping Guide** (`DOC/Viva_Preparation_Guide.md`):
  - Formal academic documentation connecting each BCSE307L / BCSE307P syllabus module (Lexical Analysis, LALR(1) Parsing, SDT, Intermediate Code Generation, Basic Block Leaders, Data-Flow Lattice Math, Application Security) directly to CodeGuardian's source code files.
  - Comprehensive 20-question oral exam Q&A bank with theoretical and code-level answers.

## 2. Significance & Engineering Purpose
Phase 5 ensures that CodeGuardian is not merely a collection of working modules, but a rigorously benchmarked, mathematically verified, and academically defensible static analysis platform.

With an end-to-end pipeline latency of ~200 ms (surpassing the 300 ms SLA with ~100 ms of margin) and all 5 Acceptance Gates passing in 9.6 seconds, the repository is turnkey-ready for course evaluators, live reviews, and developer deployment.

## 3. Core Code Concepts Explained Simply

**Key Functions & Architectural Elements:**
- `scripts/benchmark.ps1` — Uses high-resolution system timers (`System.Diagnostics.Stopwatch`), eliminates warm-up process-spawn caching artifacts, averages multiple runs, and writes `DOC/Benchmark_Report.md`.
- `scripts/verify_all.ps1` — Orchestrates the complete multi-language verification suite (C11, Node.js, React/Vite) fail-closed, ensuring any regression in grammar, solver, or UI is caught immediately.
- `DOC/Benchmark_Report.md` — Quantitative proof that CodeGuardian fulfills PRD NFR-02 SLA across all CWE test cases.

## 4. Viva / Interview Quick-Check

**Q:** What was the measured end-to-end execution speed of CodeGuardian, and how does it compare to the PRD requirement?  
**A:** PRD NFR-02 set an SLA budget of < 300 ms for small-to-medium source programs. Benchmarking across all scenarios demonstrated an average total execution time of **~200 ms** (Frontend ~25 ms + Security Engine ~175 ms), leaving approximately **100 ms of safety buffer**.

**Q:** How does `scripts/verify_all.ps1` guarantee reproducibility for academic reviewers?  
**A:** Reviewers run a single command (`powershell -File scripts/verify_all.ps1`) which deterministically exercises the C11 compiler frontend, the 62 Node.js test cases, the CLI pipeline, the Vite production build, and the timing benchmarks, confirming that all 5 Acceptance Gates pass without manual intervention.

---

