#ifndef CODEGUARDIAN_TOKENS_H
#define CODEGUARDIAN_TOKENS_H

#include <stddef.h>
#include "ast.h"
#include "parser.tab.h"

/*
 * Token type alias mapped to Bison's generated yytokentype
 */
typedef int TokenType;

/*
 * Source location metadata
 */
typedef struct {
    int first_line;
    int first_column;
    int last_line;
    int last_column;
} SourceLocation;

/*
 * Token representation for debugging and verification
 */
typedef struct {
    TokenType type;
    char text[256];
    SourceLocation location;
} Token;

/*
 * Helper to convert token type enum to human-readable string
 */
const char* token_type_to_string(TokenType type);

#endif /* CODEGUARDIAN_TOKENS_H */
