#include "cfg.h"
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

static BasicBlock* basic_block_create(const char *id, const char *label) {
    BasicBlock *bb = (BasicBlock*)malloc(sizeof(BasicBlock));
    if (!bb) {
        fprintf(stderr, "[Fatal Error] Out of memory allocating BasicBlock\n");
        exit(EXIT_FAILURE);
    }

    bb->id = safe_strdup(id);
    bb->label = safe_strdup(label);

    bb->instr_count = 0;
    bb->instr_capacity = 8;
    bb->instructions = (TacInstruction**)malloc(sizeof(TacInstruction*) * bb->instr_capacity);

    bb->associated_labels = (char**)malloc(sizeof(char*) * 8);
    bb->label_count = 0;

    bb->pred_count = 0;
    bb->pred_capacity = 4;
    bb->predecessors = (char**)malloc(sizeof(char*) * bb->pred_capacity);

    bb->succ_count = 0;
    bb->succ_capacity = 4;
    bb->successors = (char**)malloc(sizeof(char*) * bb->succ_capacity);

    return bb;
}

static void basic_block_add_instr(BasicBlock *bb, TacInstruction *instr) {
    if (!bb || !instr) return;
    if (bb->instr_count >= bb->instr_capacity) {
        bb->instr_capacity *= 2;
        bb->instructions = (TacInstruction**)realloc(bb->instructions, sizeof(TacInstruction*) * bb->instr_capacity);
    }
    bb->instructions[bb->instr_count++] = instr;
}

static void basic_block_add_label(BasicBlock *bb, const char *lbl) {
    if (!bb || !lbl) return;
    bb->associated_labels[bb->label_count++] = safe_strdup(lbl);
}

static void basic_block_add_pred(BasicBlock *bb, const char *pred_id) {
    if (!bb || !pred_id) return;
    for (int i = 0; i < bb->pred_count; i++) {
        if (strcmp(bb->predecessors[i], pred_id) == 0) return;
    }
    if (bb->pred_count >= bb->pred_capacity) {
        bb->pred_capacity *= 2;
        bb->predecessors = (char**)realloc(bb->predecessors, sizeof(char*) * bb->pred_capacity);
    }
    bb->predecessors[bb->pred_count++] = safe_strdup(pred_id);
}

static void basic_block_add_succ(BasicBlock *bb, const char *succ_id) {
    if (!bb || !succ_id) return;
    for (int i = 0; i < bb->succ_count; i++) {
        if (strcmp(bb->successors[i], succ_id) == 0) return;
    }
    if (bb->succ_count >= bb->succ_capacity) {
        bb->succ_capacity *= 2;
        bb->successors = (char**)realloc(bb->successors, sizeof(char*) * bb->succ_capacity);
    }
    bb->successors[bb->succ_count++] = safe_strdup(succ_id);
}

static void basic_block_free(BasicBlock *bb) {
    if (!bb) return;

    if (bb->id) free(bb->id);
    if (bb->label) free(bb->label);

    for (int i = 0; i < bb->instr_count; i++) {
        TacInstruction *instr = bb->instructions[i];
        if (instr) {
            if (instr->arg1) free(instr->arg1);
            if (instr->arg2) free(instr->arg2);
            if (instr->result) free(instr->result);
            free(instr);
        }
    }
    free(bb->instructions);

    for (int i = 0; i < bb->label_count; i++) {
        free(bb->associated_labels[i]);
    }
    free(bb->associated_labels);

    for (int i = 0; i < bb->pred_count; i++) {
        free(bb->predecessors[i]);
    }
    free(bb->predecessors);

    for (int i = 0; i < bb->succ_count; i++) {
        free(bb->successors[i]);
    }
    free(bb->successors);

    free(bb);
}

CfgGraph* cfg_create_graph(void) {
    CfgGraph *cfg = (CfgGraph*)malloc(sizeof(CfgGraph));
    if (!cfg) {
        fprintf(stderr, "[Fatal Error] Out of memory creating CfgGraph\n");
        exit(EXIT_FAILURE);
    }

    cfg->version = safe_strdup("1.0");
    cfg->entry_block_id = NULL;
    cfg->exit_block_id = NULL;

    cfg->variables = NULL;
    cfg->var_count = 0;

    cfg->block_count = 0;
    cfg->block_capacity = 8;
    cfg->blocks = (BasicBlock**)malloc(sizeof(BasicBlock*) * cfg->block_capacity);

    cfg->edge_count = 0;
    cfg->edge_capacity = 8;
    cfg->edges = (CfgEdge**)malloc(sizeof(CfgEdge*) * cfg->edge_capacity);

    return cfg;
}

void cfg_free_graph(CfgGraph *cfg) {
    if (!cfg) return;

    if (cfg->version) free(cfg->version);
    if (cfg->entry_block_id) free(cfg->entry_block_id);
    if (cfg->exit_block_id) free(cfg->exit_block_id);

    for (int i = 0; i < cfg->var_count; i++) {
        free(cfg->variables[i]);
    }
    if (cfg->variables) free(cfg->variables);

    for (int i = 0; i < cfg->block_count; i++) {
        basic_block_free(cfg->blocks[i]);
    }
    free(cfg->blocks);

    for (int i = 0; i < cfg->edge_count; i++) {
        free(cfg->edges[i]->from_block_id);
        free(cfg->edges[i]->to_block_id);
        free(cfg->edges[i]);
    }
    free(cfg->edges);

    free(cfg);
}

void cfg_add_edge(CfgGraph *cfg, const char *from_id, const char *to_id, CfgEdgeType type) {
    if (!cfg || !from_id || !to_id) return;

    /* Prevent duplicate edges */
    for (int i = 0; i < cfg->edge_count; i++) {
        if (strcmp(cfg->edges[i]->from_block_id, from_id) == 0 &&
            strcmp(cfg->edges[i]->to_block_id, to_id) == 0 &&
            cfg->edges[i]->type == type) {
            return;
        }
    }

    if (cfg->edge_count >= cfg->edge_capacity) {
        cfg->edge_capacity *= 2;
        cfg->edges = (CfgEdge**)realloc(cfg->edges, sizeof(CfgEdge*) * cfg->edge_capacity);
    }

    CfgEdge *edge = (CfgEdge*)malloc(sizeof(CfgEdge));
    edge->from_block_id = safe_strdup(from_id);
    edge->to_block_id = safe_strdup(to_id);
    edge->type = type;

    cfg->edges[cfg->edge_count++] = edge;

    /* Update block predecessors and successors */
    for (int i = 0; i < cfg->block_count; i++) {
        if (strcmp(cfg->blocks[i]->id, from_id) == 0) {
            basic_block_add_succ(cfg->blocks[i], to_id);
        }
        if (strcmp(cfg->blocks[i]->id, to_id) == 0) {
            basic_block_add_pred(cfg->blocks[i], from_id);
        }
    }
}

const char* cfg_edge_type_to_string(CfgEdgeType type) {
    switch (type) {
        case EDGE_UNCONDITIONAL: return "UNCONDITIONAL";
        case EDGE_TRUE_BRANCH:   return "TRUE_BRANCH";
        case EDGE_FALSE_BRANCH:  return "FALSE_BRANCH";
        default:                 return "UNKNOWN";
    }
}

/*
 * Implementation of Dragon Book 3-Rule Leader Partitioning Algorithm:
 * Reference: Aho, Lam, Sethi, Ullman - Compilers: Principles, Techniques, and Tools
 * Section 8.4.1 (Basic Blocks and Flow Graphs)
 */
CfgGraph* cfg_build_from_tac(const TacProgram *prog) {
    if (!prog || prog->count == 0) {
        return cfg_create_graph();
    }

    CfgGraph *cfg = cfg_create_graph();

    /* 1. Copy variables */
    cfg->var_count = prog->var_count;
    cfg->variables = (char**)malloc(sizeof(char*) * cfg->var_count);
    for (int i = 0; i < prog->var_count; i++) {
        cfg->variables[i] = safe_strdup(prog->variables[i]);
    }

    int N = prog->count;
    bool *is_leader = (bool*)calloc(N, sizeof(bool));

    /* Leader Rule 1: First instruction is a leader */
    is_leader[0] = true;

    /* Build label to index mapping */
    for (int i = 0; i < N; i++) {
        TacInstruction *instr = prog->instructions[i];

        if (instr->op == TAC_LABEL) {
            /* Any target of a jump is a leader (Rule 2) */
            is_leader[i] = true;
        }

        if (instr->op == TAC_IF_FALSE || instr->op == TAC_IF_TRUE || instr->op == TAC_GOTO) {
            /* Target of jump is a leader (Rule 2) */
            const char *target_lbl = instr->result;
            for (int j = 0; j < N; j++) {
                if (prog->instructions[j]->op == TAC_LABEL &&
                    prog->instructions[j]->result &&
                    strcmp(prog->instructions[j]->result, target_lbl) == 0) {
                    is_leader[j] = true;
                    break;
                }
            }

            /* Instruction immediately following jump is a leader (Rule 3) */
            if (i + 1 < N) {
                is_leader[i + 1] = true;
            }
        }

        if (instr->op == TAC_RETURN) {
            /* Instruction following return is a leader (Rule 3) */
            if (i + 1 < N) {
                is_leader[i + 1] = true;
            }
        }
    }

    /* 2. Group instructions into Basic Blocks */
    BasicBlock *current_bb = NULL;
    int block_idx = 0;

    for (int i = 0; i < N; i++) {
        if (is_leader[i]) {
            char b_id[32];
            snprintf(b_id, sizeof(b_id), "B%d", block_idx++);
            current_bb = basic_block_create(b_id, "Basic Block");

            if (cfg->block_count >= cfg->block_capacity) {
                cfg->block_capacity *= 2;
                cfg->blocks = (BasicBlock**)realloc(cfg->blocks, sizeof(BasicBlock*) * cfg->block_capacity);
            }
            cfg->blocks[cfg->block_count++] = current_bb;
        }

        TacInstruction *src = prog->instructions[i];
        if (src->op == TAC_LABEL) {
            /* Associate label name with this basic block */
            basic_block_add_label(current_bb, src->result);
        } else {
            /* Clone instruction into basic block */
            TacInstruction *clone = (TacInstruction*)malloc(sizeof(TacInstruction));
            clone->index = 0; /* Will re-index sequentially below */
            clone->op = src->op;
            clone->arg1 = safe_strdup(src->arg1);
            clone->arg2 = safe_strdup(src->arg2);
            clone->result = safe_strdup(src->result);
            clone->line = src->line;

            basic_block_add_instr(current_bb, clone);
        }
    }

    free(is_leader);

    /* 3. Handle any empty blocks (e.g. branch with no instructions) by adding a NOP */
    for (int i = 0; i < cfg->block_count; i++) {
        BasicBlock *bb = cfg->blocks[i];
        if (bb->instr_count == 0) {
            TacInstruction *nop = (TacInstruction*)malloc(sizeof(TacInstruction));
            nop->index = 0;
            nop->op = TAC_NOP;
            nop->arg1 = NULL;
            nop->arg2 = NULL;
            nop->result = NULL;
            nop->line = 0;
            basic_block_add_instr(bb, nop);
        }
    }

    /* 4. Sequentially re-index all instructions across all blocks */
    int global_instr_idx = 0;
    for (int i = 0; i < cfg->block_count; i++) {
        BasicBlock *bb = cfg->blocks[i];
        for (int j = 0; j < bb->instr_count; j++) {
            bb->instructions[j]->index = global_instr_idx++;
        }
    }

    /* Helper: find block by associated label name */
    #define FIND_BLOCK_BY_LABEL(lbl_name) ({ \
        const char *found_id = NULL; \
        for (int b = 0; b < cfg->block_count; b++) { \
            for (int l = 0; l < cfg->blocks[b]->label_count; l++) { \
                if (strcmp(cfg->blocks[b]->associated_labels[l], lbl_name) == 0) { \
                    found_id = cfg->blocks[b]->id; \
                    break; \
                } \
            } \
            if (found_id) break; \
        } \
        found_id; \
    })

    /* 5. Connect directed edges */
    for (int i = 0; i < cfg->block_count; i++) {
        BasicBlock *bb = cfg->blocks[i];
        TacInstruction *last = bb->instructions[bb->instr_count - 1];

        if (last->op == TAC_IF_FALSE) {
            const char *target_id = NULL;
            for (int b = 0; b < cfg->block_count; b++) {
                for (int l = 0; l < cfg->blocks[b]->label_count; l++) {
                    if (strcmp(cfg->blocks[b]->associated_labels[l], last->result) == 0) {
                        target_id = cfg->blocks[b]->id;
                        break;
                    }
                }
                if (target_id) break;
            }

            /* False branch points to target */
            if (target_id) {
                cfg_add_edge(cfg, bb->id, target_id, EDGE_FALSE_BRANCH);
            }

            /* True branch falls through to next sequential block */
            if (i + 1 < cfg->block_count) {
                cfg_add_edge(cfg, bb->id, cfg->blocks[i + 1]->id, EDGE_TRUE_BRANCH);
            }
        } else if (last->op == TAC_GOTO) {
            const char *target_id = NULL;
            for (int b = 0; b < cfg->block_count; b++) {
                for (int l = 0; l < cfg->blocks[b]->label_count; l++) {
                    if (strcmp(cfg->blocks[b]->associated_labels[l], last->result) == 0) {
                        target_id = cfg->blocks[b]->id;
                        break;
                    }
                }
                if (target_id) break;
            }

            if (target_id) {
                cfg_add_edge(cfg, bb->id, target_id, EDGE_UNCONDITIONAL);
            }
        } else if (last->op == TAC_RETURN) {
            /* Return instruction has no successors */
        } else {
            /* Fall through to next sequential block */
            if (i + 1 < cfg->block_count) {
                cfg_add_edge(cfg, bb->id, cfg->blocks[i + 1]->id, EDGE_UNCONDITIONAL);
            }
        }
    }

    /* 6. Assign entry block and exit block */
    cfg->entry_block_id = safe_strdup(cfg->blocks[0]->id);

    /* Exit block is the block containing RETURN, or the last block */
    int exit_idx = cfg->block_count - 1;
    for (int i = 0; i < cfg->block_count; i++) {
        BasicBlock *bb = cfg->blocks[i];
        if (bb->instr_count > 0 && bb->instructions[bb->instr_count - 1]->op == TAC_RETURN) {
            exit_idx = i;
            break;
        }
    }
    cfg->exit_block_id = safe_strdup(cfg->blocks[exit_idx]->id);

    /* 7. Assign descriptive block labels based on graph structure */
    for (int i = 0; i < cfg->block_count; i++) {
        BasicBlock *bb = cfg->blocks[i];
        free(bb->label);

        if (i == 0) {
            bb->label = safe_strdup("Entry Block");
        } else if (i == exit_idx) {
            bb->label = safe_strdup("Exit Block");
        } else if (bb->pred_count > 1) {
            bb->label = safe_strdup("Merge Block");
        } else {
            /* Check if incoming edge is TRUE or FALSE branch */
            bool is_true = false;
            bool is_false = false;
            for (int e = 0; e < cfg->edge_count; e++) {
                if (strcmp(cfg->edges[e]->to_block_id, bb->id) == 0) {
                    if (cfg->edges[e]->type == EDGE_TRUE_BRANCH) is_true = true;
                    if (cfg->edges[e]->type == EDGE_FALSE_BRANCH) is_false = true;
                }
            }

            if (is_true) {
                bb->label = safe_strdup("Then Branch");
            } else if (is_false) {
                bb->label = safe_strdup("Else Branch");
            } else {
                char buf[32];
                snprintf(buf, sizeof(buf), "Block %s", bb->id);
                bb->label = safe_strdup(buf);
            }
        }
    }

    return cfg;
}

void cfg_print(const CfgGraph *cfg) {
    if (!cfg) return;

    printf("\n=== Control Flow Graph (CFG) ===\n");
    printf("Entry: %s | Exit: %s | Blocks: %d | Edges: %d\n",
           cfg->entry_block_id ? cfg->entry_block_id : "N/A",
           cfg->exit_block_id ? cfg->exit_block_id : "N/A",
           cfg->block_count, cfg->edge_count);

    for (int i = 0; i < cfg->block_count; i++) {
        BasicBlock *bb = cfg->blocks[i];
        printf("\n[%s] \"%s\"\n", bb->id, bb->label);
        printf("  Predecessors: ");
        for (int p = 0; p < bb->pred_count; p++) printf("%s ", bb->predecessors[p]);
        printf("\n  Successors:   ");
        for (int s = 0; s < bb->succ_count; s++) printf("%s ", bb->successors[s]);
        printf("\n  Instructions:\n");
        for (int j = 0; j < bb->instr_count; j++) {
            TacInstruction *in = bb->instructions[j];
            printf("    (%d) %s", in->index, tac_op_to_string(in->op));
            if (in->arg1) printf(" %s", in->arg1);
            if (in->arg2) printf(", %s", in->arg2);
            if (in->result) printf(" -> %s", in->result);
            printf(" (line %d)\n", in->line);
        }
    }

    printf("\nDirected Edges:\n");
    for (int i = 0; i < cfg->edge_count; i++) {
        CfgEdge *e = cfg->edges[i];
        printf("  %s -> %s [%s]\n", e->from_block_id, e->to_block_id, cfg_edge_type_to_string(e->type));
    }
}
