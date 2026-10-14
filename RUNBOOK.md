# CodeGuardian — Complete System Runbook
> **Cross-Platform Operating Guide for Windows, Linux & macOS**  
> Comprehensive instructions for cloning, building, testing, verifying, and running the CodeGuardian static analysis platform.

---

## 1. System Overview

CodeGuardian consists of three integrated subsystems:
1. **Compiler Core (`compiler_core/`)**: Native C11 binary (`codeguardian-frontend`) using GNU Flex and GNU Bison. Lowers Mini-C into AST, linear Three-Address Code (TAC), and basic blocks, emitting `CFG.json`.
2. **Security Engine & API Gateway (`security_engine/`)**: Node.js data-flow lattice solver implementing Kildall's fixpoint algorithm and an HTTP analysis gateway (`127.0.0.1:8787`).
3. **Interactive Visual Dashboard (`dashboard/`)**: Vite + React 18 + Cytoscape.js application providing interactive graph inspection and dynamic vulnerability trace highlighting (`http://localhost:5173`).

---

## 2. Environment Prerequisites by Operating System

### 🪟 Windows
1. **C Compiler & Toolchain**:
   - Install **MSYS2** (UCRT64 or MINGW64) or **MinGW-w64** with `gcc`, `flex`, `bison`, and `make`.
   - Ensure `gcc.exe`, `flex.exe`, and `bison.exe` are added to your Windows system `PATH`.
2. **Node.js**:
   - Install **Node.js (v18.0+ LTS or v20.0+)** from [nodejs.org](https://nodejs.org/).
   - Verify: `node -v` and `npm -v`.
3. **PowerShell**:
   - PowerShell 5.1+ or PowerShell 7 (default on Windows 10/11).

---

### 🐧 Linux (Ubuntu / Debian / Fedora / Arch)
Install the required compilers, parser generators, and Node.js via your package manager:

- **Ubuntu / Debian**:
  ```bash
  sudo apt update
  sudo apt install -y build-essential gcc flex bison make nodejs npm curl
  ```
- **Fedora / RHEL**:
  ```bash
  sudo dnf install -y gcc flex bison make nodejs npm
  ```
- **Arch Linux**:
  ```bash
  sudo pacman -S --needed base-devel gcc flex bison make nodejs npm
  ```

---

### 🍎 macOS (Apple Silicon M1/M2/M3/M4 & Intel)
Using [Homebrew](https://brew.sh/):
```bash
brew install flex bison make gcc node

# macOS ships with outdated BSD flex/bison; add GNU flex/bison to your PATH:
export PATH="$(brew --prefix bison)/bin:$(brew --prefix flex)/bin:$PATH"
echo 'export PATH="$(brew --prefix bison)/bin:$(brew --prefix flex)/bin:$PATH"' >> ~/.zshrc
```

---

## 3. Step 1: Clone the Repository

```bash
git clone https://github.com/MayurRajeshKeni/codeguardian.git
cd codeguardian
```

---

## 4. Step 2: Build the Compiler Core

Compile the Flex lexer, Bison parser, AST synthesizer, TAC lowerer, and CFG partitioner into the native binary:

### Windows (PowerShell / MSYS2):
```powershell
# Using the automated build & test script:
powershell -ExecutionPolicy Bypass -File scripts/run_tests.ps1

# OR using GNU Make:
make build
```

### Linux / macOS:
```bash
make build
```
*Output Binary*: `compiler_core/bin/codeguardian-frontend` (or `.exe` on Windows).

---

## 5. Step 3: Install Node.js Dependencies

Install dependencies for both the security engine and the dashboard:

```bash
# 1. Security Engine (Ajv validator)
cd security_engine
npm install
cd ..

# 2. React Dashboard (React 18, Vite, Cytoscape, Cytoscape-Dagre)
cd dashboard
npm install
cd ..
```
*(On Linux/macOS, you can simply run `make install` from the root directory).*

---

## 6. Step 4: Run Master Verification (All 5 Gates)

Now that the repository is built and dependencies are installed, run the master automated verification suite. It validates all 5 Acceptance Gates (Compiler Unit Tests, Security Engine Tests, End-to-End CLI Pipe, Dashboard Build, and Benchmarks):

### On Windows (PowerShell):
```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify_all.ps1
```

### On Linux / macOS (Bash):
```bash
chmod +x scripts/verify_all.sh
./scripts/verify_all.sh
# OR using the root Makefile:
make verify
```

*Expected Verdict*: **`ALL 5 GATES VERIFIED AND PASSING!`** (runs in ~10 seconds).

---

## 7. Step 5: Running the Full Stack (Interactive Web Dashboard)

Launch the live interactive visualizer:

### Terminal 1: Start the Analysis Engine / HTTP Gateway
```bash
cd security_engine
npm start
```
- Listens on: **`http://127.0.0.1:8787`**
- Endpoints:
  - `POST /api/analyze` — Compiles and executes static taint analysis.
  - `GET /api/examples` — Bundled canonical Mini-C benchmark programs.
  - `GET /health` — Health check and compiler frontend readiness probe.

---

### Terminal 2: Start the React + Cytoscape Dashboard
```bash
cd dashboard
npm run dev
```
- Opens locally at: **`http://localhost:5173`**
- Features:
  - **Test Case Selector**: Select `clean_flow.c`, `sql_injection.c`, `command_injection.c`, or `complex_loop.c`.
  - **Live Code Editor**: Edit or write custom Mini-C code and click **"Run Static Analysis"**.
  - **Cytoscape Canvas**: Interactive graph colored by security state (Green = Clean, Cyan = Sanitized, Amber = Tainted, Red = Vulnerable).
  - **Lattice Glossary**: Interactive footer bar displaying mathematical definitions for each state.
  - **Taint Path Highlighting**: Click any vulnerability card to dynamically highlight the red traversal path on the graph.
  - **Block Details Drawer**: Click any block node to inspect its Three-Address Code quadruples and real-time $IN, GEN, KILL, OUT$ sets.

---

## 8. Step 6: CLI Pipeline & Command-Line Operations

### 1. Direct Pipeline: Compiler Frontend $\to$ Security Engine
Pipe the compiler's emitted `CFG.json` directly into the security engine CLI:

- **Windows (PowerShell)**:
  ```powershell
  ./compiler_core/bin/codeguardian-frontend.exe examples/command_injection.c | node security_engine/src/cli.js
  ```
- **Linux / macOS**:
  ```bash
  ./compiler_core/bin/codeguardian-frontend examples/command_injection.c | node security_engine/src/cli.js
  ```
*Output*: Formatted `Audit.json` printed to stdout displaying program summary, lattice states, block statuses, and detected CWE findings with remediation advice.

---

### 2. Compiler Frontend Operational Modes

The `codeguardian-frontend` binary supports several specialized flags:

```bash
# 1. Synthesize Control Flow Graph and emit CFG.json (Default)
./compiler_core/bin/codeguardian-frontend examples/clean_flow.c

# 2. Save CFG.json directly to an output file
./compiler_core/bin/codeguardian-frontend -o output_cfg.json examples/clean_flow.c

# 3. Lower AST to human-readable linear Three-Address Code (TAC)
./compiler_core/bin/codeguardian-frontend --tac examples/command_injection.c

# 4. Emit AST syntax tree in JSON format
./compiler_core/bin/codeguardian-frontend --ast examples/complex_loop.c

# 5. Stream lexical token table [LINE, COL, TOKEN_TYPE, LEXEME]
./compiler_core/bin/codeguardian-frontend --lex examples/sql_injection.c

# 6. Syntax validation only (Exit code 0 on valid, 1 on syntax error)
./compiler_core/bin/codeguardian-frontend --parse examples/clean_flow.c
```

---

### 3. Direct HTTP API Requests

With the engine running (`npm start` in `security_engine`), you can query the API via `curl`:

#### Health Check:
```bash
curl http://127.0.0.1:8787/health
```

#### Analyze Raw Mini-C Source:
```bash
curl -X POST http://127.0.0.1:8787/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"source": "int main() { int x; x = read_input(); execute_query(x); return 0; }"}'
```

---

### 4. Master Code Showcase (Complex Multi-Path Flow Demo)

To showcase all features simultaneously—including **cyclic loop accumulators**, **branching control flow**, **sanitization**, **safe clean flows**, and **vulnerable command injections**—CodeGuardian includes [`examples/master_showcase.c`](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/examples/master_showcase.c):

```c
// examples/master_showcase.c
int main() {
    int user_id = read_input();        // [Source 1] Taints 'user_id'
    int cmd = get_param("cmd");        // [Source 2] Taints 'cmd'
    int count = 0;
    int accumulator = 0;
    int status = 1;

    // 1. Cyclic Loop: Taint accumulated across loop iterations
    while (count < 3) {
        accumulator = accumulator + user_id;
        count = count + 1;
    }

    // 2. Branching control flow: one path sanitizes, other leaves tainted
    if (status > 0) {
        // Sanitized path: clean the SQL payload
        accumulator = sanitize(accumulator);
    } else {
        // Unsanitized branch: taint remains active in cmd
        cmd = cmd + 0;
    }

    // 3. Clean sink: accumulator was sanitized along the active branch
    execute_query(accumulator);

    // 4. Vulnerable sink: cmd reached system_exec without sanitization (CWE-78)
    system_exec(cmd);

    return 0;
}
```

#### Running the Master Showcase:
```bash
# On Windows PowerShell:
./compiler_core/bin/codeguardian-frontend.exe examples/master_showcase.c | node security_engine/src/cli.js

# On Linux / macOS:
./compiler_core/bin/codeguardian-frontend examples/master_showcase.c | node security_engine/src/cli.js
```

#### How Each Security Status is Demonstrated:
- **`B0` (Entry Block) — `TAINTED`**: Ingests `read_input()` and `get_param()`. $OUT[B_0] = \{\text{user\_id}, \text{cmd}\}$.
- **`B1` & `B2` (Loop Header & Body) — `TAINTED`**: The loop propagates taint through the back-edge, demonstrating Kildall monotone convergence without infinite looping.
- **`B3` (Branch Decision) — `TAINTED`**: Evaluates `if (status > 0)`.
- **`B4` (Then Branch) — `SANITIZED`**: Invokes `sanitize(accumulator)`. Removes `accumulator` from outgoing taint, placing it into $KILL[B_4]$.
- **`B5` (Else Branch) — `TAINTED`**: Leaves `cmd` tainted along the alternate path.
- **`B6` (Exit Block) — `VULNERABLE`**: Sinks are evaluated. Since `cmd` arrived unsanitized, **`VULNERABLE`** is flagged and the exact source-to-sink path is traced:
  $$\text{Trace Path}: B_0 \to B_1 \to B_3 \to B_4 \to B_6 \implies \text{\textbf{CWE-78 Command Injection}}$$

---

## 9. Performance Benchmarking (< 300 ms SLA)

Execute the stopwatch-instrumented performance benchmarking suite:

- **Windows**:
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts/benchmark.ps1
  ```
- **Linux / macOS**:
  ```bash
  node security_engine/tests/server.test.js
  ```
- Detailed results are recorded in **[DOC/Benchmark_Report.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/DOC/Benchmark_Report.md)**:
  - Observed Frontend Latency: **~25 ms**
  - Observed Security Engine Latency: **~175 ms**
  - Average Total Latency: **~200 ms** (Passing the `< 300 ms` SLA with ~100 ms of safety buffer).

---

## 10. Common Troubleshooting & FAQs

### Q1: I see red squiggly lines or "Cannot find module 'react'" in VS Code.
**Solution**: Dependencies were not installed locally. Run:
```bash
cd security_engine && npm install
cd ../dashboard && npm install
```
Then open the VS Code Command Palette (`Ctrl + Shift + P`) and run **`Developer: Reload Window`**.

---

### Q2: PowerShell says `ExecutionPolicy Restricted` when running scripts.
**Solution**: Bypass the execution policy for that specific command:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify_all.ps1
```

---

### Q3: Git says `warning: LF will be replaced by CRLF`.
**Solution**: This is a harmless informational message indicating Git is converting Linux line endings (`LF`) to Windows line endings (`CRLF`) on your local machine. It does not affect functionality.

---

### Q4: `make` is not recognized on Windows.
**Solution**: 
1. Use the pre-built PowerShell verification script: `scripts/run_tests.ps1` or `scripts/verify_all.ps1`.
2. Or install `mingw32-make` via MSYS2 / Chocolatey (`choco install make`).

---

### Q5: Port 8787 or 5173 is already in use.
**Solution**:
- On Windows:
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 8787).OwningProcess | Stop-Process
  ```
- On Linux / macOS:
  ```bash
  lsof -ti :8787 | xargs kill -9
  ```

---

### Q6: macOS gives a Bison or Flex compilation error.
**Solution**: macOS includes legacy versions of `bison` (2.3) in `/usr/bin`. Ensure Homebrew's GNU Bison is prioritized in your PATH:
```bash
export PATH="$(brew --prefix bison)/bin:$(brew --prefix flex)/bin:$PATH"
```

---

## 11. Academic Review & Presentation Checklist

Before demonstrating CodeGuardian to course evaluators:
1. Run `powershell -File scripts/verify_all.ps1` (or `./scripts/verify_all.sh` on Linux/Mac) to confirm all 5 gates pass.
2. Launch the server (`cd security_engine && npm start`) and frontend (`cd dashboard && npm run dev`).
3. Have **[DOC/Viva_Preparation_Guide.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/DOC/Viva_Preparation_Guide.md)** open for rapid reference during theoretical questioning.
4. Have **[DOC/Benchmark_Report.md](file:///c:/Users/asus/OneDrive/Documents/Projects/CD_CodeGuardian/DOC/Benchmark_Report.md)** available to demonstrate quantitative SLA compliance (< 300ms).
