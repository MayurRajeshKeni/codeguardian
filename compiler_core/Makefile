# CodeGuardian Compiler Core — Makefile
# Member 1 Subsystem

CC ?= gcc
CFLAGS ?= -std=c11 -Wall -Wextra -Wpedantic

# Windows MSYS2 fallback path auto-detection
ifeq ($(OS),Windows_NT)
    FLEX ?= $(shell where flex.exe 2>nul || echo C:/msys64/usr/bin/flex.exe)
    BISON ?= $(shell where bison.exe 2>nul || echo C:/msys64/usr/bin/bison.exe)
    BIN_EXT := .exe
else
    FLEX ?= flex
    BISON ?= bison
    BIN_EXT :=
endif

SRC_DIR := src
TEST_DIR := tests
BIN_DIR := bin

TARGET := $(BIN_DIR)/codeguardian-frontend$(BIN_EXT)

all: $(TARGET)

$(SRC_DIR)/parser.tab.c $(SRC_DIR)/parser.tab.h: $(SRC_DIR)/parser.y
	$(BISON) -d -v -o $(SRC_DIR)/parser.tab.c $(SRC_DIR)/parser.y

$(SRC_DIR)/lex.yy.c: $(SRC_DIR)/scanner.l $(SRC_DIR)/parser.tab.h
	$(FLEX) -o $(SRC_DIR)/lex.yy.c $(SRC_DIR)/scanner.l

$(TARGET): $(SRC_DIR)/parser.tab.c $(SRC_DIR)/lex.yy.c $(SRC_DIR)/tokens.c $(SRC_DIR)/main.c
	@mkdir -p $(BIN_DIR) 2>nul || true
	$(CC) $(CFLAGS) -I$(SRC_DIR) -o $@ $(SRC_DIR)/parser.tab.c $(SRC_DIR)/lex.yy.c $(SRC_DIR)/tokens.c $(SRC_DIR)/main.c

test: $(TARGET)
	@echo "=== Running Member 1 Lexical and Syntax Verification Tests ==="
	@powershell -ExecutionPolicy Bypass -File ../scripts/run_tests.ps1 -BinaryPath bin/codeguardian-frontend$(BIN_EXT)

clean:
	rm -f $(SRC_DIR)/parser.tab.c $(SRC_DIR)/parser.tab.h $(SRC_DIR)/parser.output $(SRC_DIR)/lex.yy.c $(TARGET)

.PHONY: all test clean
