#include "json_emit.h"
#include <string.h>

static void print_escaped_string(FILE *out, const char *s) {
    if (!s) {
        fputs("null", out);
        return;
    }

    fputc('"', out);
    while (*s) {
        switch (*s) {
            case '"':  fputs("\\\"", out); break;
            case '\\': fputs("\\\\", out); break;
            case '\b': fputs("\\b", out); break;
            case '\f': fputs("\\f", out); break;
            case '\n': fputs("\\n", out); break;
            case '\r': fputs("\\r", out); break;
            case '\t': fputs("\\t", out); break;
            default:   fputc(*s, out); break;
        }
        s++;
    }
    fputc('"', out);
}

void json_emit_cfg(const CfgGraph *cfg, FILE *out) {
    if (!cfg || !out) return;

    fputs("{\n", out);

    /* 1. Version */
    fprintf(out, "  \"version\": \"%s\",\n", cfg->version ? cfg->version : "1.0");

    /* 2. Entry & Exit Block */
    fprintf(out, "  \"entryBlock\": \"%s\",\n", cfg->entry_block_id ? cfg->entry_block_id : "B0");
    fprintf(out, "  \"exitBlock\": \"%s\",\n", cfg->exit_block_id ? cfg->exit_block_id : "B0");

    /* 3. Variables */
    fputs("  \"variables\": [", out);
    for (int i = 0; i < cfg->var_count; i++) {
        print_escaped_string(out, cfg->variables[i]);
        if (i < cfg->var_count - 1) fputs(", ", out);
    }
    fputs("],\n", out);

    /* 4. Basic Blocks */
    fputs("  \"blocks\": [\n", out);
    for (int i = 0; i < cfg->block_count; i++) {
        BasicBlock *bb = cfg->blocks[i];
        fputs("    {\n", out);
        fprintf(out, "      \"id\": \"%s\",\n", bb->id);
        fprintf(out, "      \"label\": \"%s\",\n", bb->label ? bb->label : "Block");

        /* Instructions */
        fputs("      \"instructions\": [\n", out);
        for (int j = 0; j < bb->instr_count; j++) {
            TacInstruction *in = bb->instructions[j];
            fputs("        {\n", out);
            fprintf(out, "          \"index\": %d,\n", in->index);
            fprintf(out, "          \"op\": \"%s\",\n", tac_op_to_string(in->op));

            fputs("          \"arg1\": ", out);
            print_escaped_string(out, in->arg1);
            fputs(",\n", out);

            fputs("          \"arg2\": ", out);
            print_escaped_string(out, in->arg2);
            fputs(",\n", out);

            fputs("          \"result\": ", out);
            print_escaped_string(out, in->result);
            fputs(",\n", out);

            fprintf(out, "          \"line\": %d\n", in->line);

            fputs("        }", out);
            if (j < bb->instr_count - 1) fputc(',', out);
            fputc('\n', out);
        }
        fputs("      ],\n", out);

        /* Predecessors */
        fputs("      \"predecessors\": [", out);
        for (int p = 0; p < bb->pred_count; p++) {
            fprintf(out, "\"%s\"", bb->predecessors[p]);
            if (p < bb->pred_count - 1) fputs(", ", out);
        }
        fputs("],\n", out);

        /* Successors */
        fputs("      \"successors\": [", out);
        for (int s = 0; s < bb->succ_count; s++) {
            fprintf(out, "\"%s\"", bb->successors[s]);
            if (s < bb->succ_count - 1) fputs(", ", out);
        }
        fputs("]\n", out);

        fputs("    }", out);
        if (i < cfg->block_count - 1) fputc(',', out);
        fputc('\n', out);
    }
    fputs("  ],\n", out);

    /* 5. Directed Edges */
    fputs("  \"edges\": [\n", out);
    for (int i = 0; i < cfg->edge_count; i++) {
        CfgEdge *e = cfg->edges[i];
        fprintf(out, "    { \"from\": \"%s\", \"to\": \"%s\", \"type\": \"%s\" }",
                e->from_block_id, e->to_block_id, cfg_edge_type_to_string(e->type));
        if (i < cfg->edge_count - 1) fputc(',', out);
        fputc('\n', out);
    }
    fputs("  ]\n", out);

    fputs("}\n", out);
}

void json_emit_ast(const AstNode *ast, FILE *out) {
    if (!ast || !out) return;
    ast_to_json(ast, out);
}
