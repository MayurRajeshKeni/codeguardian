#ifndef CODEGUARDIAN_TAC_H
#define CODEGUARDIAN_TAC_H

#include <stdio.h>
#include <stdbool.h>
#include "ast.h"

/*
 * Three-Address Code (TAC) Quadruple Opcodes
 */
typedef enum {
    TAC_NOP = 0,
    TAC_ASSIGN,
    TAC_ADD,
    TAC_SUB,
    TAC_MUL,
    TAC_DIV,
    TAC_MOD,
    TAC_EQ,
    TAC_NEQ,
    TAC_LT,
    TAC_LE,
    TAC_GT,
    TAC_GE,
    TAC_AND,
    TAC_OR,
    TAC_NOT,
    TAC_LABEL,
    TAC_GOTO,
    TAC_IF_FALSE,
    TAC_IF_TRUE,
    TAC_CALL,
    TAC_RETURN
} TacOp;

/*
 * TAC Instruction Quadruple (Op, Arg1, Arg2, Result)
 */
typedef struct {
    int index;          /* 0-indexed instruction position */
    TacOp op;
    char *arg1;
    char *arg2;
    char *result;
    int line;
} TacInstruction;

/*
 * Linear TAC Program Buffer
 */
typedef struct {
    TacInstruction **instructions;
    int count;
    int capacity;
    int temp_counter;   /* For t0, t1, t2... */
    int label_counter;  /* For L0, L1, L2... */

    char **variables;   /* List of distinct program variables and temporaries */
    int var_count;
    int var_capacity;
} TacProgram;

/*
 * TAC Memory Management & Constructors
 */
TacProgram* tac_create_program(void);
void tac_free_program(TacProgram *prog);
TacInstruction* tac_emit(TacProgram *prog, TacOp op, const char *arg1, const char *arg2, const char *result, int line);

/*
 * Name Generators & Symbol Registry
 */
char* tac_new_temp(TacProgram *prog);
char* tac_new_label(TacProgram *prog);
void tac_register_variable(TacProgram *prog, const char *name);

/*
 * SDT Lowering Engine: AST -> Linear TAC
 */
TacProgram* tac_lower_ast(const AstNode *root);

/*
 * Visualization & Utilities
 */
const char* tac_op_to_string(TacOp op);
void tac_print(const TacProgram *prog);

#endif /* CODEGUARDIAN_TAC_H */
