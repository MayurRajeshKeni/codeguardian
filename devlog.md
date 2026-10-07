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
