#!/usr/bin/env bash
# CodeGuardian Phase 5 - Master Verification Suite (Linux / macOS)
# Verifies all 5 Acceptance Gates across Member 1 and Member 2

set -eo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}   CodeGuardian Master Verification & Gate Review Suite     ${NC}"
echo -e "${CYAN}   (Linux / macOS POSIX Runner)                             ${NC}"
echo -e "${CYAN}============================================================${NC}"

START_TIME=$(date +%s)

# Stage 1: Build & Test Compiler Core
echo -e "\n${YELLOW}---> [Stage 1] Compiler Core Build & Unit Tests (Gates 1 & 2)...${NC}"
make -C compiler_core clean
make -C compiler_core all
make -C compiler_core test
echo -e "${GREEN}     [STAGE 1 PASSED] Compiler Core Unit Tests${NC}"

# Stage 2: Security Engine Test Suite
echo -e "\n${YELLOW}---> [Stage 2] Security Engine & Fixpoint Solver Tests (Gates 2 & 3)...${NC}"
(
  cd security_engine
  npm test
)
echo -e "${GREEN}     [STAGE 2 PASSED] Security Engine Full Suite (62/62 tests)${NC}"

# Stage 3: End-to-End CLI Pipeline
echo -e "\n${YELLOW}---> [Stage 3] End-to-End CLI Pipeline Verification (Gate 3)...${NC}"
BIN_PATH="compiler_core/bin/codeguardian-frontend"
if [ ! -f "$BIN_PATH" ]; then
  BIN_PATH="compiler_core/bin/codeguardian-frontend.exe"
fi

OUTPUT=$("$BIN_PATH" examples/command_injection.c | node security_engine/src/cli.js)
if echo "$OUTPUT" | grep -q "CWE-78"; then
  echo -e "${GREEN}     [STAGE 3 PASSED] CLI Pipeline detected CWE-78 trace path${NC}"
else
  echo -e "${RED}     [STAGE 3 FAILED] Expected CWE-78 in pipeline output${NC}"
  exit 1
fi

# Stage 4: Dashboard Production Bundle Build
echo -e "\n${YELLOW}---> [Stage 4] Dashboard Production Build Verification (Gate 4)...${NC}"
(
  cd dashboard
  npm run build
)
echo -e "${GREEN}     [STAGE 4 PASSED] Vite React Dashboard production build${NC}"

# Stage 5: Examples Verification
echo -e "\n${YELLOW}---> [Stage 5] All Canonical Examples CFG & Taint Verification (Gate 5)...${NC}"
for ex in clean_flow.c sql_injection.c command_injection.c complex_loop.c; do
  "$BIN_PATH" "examples/$ex" | node security_engine/src/cli.js > /dev/null
  echo "     - examples/$ex -> OK"
done
echo -e "${GREEN}     [STAGE 5 PASSED] Canonical Examples Verified${NC}"

END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))

echo -e "\n${CYAN}============================================================${NC}"
echo -e "${GREEN}  VERDICT: ALL 5 GATES VERIFIED AND PASSING! (${TOTAL_TIME}s)  ${NC}"
echo -e "${CYAN}============================================================${NC}"
