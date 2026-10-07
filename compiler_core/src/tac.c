#include "tac.h"
#include <stdlib.h>
#include <string.h>

static char* safe_strdup(const char *s) {
    if (!s) return NULL;
    size_t len = strlen(s);
    char *dup = (char*)malloc(len + 1);
    if (!dup) {
        fprintf(stderr, "[Fatal Error] Out of memory in safe_strdup\n");
        exit(EXIT_FAILURE);
    }
    memcpy(dup, s, len + 1);
    return dup;
}

TacProgram* tac_create_program(void) {
    TacProgram *prog = (TacProgram*)malloc(sizeof(TacProgram));
    if (!prog) {
        fprintf(stderr, "[Fatal Error] Out of memory in tac_create_program\n");
        exit(EXIT_FAILURE);
    }

    prog->count = 0;
    prog->capacity = 16;
    prog->instructions = (TacInstruction**)malloc(sizeof(TacInstruction*) * prog->capacity);
    if (!prog->instructions) {
        fprintf(stderr, "[Fatal Error] Out of memory in tac_create_program instructions\n");
        free(prog);
        exit(EXIT_FAILURE);
    }

    prog->temp_counter = 0;
    prog->label_counter = 0;

    prog->var_count = 0;
    prog->var_capacity = 16;
    prog->variables = (char**)malloc(sizeof(char*) * prog->var_capacity);
    if (!prog->variables) {
        fprintf(stderr, "[Fatal Error] Out of memory in tac_create_program variables\n");
        free(prog->instructions);
        free(prog);
        exit(EXIT_FAILURE);
    }

    return prog;
}

void tac_free_program(TacProgram *prog) {
    if (!prog) return;

    for (int i = 0; i < prog->count; i++) {
        TacInstruction *instr = prog->instructions[i];
        if (instr) {
            if (instr->arg1) free(instr->arg1);
            if (instr->arg2) free(instr->arg2);
            if (instr->result) free(instr->result);
            free(instr);
        }
    }
    free(prog->instructions);

    for (int i = 0; i < prog->var_count; i++) {
        if (prog->variables[i]) free(prog->variables[i]);
    }
    free(prog->variables);

    free(prog);
}

TacInstruction* tac_emit(TacProgram *prog, TacOp op, const char *arg1, const char *arg2, const char *result, int line) {
    if (!prog) return NULL;

    if (prog->count >= prog->capacity) {
        prog->capacity *= 2;
        TacInstruction **new_instrs = (TacInstruction**)realloc(prog->instructions, sizeof(TacInstruction*) * prog->capacity);
        if (!new_instrs) {
            fprintf(stderr, "[Fatal Error] Out of memory expanding TAC instructions\n");
            exit(EXIT_FAILURE);
        }
        prog->instructions = new_instrs;
    }

    TacInstruction *instr = (TacInstruction*)malloc(sizeof(TacInstruction));
    if (!instr) {
        fprintf(stderr, "[Fatal Error] Out of memory allocating TAC instruction\n");
        exit(EXIT_FAILURE);
    }

    instr->index = prog->count;
    instr->op = op;
    instr->arg1 = safe_strdup(arg1);
    instr->arg2 = safe_strdup(arg2);
    instr->result = safe_strdup(result);
    instr->line = line;

    prog->instructions[prog->count++] = instr;
    return instr;
}

void tac_register_variable(TacProgram *prog, const char *name) {
    if (!prog || !name) return;

    /* Check if already present */
    for (int i = 0; i < prog->var_count; i++) {
        if (strcmp(prog->variables[i], name) == 0) {
            return;
        }
    }

    if (prog->var_count >= prog->var_capacity) {
        prog->var_capacity *= 2;
        char **new_vars = (char**)realloc(prog->variables, sizeof(char*) * prog->var_capacity);
        if (!new_vars) {
            fprintf(stderr, "[Fatal Error] Out of memory expanding TAC variables\n");
            exit(EXIT_FAILURE);
        }
        prog->variables = new_vars;
    }

    prog->variables[prog->var_count++] = safe_strdup(name);
}

char* tac_new_temp(TacProgram *prog) {
    if (!prog) return NULL;
    char buf[32];
    snprintf(buf, sizeof(buf), "t%d", prog->temp_counter++);
    tac_register_variable(prog, buf);
    return safe_strdup(buf);
}

char* tac_new_label(TacProgram *prog) {
    if (!prog) return NULL;
    char buf[32];
    snprintf(buf, sizeof(buf), "L%d", prog->label_counter++);
    return safe_strdup(buf);
}

const char* tac_op_to_string(TacOp op) {
    switch (op) {
        case TAC_NOP:      return "NOP";
        case TAC_ASSIGN:   return "ASSIGN";
        case TAC_ADD:      return "ADD";
        case TAC_SUB:      return "SUB";
        case TAC_MUL:      return "MUL";
        case TAC_DIV:      return "DIV";
        case TAC_MOD:      return "MOD";
        case TAC_EQ:       return "EQ";
        case TAC_NEQ:      return "NEQ";
        case TAC_LT:       return "LT";
        case TAC_LE:       return "LE";
        case TAC_GT:       return "GT";
        case TAC_GE:       return "GE";
        case TAC_AND:      return "AND";
        case TAC_OR:       return "OR";
        case TAC_NOT:      return "NOT";
        case TAC_LABEL:    return "LABEL";
        case TAC_GOTO:     return "GOTO";
        case TAC_IF_FALSE: return "IF_FALSE";
        case TAC_IF_TRUE:  return "IF_TRUE";
        case TAC_CALL:     return "CALL";
        case TAC_RETURN:   return "RETURN";
        default:           return "UNKNOWN";
    }
}

static TacOp binop_to_tac_op(BinaryOp op) {
    switch (op) {
        case BINOP_ADD: return TAC_ADD;
        case BINOP_SUB: return TAC_SUB;
        case BINOP_MUL: return TAC_MUL;
        case BINOP_DIV: return TAC_DIV;
        case BINOP_MOD: return TAC_MOD;
        case BINOP_EQ:  return TAC_EQ;
        case BINOP_NEQ: return TAC_NEQ;
        case BINOP_LT:  return TAC_LT;
        case BINOP_LE:  return TAC_LE;
        case BINOP_GT:  return TAC_GT;
        case BINOP_GE:  return TAC_GE;
        case BINOP_AND: return TAC_AND;
        case BINOP_OR:  return TAC_OR;
        default:        return TAC_NOP;
    }
}

/*
 * Forward Declarations for Recursive SDT Traversal
 */
static char* lower_expr(TacProgram *prog, const AstNode *node);
static void lower_stmt(TacProgram *prog, const AstNode *node);

static char* lower_expr(TacProgram *prog, const AstNode *node) {
    if (!node) return NULL;

    switch (node->type) {
        case AST_INT_LITERAL: {
            char buf[32];
            snprintf(buf, sizeof(buf), "%d", node->int_val);
            return safe_strdup(buf);
        }
        case AST_BOOL_LITERAL: {
            char buf[32];
            snprintf(buf, sizeof(buf), "%d", node->int_val);
            return safe_strdup(buf);
        }
        case AST_STRING_LITERAL: {
            return safe_strdup(node->str_val ? node->str_val : "");
        }
        case AST_IDENTIFIER: {
            tac_register_variable(prog, node->name);
            return safe_strdup(node->name);
        }
        case AST_ASSIGN_EXPR: {
            tac_register_variable(prog, node->name);
            char *rhs = lower_expr(prog, node->children[0]);
            tac_emit(prog, TAC_ASSIGN, rhs, NULL, node->name, node->line);
            free(rhs);
            return safe_strdup(node->name);
        }
        case AST_BINARY_EXPR: {
            char *left = lower_expr(prog, node->children[0]);
            char *right = lower_expr(prog, node->children[1]);
            char *temp = tac_new_temp(prog);
            TacOp op = binop_to_tac_op(node->binop);

            tac_emit(prog, op, left, right, temp, node->line);
            free(left);
            free(right);
            return temp;
        }
        case AST_UNARY_EXPR: {
            char *operand = lower_expr(prog, node->children[0]);
            char *temp = tac_new_temp(prog);

            if (node->unop == UNOP_MINUS) {
                tac_emit(prog, TAC_SUB, "0", operand, temp, node->line);
            } else if (node->unop == UNOP_NOT) {
                tac_emit(prog, TAC_NOT, operand, NULL, temp, node->line);
            } else {
                tac_emit(prog, TAC_ASSIGN, operand, NULL, temp, node->line);
            }
            free(operand);
            return temp;
        }
        case AST_CALL_EXPR: {
            char *arg1 = safe_strdup(node->name);
            char *arg2 = NULL;

            if (node->child_count > 0) {
                arg2 = lower_expr(prog, node->children[0]);
            }

            char *temp = tac_new_temp(prog);
            tac_emit(prog, TAC_CALL, arg1, arg2, temp, node->line);
            free(arg1);
            if (arg2) free(arg2);
            return temp;
        }
        default:
            return NULL;
    }
}

static void lower_stmt(TacProgram *prog, const AstNode *node) {
    if (!node) return;

    switch (node->type) {
        case AST_VAR_DECL: {
            tac_register_variable(prog, node->name);
            if (node->child_count > 0) {
                char *init_val = lower_expr(prog, node->children[0]);
                tac_emit(prog, TAC_ASSIGN, init_val, NULL, node->name, node->line);
                free(init_val);
            }
            break;
        }
        case AST_EXPR_STMT: {
            if (node->child_count > 0) {
                const AstNode *expr_node = node->children[0];
                if (expr_node->type == AST_CALL_EXPR) {
                    /* Standalone call statement (e.g. execute_query(x)) */
                    char *arg1 = safe_strdup(expr_node->name);
                    char *arg2 = NULL;
                    if (expr_node->child_count > 0) {
                        arg2 = lower_expr(prog, expr_node->children[0]);
                    }
                    tac_emit(prog, TAC_CALL, arg1, arg2, NULL, expr_node->line);
                    free(arg1);
                    if (arg2) free(arg2);
                } else {
                    char *res = lower_expr(prog, expr_node);
                    if (res) free(res);
                }
            }
            break;
        }
        case AST_COMPOUND_STMT: {
            for (int i = 0; i < node->child_count; i++) {
                lower_stmt(prog, node->children[i]);
            }
            break;
        }
        case AST_IF_STMT: {
            char *cond = lower_expr(prog, node->children[0]);
            char *lbl_else = tac_new_label(prog);
            char *lbl_end = (node->child_count > 2) ? tac_new_label(prog) : NULL;

            tac_emit(prog, TAC_IF_FALSE, cond, NULL, lbl_else, node->line);
            free(cond);

            /* Then branch */
            lower_stmt(prog, node->children[1]);

            if (node->child_count > 2) {
                /* Has else branch */
                tac_emit(prog, TAC_GOTO, NULL, NULL, lbl_end, node->line);
                tac_emit(prog, TAC_LABEL, NULL, NULL, lbl_else, node->line);
                lower_stmt(prog, node->children[2]);
                tac_emit(prog, TAC_LABEL, NULL, NULL, lbl_end, node->line);
                free(lbl_end);
            } else {
                tac_emit(prog, TAC_LABEL, NULL, NULL, lbl_else, node->line);
            }
            free(lbl_else);
            break;
        }
        case AST_WHILE_STMT: {
            char *lbl_head = tac_new_label(prog);
            char *lbl_exit = tac_new_label(prog);

            tac_emit(prog, TAC_LABEL, NULL, NULL, lbl_head, node->line);
            char *cond = lower_expr(prog, node->children[0]);
            tac_emit(prog, TAC_IF_FALSE, cond, NULL, lbl_exit, node->line);
            free(cond);

            /* Loop body */
            lower_stmt(prog, node->children[1]);

            /* Back-edge jump */
            tac_emit(prog, TAC_GOTO, NULL, NULL, lbl_head, node->line);
            tac_emit(prog, TAC_LABEL, NULL, NULL, lbl_exit, node->line);

            free(lbl_head);
            free(lbl_exit);
            break;
        }
        case AST_RETURN_STMT: {
            if (node->child_count > 0) {
                char *val = lower_expr(prog, node->children[0]);
                tac_emit(prog, TAC_RETURN, val, NULL, NULL, node->line);
                free(val);
            } else {
                tac_emit(prog, TAC_RETURN, NULL, NULL, NULL, node->line);
            }
            break;
        }
        case AST_ASSIGN_EXPR: {
            char *res = lower_expr(prog, node);
            if (res) free(res);
            break;
        }
        default:
            break;
    }
}

TacProgram* tac_lower_ast(const AstNode *root) {
    if (!root) return NULL;

    TacProgram *prog = tac_create_program();

    if (root->type == AST_PROGRAM) {
        for (int i = 0; i < root->child_count; i++) {
            const AstNode *decl = root->children[i];
            if (decl->type == AST_FUNC_DECL) {
                /* Function body is the last child of func_decl */
                for (int j = 0; j < decl->child_count; j++) {
                    if (decl->children[j]->type == AST_COMPOUND_STMT) {
                        lower_stmt(prog, decl->children[j]);
                    }
                }
            } else if (decl->type == AST_VAR_DECL) {
                lower_stmt(prog, decl);
            }
        }
    } else if (root->type == AST_FUNC_DECL) {
        for (int j = 0; j < root->child_count; j++) {
            if (root->children[j]->type == AST_COMPOUND_STMT) {
                lower_stmt(prog, root->children[j]);
            }
        }
    } else {
        lower_stmt(prog, root);
    }

    return prog;
}

void tac_print(const TacProgram *prog) {
    if (!prog) return;

    printf("=== Linear Three-Address Code (TAC) Quadruples ===\n");
    for (int i = 0; i < prog->count; i++) {
        TacInstruction *instr = prog->instructions[i];
        printf("[%3d] %-10s", instr->index, tac_op_to_string(instr->op));

        if (instr->op == TAC_LABEL) {
            printf(" : %s", instr->result);
        } else {
            if (instr->result) printf(" %s =", instr->result);
            if (instr->arg1)   printf(" %s", instr->arg1);
            if (instr->arg2)   printf(", %s", instr->arg2);
            if (!instr->result && instr->op == TAC_IF_FALSE) {
                printf(" GOTO %s", instr->result ? instr->result : "");
            }
        }
        printf(" (line %d)\n", instr->line);
    }
    printf("Total Quadruples: %d\n", prog->count);
}
