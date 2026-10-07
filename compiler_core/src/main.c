#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "tokens.h"
#include "parser.tab.h"

extern FILE *yyin;
extern int yylex(void);
extern int yyparse(void);
extern int current_line;
extern int current_column;
extern char *yytext;
extern YYSTYPE yylval;
extern YYLTYPE yylloc;

static void print_usage(const char *prog_name) {
    fprintf(stdout, "CodeGuardian Compiler Frontend (Member 1)\n");
    fprintf(stdout, "Usage: %s [options] <source_file.c>\n", prog_name);
    fprintf(stdout, "Options:\n");
    fprintf(stdout, "  --lex, -l     Run lexical analysis and print token stream\n");
    fprintf(stdout, "  --parse, -p   Run syntax parser (default)\n");
    fprintf(stdout, "  --help, -h    Display this help message\n");
}

static int run_lexer_mode(FILE *fp) {
    yyin = fp;
    current_line = 1;
    current_column = 1;

    int token;
    int error_count = 0;
    int token_count = 0;

    fprintf(stdout, "%-6s %-8s %-20s %-20s\n", "LINE", "COL", "TOKEN TYPE", "LEXEME");
    fprintf(stdout, "------------------------------------------------------------\n");

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

        fprintf(stdout, "[%4d, %4d] %-20s %s\n",
                yylloc.first_line,
                yylloc.first_column,
                type_str,
                lexeme_display);

        if (token == TOK_ERROR) {
            error_count++;
        }
    }

    fprintf(stdout, "------------------------------------------------------------\n");
    fprintf(stdout, "Total Tokens: %d | Lexical Errors: %d\n", token_count, error_count);

    return error_count > 0 ? 1 : 0;
}

static int run_parser_mode(FILE *fp, const char *filename) {
    yyin = fp;
    current_line = 1;
    current_column = 1;

    fprintf(stdout, "[CodeGuardian] Parsing '%s'...\n", filename);
    int parse_result = yyparse();

    if (parse_result == 0) {
        fprintf(stdout, "[CodeGuardian] SUCCESS: '%s' passed Mini-C syntax validation (0 errors).\n", filename);
        return 0;
    } else {
        fprintf(stderr, "[CodeGuardian] FAILED: '%s' syntax validation failed.\n", filename);
        return 1;
    }
}

int main(int argc, char *argv[]) {
    if (argc < 2) {
        print_usage(argv[0]);
        return 1;
    }

    const char *source_path = NULL;
    int mode_lex = 0;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--help") == 0 || strcmp(argv[i], "-h") == 0) {
            print_usage(argv[0]);
            return 0;
        } else if (strcmp(argv[i], "--lex") == 0 || strcmp(argv[i], "-l") == 0) {
            mode_lex = 1;
        } else if (strcmp(argv[i], "--parse") == 0 || strcmp(argv[i], "-p") == 0) {
            mode_lex = 0;
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

    int result = 0;
    if (mode_lex) {
        result = run_lexer_mode(fp);
    } else {
        result = run_parser_mode(fp, source_path);
    }

    fclose(fp);
    return result;
}
