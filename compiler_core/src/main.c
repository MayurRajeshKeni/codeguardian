#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "tokens.h"
#include "ast.h"
#include "tac.h"
#include "cfg.h"
#include "json_emit.h"
#include "parser.tab.h"

extern FILE *yyin;
extern int yylex(void);
extern int yyparse(void);
extern int current_line;
extern int current_column;
extern char *yytext;
extern YYSTYPE yylval;
extern YYLTYPE yylloc;
extern AstNode *root_ast;

typedef enum {
    MODE_CFG_JSON,      /* Default: emit CFG.json */
    MODE_AST_JSON,      /* Emit AST.json */
    MODE_TAC,           /* Print linear TAC quadruples */
    MODE_LEX,           /* Print token stream */
    MODE_PARSE_ONLY     /* Validate syntax only */
} ExecutionMode;

static void print_usage(const char *prog_name) {
    fprintf(stdout, "CodeGuardian Compiler Frontend (Member 1)\n");
    fprintf(stdout, "Usage: %s [options] <source_file.c>\n\n", prog_name);
    fprintf(stdout, "Options:\n");
    fprintf(stdout, "  --cfg, -c          Synthesize Control Flow Graph and emit CFG.json (default)\n");
    fprintf(stdout, "  --ast, -a          Emit AST.json representation\n");
    fprintf(stdout, "  --tac, -t          Lower AST to linear Three-Address Code (TAC)\n");
    fprintf(stdout, "  --lex, -l          Run lexical analysis and print token stream\n");
    fprintf(stdout, "  --parse, -p        Run syntax validation only\n");
    fprintf(stdout, "  -o <output_file>   Write output to file instead of stdout\n");
    fprintf(stdout, "  --help, -h         Display this help message\n");
}

static int run_lexer_mode(FILE *fp, FILE *out) {
    yyin = fp;
    current_line = 1;
    current_column = 1;

    int token;
    int error_count = 0;
    int token_count = 0;

    fprintf(out, "%-6s %-8s %-20s %-20s\n", "LINE", "COL", "TOKEN TYPE", "LEXEME");
    fprintf(out, "------------------------------------------------------------\n");

    while ((token = yylex()) != 0) {
        token_count++;
        const char *type_str = token_type_to_string((TokenType)token);

        char lexeme_display[256];
        if (token == TOK_INT_LITERAL) {
            snprintf(lexeme_display, sizeof(lexeme_display), "%d", yylval.int_val);
        } else if (token == TOK_STRING_LITERAL || token == TOK_IDENTIFIER) {
            snprintf(lexeme_display, sizeof(lexeme_display), "%s", yylval.str_val);
        } else {
            snprintf(lexeme_display, sizeof(lexeme_display), "%s", yytext);
        }

        fprintf(out, "[%4d, %4d] %-20s %s\n",
                yylloc.first_line,
                yylloc.first_column,
                type_str,
                lexeme_display);

        if (token == TOK_ERROR) {
            error_count++;
        }
    }

    fprintf(out, "------------------------------------------------------------\n");
    fprintf(out, "Total Tokens: %d | Lexical Errors: %d\n", token_count, error_count);

    return error_count > 0 ? 1 : 0;
}

int main(int argc, char *argv[]) {
    if (argc < 2) {
        print_usage(argv[0]);
        return 1;
    }

    const char *source_path = NULL;
    const char *output_path = NULL;
    ExecutionMode mode = MODE_CFG_JSON;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--help") == 0 || strcmp(argv[i], "-h") == 0) {
            print_usage(argv[0]);
            return 0;
        } else if (strcmp(argv[i], "--lex") == 0 || strcmp(argv[i], "-l") == 0) {
            mode = MODE_LEX;
        } else if (strcmp(argv[i], "--parse") == 0 || strcmp(argv[i], "-p") == 0) {
            mode = MODE_PARSE_ONLY;
        } else if (strcmp(argv[i], "--ast") == 0 || strcmp(argv[i], "-a") == 0) {
            mode = MODE_AST_JSON;
        } else if (strcmp(argv[i], "--tac") == 0 || strcmp(argv[i], "-t") == 0) {
            mode = MODE_TAC;
        } else if (strcmp(argv[i], "--cfg") == 0 || strcmp(argv[i], "-c") == 0) {
            mode = MODE_CFG_JSON;
        } else if (strcmp(argv[i], "-o") == 0) {
            if (i + 1 < argc) {
                output_path = argv[++i];
            } else {
                fprintf(stderr, "Error: -o option requires an argument.\n");
                return 1;
            }
        } else if (argv[i][0] == '-') {
            fprintf(stderr, "Unknown option: %s\n", argv[i]);
            print_usage(argv[0]);
            return 1;
        } else {
            source_path = argv[i];
        }
    }

    if (!source_path) {
        fprintf(stderr, "Error: No input source file provided.\n");
        print_usage(argv[0]);
        return 1;
    }

    FILE *fp = fopen(source_path, "r");
    if (!fp) {
        fprintf(stderr, "Error: Unable to open file '%s'\n", source_path);
        return 1;
    }

    FILE *out = stdout;
    if (output_path) {
        out = fopen(output_path, "w");
        if (!out) {
            fprintf(stderr, "Error: Unable to open output file '%s'\n", output_path);
            fclose(fp);
            return 1;
        }
    }

    int exit_code = 0;

    if (mode == MODE_LEX) {
        exit_code = run_lexer_mode(fp, out);
    } else {
        yyin = fp;
        current_line = 1;
        current_column = 1;
        root_ast = NULL;

        int parse_result = yyparse();
        if (parse_result != 0 || !root_ast) {
            fprintf(stderr, "[CodeGuardian] FAILED: '%s' syntax validation failed.\n", source_path);
            exit_code = 1;
        } else if (mode == MODE_PARSE_ONLY) {
            fprintf(out, "[CodeGuardian] SUCCESS: '%s' passed Mini-C syntax validation (0 errors).\n", source_path);
            exit_code = 0;
        } else if (mode == MODE_AST_JSON) {
            json_emit_ast(root_ast, out);
            exit_code = 0;
        } else {
            /* Lower AST to TAC */
            TacProgram *tac_prog = tac_lower_ast(root_ast);

            if (mode == MODE_TAC) {
                tac_print(tac_prog);
                exit_code = 0;
            } else {
                /* Synthesize CFG with Leader Partitioning */
                CfgGraph *cfg = cfg_build_from_tac(tac_prog);

                /* Serialize to CFG.json */
                json_emit_cfg(cfg, out);

                cfg_free_graph(cfg);
                exit_code = 0;
            }

            tac_free_program(tac_prog);
        }

        if (root_ast) {
            ast_free(root_ast);
            root_ast = NULL;
        }
    }

    fclose(fp);
    if (output_path && out) {
        fclose(out);
    }

    return exit_code;
}
