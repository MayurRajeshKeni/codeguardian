#ifndef CODEGUARDIAN_CFG_H
#define CODEGUARDIAN_CFG_H

#include <stdio.h>
#include <stdbool.h>
#include "tac.h"

/*
 * CFG Edge Types
 */
typedef enum {
    EDGE_UNCONDITIONAL,
    EDGE_TRUE_BRANCH,
    EDGE_FALSE_BRANCH
} CfgEdgeType;

/*
 * Directed Control Flow Edge Structure
 */
typedef struct {
    char *from_block_id;
    char *to_block_id;
    CfgEdgeType type;
} CfgEdge;

/*
 * Basic Block Structure
 */
typedef struct {
    char *id;               /* "B0", "B1", "B2", etc. */
    char *label;            /* "Entry Block", "Then Branch", "Merge Block", etc. */
    TacInstruction **instructions;
    int instr_count;
    int instr_capacity;

    /* Associated label names targeting this block */
    char **associated_labels;
    int label_count;

    /* Predecessor and successor block IDs */
    char **predecessors;
    int pred_count;
    int pred_capacity;

    char **successors;
    int succ_count;
    int succ_capacity;
} BasicBlock;

/*
 * Control Flow Graph (CFG) Structure
 */
typedef struct {
    char *version;          /* "1.0" */
    char *entry_block_id;   /* e.g. "B0" */
    char *exit_block_id;    /* e.g. "B4" */

    char **variables;       /* Program variables & temporaries */
    int var_count;

    BasicBlock **blocks;
    int block_count;
    int block_capacity;

    CfgEdge **edges;
    int edge_count;
    int edge_capacity;
} CfgGraph;

/*
 * Memory Management
 */
CfgGraph* cfg_create_graph(void);
void cfg_free_graph(CfgGraph *cfg);

/*
 * Synthesis & Partitioning Algorithms (Dragon Book Leader Rules)
 */
CfgGraph* cfg_build_from_tac(const TacProgram *prog);

/*
 * Edge Management Helpers
 */
void cfg_add_edge(CfgGraph *cfg, const char *from_id, const char *to_id, CfgEdgeType type);
const char* cfg_edge_type_to_string(CfgEdgeType type);

/*
 * Debug Printing
 */
void cfg_print(const CfgGraph *cfg);

#endif /* CODEGUARDIAN_CFG_H */
