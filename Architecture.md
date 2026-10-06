# Architecture Specification — CodeGuardian
**Compiler-Based Static Security Analysis Engine**

---

## 1. System Overview & End-to-End Pipeline

CodeGuardian is divided into two decoupled subsystems interacting across strongly typed JSON artifacts:

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
   │    • Validates semantic constraints (symbol declarations & scopes)  │
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
   │    • Identifies leaders (first instr, jump targets, post-jumps)     │
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
   │ 5. INGESTION & DATA-FLOW SOLVER ENGINE (Node.js/Python)              │
   │    • Parses CFG.json into an in-memory directed graph               │
   │    • Computes GEN and KILL bitsets/sets for each instruction & block │
   │    • Solves Kildall iterative worklist fixpoint equations           │
   │    • Traces taint propagation paths from Source to Sink             │
   │    • Serializes findings to Audit.json                              │
   └──────────────────────────────────┬──────────────────────────────────┘
                                      │
                            Emits Audit.json
                                      │
                                      ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │ 6. REACT + CYTOSCAPE.JS INTERACTIVE DASHBOARD                       │
   │    • Dual-pane UI: Source Editor (left) & CFG Canvas (right)        │
   │    • Renders nodes color-coded: Green (clean), Red (vulnerable)     │
   │    • Interactive block drawer: inspect TAC, IN/OUT sets, & paths    │
   └─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Hierarchy

```
CD_CodeGuardian/
├── PRD.md                                 # Requirements & syllabus alignment
├── Architecture.md                        # Architecture & data contracts
├── Rules.md                               # Technical guardrails & coding standards
├── Phases.md                              # Roadmap & milestone acceptance tests
├── Design.md                              # Dashboard UI & graph styling spec
├── Memory.md                              # Active state ledger & sync logs
│
├── compiler_core/                         # [Member 1] Front-End & Middle-End
│   ├── CMakeLists.txt                     # Build configuration for C toolchain
│   ├── Makefile                           # Portable fallback build script
│   ├── src/
│   │   ├── scanner.l                      # Flex lexer definition
│   │   ├── parser.y                       # Bison LALR(1) grammar definition
│   │   ├── ast.h                          # AST node structures & enum definitions
│   │   ├── ast.c                          # AST constructor & JSON serializer
│   │   ├── tac.h                          # TAC Quadruple structures & ops
│   │   ├── tac.c                          # SDT lowering routines (AST -> TAC)
│   │   ├── cfg.h                          # Basic block & CFG graph structures
│   │   ├── cfg.c                          # Leader partitioning & edge synthesizer
│   │   ├── json_emit.h                    # JSON serialization helper
│   │   ├── json_emit.c                    # Serializer for AST.json and CFG.json
│   │   └── main.c                         # Compiler CLI entry point
│   └── tests/                             # Unit tests for Member 1
│       ├── test_simple.c
│       ├── test_branch.c
│       ├── test_loop.c
│       └── test_sanitize.c
│
├── security_engine/                       # [Member 2] Security Intelligence & Solver
│   ├── package.json (or pyproject.toml)   # Backend dependencies
│   ├── src/
│   │   ├── solver.js (or solver.py)       # Kildall fixpoint worklist solver
│   │   ├── lattice.js                     # Powerset taint lattice implementation
│   │   ├── security_rules.json            # Definitions of Sources, Sanitizers, Sinks
│   │   ├── auditor.js                     # Vulnerability trace synthesizer
│   │   └── server.js (or app.py)          # REST API serving CFG & Audit data
│   └── tests/                             # Verification tests for solver
│       └── solver.test.js
│
├── dashboard/                             # [Member 2] Visual Interface
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── App.jsx
│       ├── index.css                      # Global dark terminal theme styling
│       ├── components/
│       │   ├── EditorPane.jsx             # Code editor & sample selector
│       │   ├── GraphCanvas.jsx            # Cytoscape.js directed graph renderer
│       │   ├── BlockDetailDrawer.jsx      # Inspects TAC, IN/OUT sets of clicked block
│       │   └── VulnerabilityList.jsx      # High-severity alert list with trace paths
│       └── utils/
│           └── graphLayout.js             # Dagre/Klay layout configurations
│
└── examples/                              # Shared Test Bench
    ├── clean_flow.c                       # Sanitized input (Clean)
    ├── sql_injection.c                    # Tainted source directly hitting query (CWE-89)
    ├── command_injection.c                # Unsanitized input hitting system_exec (CWE-78)
    └── complex_loop.c                     # Multi-iteration loop taint propagation
```

---

## 3. Data Contracts & JSON Schemas

All subsystems communicate strictly via structured JSON. Loose schemas, missing fields, or ad-hoc representations are strictly forbidden.

### 3.1 `AST.json` (Syntax Tree Contract)

Generated optionally by Member 1 during parsing.

```json
{
  "nodeType": "Program",
  "children": [
    {
      "nodeType": "FunctionDecl",
      "name": "main",
      "returnType": "int",
      "body": {
        "nodeType": "Block",
        "statements": [
          {
            "nodeType": "VarDecl",
            "varType": "int",
            "name": "x",
            "init": null,
            "line": 3
          },
          {
            "nodeType": "AssignExpr",
            "target": "x",
            "value": {
              "nodeType": "CallExpr",
              "function": "read_input",
              "args": [],
              "line": 4
            },
            "line": 4
          }
        ]
      }
    }
  ]
}
```

### 3.2 `CFG.json` (Control Flow Graph Contract)

The primary interface emitted by Member 1's `codeguardian-frontend` and consumed by Member 2.

```json
{
  "version": "1.0",
  "entryBlock": "B0",
  "exitBlock": "B4",
  "variables": ["x", "y", "t0", "t1"],
  "blocks": [
    {
      "id": "B0",
      "label": "Entry Block",
      "instructions": [
        {
          "index": 0,
          "op": "CALL",
          "arg1": "read_input",
          "arg2": null,
          "result": "t0",
          "line": 4
        },
        {
          "index": 1,
          "op": "ASSIGN",
          "arg1": "t0",
          "arg2": null,
          "result": "x",
          "line": 4
        },
        {
          "index": 2,
          "op": "GT",
          "arg1": "x",
          "arg2": "10",
          "result": "t1",
          "line": 5
        },
        {
          "index": 3,
          "op": "IF_FALSE",
          "arg1": "t1",
          "arg2": null,
          "result": "L1",
          "line": 5
        }
      ],
      "predecessors": [],
      "successors": ["B1", "B2"]
    },
    {
      "id": "B1",
      "label": "Then Branch",
      "instructions": [
        {
          "index": 4,
          "op": "CALL",
          "arg1": "sanitize",
          "arg2": "x",
          "result": "x",
          "line": 6
        },
        {
          "index": 5,
          "op": "GOTO",
          "arg1": null,
          "arg2": null,
          "result": "L2",
          "line": 7
        }
      ],
      "predecessors": ["B0"],
      "successors": ["B3"]
    },
    {
      "id": "B2",
      "label": "Else Branch",
      "instructions": [
        {
          "index": 6,
          "op": "NOP",
          "arg1": null,
          "arg2": null,
          "result": null,
          "line": 8
        }
      ],
      "predecessors": ["B0"],
      "successors": ["B3"]
    },
    {
      "id": "B3",
      "label": "Merge Block",
      "instructions": [
        {
          "index": 7,
          "op": "CALL",
          "arg1": "execute_query",
          "arg2": "x",
          "result": null,
          "line": 9
        }
      ],
      "predecessors": ["B1", "B2"],
      "successors": ["B4"]
    },
    {
      "id": "B4",
      "label": "Exit Block",
      "instructions": [
        {
          "index": 8,
          "op": "RETURN",
          "arg1": "0",
          "arg2": null,
          "result": null,
          "line": 10
        }
      ],
      "predecessors": ["B3"],
      "successors": []
    }
  ],
  "edges": [
    { "from": "B0", "to": "B1", "type": "TRUE_BRANCH" },
    { "from": "B0", "to": "B2", "type": "FALSE_BRANCH" },
    { "from": "B1", "to": "B3", "type": "UNCONDITIONAL" },
    { "from": "B2", "to": "B3", "type": "UNCONDITIONAL" },
    { "from": "B3", "to": "B4", "type": "UNCONDITIONAL" }
  ]
}
```

### 3.3 `Audit.json` (Security Findings & Taint Lattice State)

Produced by Member 2's fixpoint engine and sent to the dashboard.

```json
{
  "timestamp": "2026-10-06T23:35:00Z",
  "programSummary": {
    "totalBlocks": 5,
    "totalInstructions": 9,
    "vulnerabilitiesFound": 1
  },
  "latticeStates": {
    "B0": {
      "in": [],
      "gen": ["x", "t0"],
      "kill": [],
      "out": ["x", "t0"]
    },
    "B1": {
      "in": ["x", "t0"],
      "gen": [],
      "kill": ["x"],
      "out": ["t0"]
    },
    "B2": {
      "in": ["x", "t0"],
      "gen": [],
      "kill": [],
      "out": ["x", "t0"]
    },
    "B3": {
      "in": ["x", "t0"],
      "gen": [],
      "kill": [],
      "out": ["x", "t0"]
    },
    "B4": {
      "in": ["x", "t0"],
      "gen": [],
      "kill": [],
      "out": ["x", "t0"]
    }
  },
  "blockStatus": {
    "B0": "TAINTED",
    "B1": "SANITIZED",
    "B2": "TAINTED",
    "B3": "VULNERABLE",
    "B4": "CLEAN"
  },
  "vulnerabilities": [
    {
      "id": "VULN-001",
      "type": "SQL_INJECTION",
      "cwe": "CWE-89",
      "severity": "CRITICAL",
      "variable": "x",
      "sinkInstruction": {
        "block": "B3",
        "instructionIndex": 7,
        "op": "CALL",
        "sinkFunction": "execute_query",
        "taintedArg": "x",
        "line": 9
      },
      "sourceInstruction": {
        "block": "B0",
        "instructionIndex": 0,
        "sourceFunction": "read_input",
        "assignedTo": "x",
        "line": 4
      },
      "taintPath": ["B0", "B2", "B3"],
      "remediation": "Ensure variable 'x' is sanitized along the False branch (B2) prior to invoking 'execute_query'."
    }
  ]
}
```

---

## 4. Mathematical Foundations: Monotone Data-Flow Lattice

The security solver implements Kildall's iterative worklist data-flow algorithm:

### 4.1 Semi-Lattice Definition
- **Carrier Set**: $\mathcal{L} = \mathcal{P}(V)$ (powerset of program variables).
- **Partial Order ($\sqsubseteq$)**: Set inclusion $\subseteq$ (where $\emptyset$ represents Clean / Untainted, and $V$ represents Maximally Tainted).
- **Join / Confluence Operator ($\sqcup$)**: Set union $\bigcup$ (May-analysis: a variable is tainted at the entrance of a block if it is tainted along *any* incoming path).
- **Top Element ($\top$)**: $\emptyset$ (initial baseline before sources fire).
- **Bottom Element ($\bot$)**: $V$ (worst-case all variables tainted).

### 4.2 Transfer Equations
For each basic block $B$:

$$IN[B] = \bigcup_{P \in \text{Pred}[B]} OUT[P]$$

$$OUT[B] = GEN[B] \cup (IN[B] \setminus KILL[B])$$

Where:
- $GEN[B]$: Variables tainted within block $B$ by calling a Source function or copying from an already tainted operand.
- $KILL[B]$: Variables sanitized within block $B$ by passing through a recognized Sanitizer function or overwritten with a constant untainted literal.

### 4.3 Monotone Worklist Algorithm
```
Worklist W = All basic blocks in CFG
Initialize IN[B] = ∅, OUT[B] = ∅ for all B

while W is not empty do:
    pop B from W
    IN[B] = ⋃ { OUT[P] | P ∈ Pred[B] }
    NEW_OUT = GEN[B] ∪ (IN[B] \ KILL[B])
    
    if NEW_OUT ≠ OUT[B] then:
        OUT[B] = NEW_OUT
        for each S ∈ Succ[B] do:
            if S ∉ W then:
                push S onto W
```

Because the carrier set $\mathcal{P}(V)$ is finite and the transfer function $f_B(X) = GEN[B] \cup (X \setminus KILL[B])$ is monotonic ($X \subseteq Y \implies f_B(X) \subseteq f_B(Y)$), the algorithm is mathematically guaranteed to terminate at the unique Least Fixed Point (LFP).

---

## 5. Security Rules Configuration

Stored in `security_engine/src/security_rules.json`:

```json
{
  "sources": [
    { "name": "read_input", "taintsResult": true },
    { "name": "get_param", "taintsResult": true }
  ],
  "sanitizers": [
    { "name": "sanitize", "cleansArgIndex": 0, "cleansResult": true },
    { "name": "escape_sql", "cleansArgIndex": 0, "cleansResult": true },
    { "name": "html_encode", "cleansArgIndex": 0, "cleansResult": true }
  ],
  "sinks": [
    {
      "name": "execute_query",
      "vulnerableArgIndex": 0,
      "cwe": "CWE-89",
      "type": "SQL_INJECTION",
      "severity": "CRITICAL"
    },
    {
      "name": "system_exec",
      "vulnerableArgIndex": 0,
      "cwe": "CWE-78",
      "type": "COMMAND_INJECTION",
      "severity": "CRITICAL"
    },
    {
      "name": "render_output",
      "vulnerableArgIndex": 0,
      "cwe": "CWE-79",
      "type": "XSS",
      "severity": "HIGH"
    }
  ]
}
```