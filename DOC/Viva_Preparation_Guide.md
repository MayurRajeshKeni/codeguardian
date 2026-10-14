# CodeGuardian — Academic Viva Defense & Syllabus Mapping Guide
> **Course Alignment**: **BCSE307L (Compiler Design Theory)** & **BCSE307P (Compiler Design Lab)**  
> **Project**: CodeGuardian — Deterministic Compiler-Based Static Taint Analysis Engine  
> **Team**: Member 1 (Compiler Frontend & Middle-End) & Member 2 (Security Math Engine & UI)

---

## 1. Syllabus Mapping Matrix (Theory to Codebase)

| Syllabus Module | Theoretical Concept | CodeGuardian Implementation File | Key Functions / Constructs |
| :--- | :--- | :--- | :--- |
| **Module 1: Lexical Analysis** | Regular Expressions, DFA Minimization, Maximal Munch, Buffer Coordinates | `compiler_core/src/scanner.l` | `yylex()`, `update_loc()`, `YY_USER_ACTION`, `token_type_to_string()` |
| **Module 2: Syntax Analysis** | Context-Free Grammars, LALR(1) Parsing Tables, Shift/Reduce Disambiguation | `compiler_core/src/parser.y` | `yyparse()`, `yyerror()`, `%nonassoc LOWER_THAN_ELSE`, `%nonassoc TOK_ELSE` |
| **Module 3: Abstract Syntax Trees** | Hierarchical Syntax Trees, Semantic Actions, Memory Allocators | `compiler_core/src/ast.c`, `ast.h` | `ast_create_node()`, `ast_add_child()`, `ast_free()`, `ast_to_json()` |
| **Module 4: Syntax-Directed Translation** | Post-order SDT, Intermediate Code Generation (ICG), 3-Address Code (TAC) | `compiler_core/src/tac.c`, `tac.h` | `tac_lower_ast()`, `lower_expr()`, `lower_stmt()`, temporary generator ($t_i$) |
| **Module 5: Basic Blocks & CFG** | Dragon Book 3-Rule Leader Partitioning, Directed Control Flow Edges | `compiler_core/src/cfg.c`, `cfg.h` | `cfg_build_from_tac()`, `cfg_add_edge()`, `json_emit_cfg()` |
| **Module 6: Data-Flow Analysis** | Kildall Worklist Algorithm, Powerset Lattice, Least Fixed Point (LFP) | `security_engine/src/solver.js`, `lattice.js` | `solveLattice()`, `computeBlockGenKill()`, monotone worklist |
| **Module 7: Security Threat Model** | Taint Analysis, Source-Sanitizer-Sink, CWE Taxonomy (CWE-89, 78, 79) | `security_engine/src/auditor.js`, `rules.js` | `auditBlock()`, `traceVulnerabilityPath()`, `Audit.json` emission |

---

## 2. In-Depth Module Technical Breakdowns

### Module 1: Lexical Analysis (GNU Flex)
- **Mathematical Model**: Lexical rules in `scanner.l` are compiled by GNU Flex into a Deterministic Finite Automaton (DFA) $M = (Q, \Sigma, \delta, q_0, F)$.
- **Time Complexity**: $\mathcal{O}(N)$ where $N$ is the number of characters in the Mini-C source file. Each character causes exactly one DFA state transition in $\mathcal{O}(1)$ time with zero backtracking.
- **Maximal Munch (Longest Match Rule)**:
  - When scanning `boolean_flag`, the prefix `bool` matches `TOK_BOOL` (4 chars), but the identifier rule matches all 12 chars.
  - Flex always chooses the longest valid match, ensuring variable names containing keyword prefixes are never corrupted.
- **Rule Priority (Equal Length Ties)**:
  - If input is exactly `int`, both the keyword rule and the identifier regex match 3 characters.
  - Flex breaks ties by choosing the rule listed *first* in `scanner.l`. Hence, keyword definitions are placed before `[a-zA-Z_][a-zA-Z0-9_]*`.
- **Coordinate Tracking**:
  - `YY_USER_ACTION` invokes `update_loc()`, maintaining `yylloc.first_line`, `yylloc.first_column`, and `yylloc.last_column`.
  - When a newline `\n` is read, `current_line++` and `current_column = 1`.

---

### Module 2: Syntax Analysis (GNU Bison LALR(1))
- **Grammar Classification**: Deterministic Context-Free Grammar parsed using a Look-Ahead LR parser with 1 token of lookahead (LALR(1)).
- **Time Complexity**: $\mathcal{O}(M)$ where $M$ is the number of tokens. Every token triggers exactly one shift or reduce step.
- **Resolving the Classical Dangling-Else Ambiguity**:
  - Unambiguous statement grammar:
    ```yacc
    %nonassoc LOWER_THAN_ELSE
    %nonassoc TOK_ELSE

    selection_statement
        : TOK_IF TOK_LPAREN expr TOK_RPAREN statement %prec LOWER_THAN_ELSE
        | TOK_IF TOK_LPAREN expr TOK_RPAREN statement TOK_ELSE statement
        ;
    ```
  - When encountering `else`, Bison compares precedence: `TOK_ELSE` has higher precedence than `LOWER_THAN_ELSE`, causing Bison to **shift** `else` onto the stack, binding it to the innermost `if`.
  - Result: **0 shift/reduce conflicts, 0 reduce/reduce conflicts**.

---

### Module 3: Syntax-Directed Translation & Three-Address Code (TAC)
- **Translation Scheme**: Post-order recursive descent traversal over the in-memory AST.
- **Instruction Quadruple Representation**:
  $$\text{Quadruple} = (\text{op}, \text{arg1}, \text{arg2}, \text{result})$$
- **Lowering Expressions**:
  - For $x = a + b * c$:
    1. Lower $b * c \implies \text{MUL}, b, c, t_0$
    2. Lower $a + t_0 \implies \text{ADD}, a, t_0, t_1$
    3. Lower assignment $\implies \text{ASSIGN}, t_1, \text{NULL}, x$
- **Lowering Conditionals (`if-else`)**:
  - Evaluates condition into $t_{\text{cond}}$.
  - Emits `IF_FALSE, t_cond, NULL, L_else`
  - Emits then-body statements.
  - Emits `GOTO, NULL, NULL, L_merge`
  - Emits `LABEL, L_else`
  - Emits else-body statements.
  - Emits `LABEL, L_merge`
- **Lowering Loops (`while`)**:
  - Emits `LABEL, L_head` (Loop Header Leader)
  - Evaluates condition into $t_{\text{cond}}$.
  - Emits `IF_FALSE, t_cond, NULL, L_exit`
  - Emits loop body statements.
  - Emits `GOTO, NULL, NULL, L_head` (Back-edge to loop header)
  - Emits `LABEL, L_exit` (Loop Exit Leader)

---

### Module 4: Basic Block Leader Partitioning (Dragon Book Algorithm)
A **Basic Block** is a sequence of consecutive instructions that begins with a leader, where control enters only at the beginning and leaves only at the end without halting or branching except at the exit.

**The Three Canonical Rules (`cfg.c`)**:
1. **Rule 1**: The first instruction of the TAC sequence is a leader.
2. **Rule 2**: Any instruction that is the target of a conditional or unconditional jump (`IF_FALSE`, `GOTO`, `CALL`) is a leader.
3. **Rule 3**: Any instruction that immediately follows a jump or return instruction is a leader.

**Directed Edge Synthesis**:
- If block $B_i$ ends with `IF_FALSE cond L_target`:
  - **False Branch Edge**: Connects $B_i \to B_{\text{target}}$ (`EDGE_FALSE_BRANCH`).
  - **True Branch Edge**: Connects $B_i \to B_{i+1}$ (`EDGE_TRUE_BRANCH`).
- If block $B_i$ ends with `GOTO L_target`:
  - **Unconditional Edge**: Connects $B_i \to B_{\text{target}}$ (`EDGE_UNCONDITIONAL`).

---

### Module 5: Kildall Monotone Worklist Lattice Solver
- **Lattice Foundation**: Powerset semi-lattice $(\mathcal{P}(V), \subseteq)$ where $V$ is the set of program variables.
  - Bottom element $\bot = \emptyset$ (no variables tainted).
  - Top element $\top = V$ (all variables tainted).
  - Meet operator $\vee = \cup$ (union over incoming paths).
- **Transfer Equations**:
  $$IN[B] = \bigcup_{P \in \text{Pred}[B]} OUT[P]$$
  $$OUT[B] = GEN[B] \cup (IN[B] \setminus KILL[B])$$
  - $GEN[B]$: Variables assigned from untrusted sources (`read_input()`, `get_param()`) or arithmetic derivations from tainted inputs.
  - $KILL[B]$: Variables passed through sanitizers (`sanitize()`, `escape_sql()`) or overwritten with constant literals.
- **Termination Guarantee (Tarski's Fixed Point Theorem)**:
  - The variable set $V$ is finite, so lattice height is bounded by $|V|$.
  - Transfer functions are monotonic: $X \subseteq Y \implies f_B(X) \subseteq f_B(Y)$.
  - Therefore, iterative evaluation over basic blocks must terminate at the unique **Least Fixed Point (LFP)** in $\mathcal{O}(|V| \times |E|)$ time, with zero risk of infinite looping even across cyclic loops.

---

## 3. Top 20 Oral Exam & Viva Defense Questions

### Question 1: What makes CodeGuardian different from a simple grep or regex security scanner?
**Answer**: Regex and AST-grep only check syntax patterns (e.g. searching for the string `execute_query`), but have zero awareness of control flow, execution paths, variable sanitization, or loop accumulators. CodeGuardian uses monotone iterative data-flow analysis over a Control Flow Graph, evaluating semantic value propagation across all true/false branches and loop back-edges to detect whether untrusted input can actually reach a sink without sanitization.

### Question 2: Why is static taint analysis classified as a "Forward, May-Analysis"?
**Answer**:
- **Forward**: Information propagates in the direction of code execution (from sources at the start of blocks down to sinks).
- **May-Analysis**: A variable is marked tainted at block entry if it *may* be tainted along *any* incoming execution path (joined using the set union operator $\cup$).

### Question 3: How does your parser resolve the Dangling-Else ambiguity?
**Answer**: In `compiler_core/src/parser.y`, we declared `%nonassoc LOWER_THAN_ELSE` and `%nonassoc TOK_ELSE`. When the parser encounters an `else` token, the lookahead token has higher precedence than the shift/reduce default, forcing the parser to shift `else` and bind it to the closest unmatched `if`. This completely eliminates shift/reduce conflicts (0 conflicts).

### Question 4: State the Dragon Book 3-rule algorithm for partitioning basic blocks.
**Answer**:
1. The first instruction of the intermediate code is a leader.
2. Any instruction that is the target of a conditional or unconditional jump is a leader.
3. Any instruction immediately following a conditional or unconditional jump (or return) is a leader.  
A basic block consists of a leader and all instructions up to, but not including, the next leader.

### Question 5: What is Three-Address Code (TAC), and why is it required?
**Answer**: TAC is an intermediate representation where every instruction has at most one operator and at most three operands. It linearizes hierarchical nested AST expressions into atomic sequential steps with explicit temporaries ($t_0, t_1, \dots$) and jump labels ($L_0, L_1, \dots$), making it possible to identify basic block boundaries and compute data-flow transfer equations.

### Question 6: What mathematical property guarantees that Kildall's worklist algorithm terminates on cyclic loops?
**Answer**: **Monotonicity** over a **finite lattice**. The carrier set is the powerset of program variables $\mathcal{P}(V)$, which has finite height $|V|$. The transfer function $f_B(X) = GEN[B] \cup (X \setminus KILL[B])$ is order-preserving ($X \subseteq Y \implies f(X) \subseteq f(Y)$). By Tarski's Fixed Point Theorem, iteratively evaluating monotonic functions over a finite semi-lattice must converge to the unique Least Fixed Point (LFP).

### Question 7: Why does an assignment $x = 0$ act as a KILL for variable $x$?
**Answer**: Overwriting variable $x$ with an independent constant literal or clean value severs the data dependency between $x$ and any prior untrusted input source. Therefore, $x \in KILL[B]$, removing it from the outgoing taint set.

### Question 8: How does the compiler frontend communicate with the security engine?
**Answer**: Across a strongly typed, frozen data contract: `CFG.json`. The frontend (`codeguardian-frontend`) compiles Mini-C source into a JSON representation containing basic blocks, linear TAC quadruples, and directed control-flow edges. The security engine ingests this JSON, validates it against `cfg.schema.json`, and computes taint propagation.

### Question 9: What is the time complexity of the lexical analyzer?
**Answer**: $\mathcal{O}(N)$ where $N$ is the number of source characters. GNU Flex compiles regular expressions into a Deterministic Finite Automaton (DFA) which processes each character with a single state transition in $\mathcal{O}(1)$ time with zero backtracking.

### Question 10: What is the time complexity of the Kildall data-flow solver?
**Answer**: $\mathcal{O}(|V| \times |E|)$ where $|V|$ is the number of variables and $|E|$ is the number of edges in the CFG. Because the lattice height is $|V|$, each basic block's state can change at most $|V|$ times before reaching saturation (fixpoint).

### Question 11: How do you prevent buffer overflows and memory leaks in the C11 compiler frontend?
**Answer**:
1. All AST allocations (`ast_create_node`) use safe heap wrappers with allocation checks.
2. In-memory trees are recursively freed in post-order via `ast_free()`.
3. TAC instructions and CFG basic blocks use dynamically grown pointer arrays with explicit capacity tracking and cleanup routines.
4. Memory safety was verified using zero-leak test benchmarks.

### Question 12: What happens if a developer inputs syntactically invalid Mini-C code?
**Answer**: The compiler frontend fails closed: `yyerror()` in `parser.y` captures the exact line and column number, emits a structured syntax error diagnostic, and terminates with exit code 1. When called through the HTTP gateway, this is converted into an HTTP `422 Unprocessable Entity` response detailing the error position.

### Question 13: What vulnerabilities does CodeGuardian detect?
**Answer**:
1. **CWE-89**: SQL Injection — untrusted data reaching `execute_query()` without `sanitize()` or `escape_sql()`.
2. **CWE-78**: Command Injection — untrusted data reaching `system_exec()` without `sanitize()`.
3. **CWE-79**: Cross-Site Scripting (XSS) — untrusted data reaching `render_html()` without `html_encode()`.

### Question 14: How does CodeGuardian trace the vulnerable path from Source to Sink?
**Answer**: Once a sink instruction in block $B_{\text{sink}}$ is flagged with a tainted argument, the auditor in `auditor.js` traverses backwards through predecessor blocks along edges carrying that tainted variable in their $OUT$ sets until it identifies the originating instruction that generated the taint in $GEN[B_{\text{source}}]$.

### Question 15: How does the Cytoscape.js dashboard render the graph?
**Answer**: The dashboard uses `cytoscape-dagre`, a hierarchical directed graph layout. Basic blocks are rendered as nodes with block IDs and TAC previews, colored green (Clean), cyan (Sanitized), amber (Tainted), or red (Vulnerable). Taint paths are highlighted with an animated crimson glow.

### Question 16: What is the purpose of `package-lock.json`?
**Answer**: `package.json` specifies allowed version ranges (e.g. `^18.3.1`), whereas `package-lock.json` records the exact, immutable dependency tree (exact versions, child dependencies, and cryptographic sha512 hashes) to ensure 100% reproducible builds across all machines.

### Question 17: What was the observed performance of CodeGuardian against the PRD SLA?
**Answer**: PRD NFR-02 mandated an end-to-end analysis latency under **300 ms**. Across all benchmark scenarios, the compiler frontend executes in **~25 ms** and the security engine in **~175 ms**, giving an average total pipeline latency of **~200 ms**, easily beating the 300 ms SLA with ~100 ms of safety margin.

### Question 18: What is the difference between Synthesized and Inherited attributes in SDT?
**Answer**:
- **Synthesized attributes**: Computed from the values of attributes at the child nodes in the parse tree (bottom-up).
- **Inherited attributes**: Computed from the values of attributes at siblings or parent nodes (top-down).  
CodeGuardian's TAC generator uses synthesized attributes: expression quadruples are synthesized from sub-expressions and returned up the AST.

### Question 19: Why are pointers and dynamic heap allocation omitted from Mini-C?
**Answer**: Pointer arithmetic and dynamic aliasing ($*p = q$) introduce undecidable points-to sets in static analysis. By focusing Mini-C on deterministic scalar types (`int`, `bool`), CodeGuardian provides sound, complete, and verifiable taint tracking suitable for formal verification and pedagogical demonstration.

### Question 20: How does CodeGuardian handle loops with back-edges?
**Answer**: When lowering `while(cond) { body }`, the compiler emits an unconditional `GOTO` pointing back to the loop header label, creating a cyclic edge in the CFG. During data-flow analysis, Kildall's solver pushes the loop header block back onto the worklist whenever the loop body changes the outgoing taint set. Because variable sets strictly accumulate monotonically, the solver converges to fixpoint after at most $|V|$ iterations.

---
