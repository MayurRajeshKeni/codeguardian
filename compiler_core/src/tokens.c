#include "tokens.h"

const char* token_type_to_string(TokenType type) {
    if (type == 0) {
        return "TOK_EOF";
    }

    switch (type) {
        case TOK_INT:            return "TOK_INT";
        case TOK_BOOL:           return "TOK_BOOL";
        case TOK_VOID:           return "TOK_VOID";
        case TOK_IF:             return "TOK_IF";
        case TOK_ELSE:           return "TOK_ELSE";
        case TOK_WHILE:          return "TOK_WHILE";
        case TOK_RETURN:         return "TOK_RETURN";
        case TOK_TRUE:           return "TOK_TRUE";
        case TOK_FALSE:          return "TOK_FALSE";
        case TOK_IDENTIFIER:     return "TOK_IDENTIFIER";
        case TOK_INT_LITERAL:    return "TOK_INT_LITERAL";
        case TOK_STRING_LITERAL: return "TOK_STRING_LITERAL";
        case TOK_ASSIGN:         return "TOK_ASSIGN";
        case TOK_PLUS:           return "TOK_PLUS";
        case TOK_MINUS:          return "TOK_MINUS";
        case TOK_STAR:           return "TOK_STAR";
        case TOK_SLASH:          return "TOK_SLASH";
        case TOK_PERCENT:        return "TOK_PERCENT";
        case TOK_EQ:             return "TOK_EQ";
        case TOK_NEQ:            return "TOK_NEQ";
        case TOK_LT:             return "TOK_LT";
        case TOK_LE:             return "TOK_LE";
        case TOK_GT:             return "TOK_GT";
        case TOK_GE:             return "TOK_GE";
        case TOK_AND:            return "TOK_AND";
        case TOK_OR:             return "TOK_OR";
        case TOK_NOT:            return "TOK_NOT";
        case TOK_SEMI:           return "TOK_SEMI";
        case TOK_COMMA:          return "TOK_COMMA";
        case TOK_LPAREN:         return "TOK_LPAREN";
        case TOK_RPAREN:         return "TOK_RPAREN";
        case TOK_LBRACE:         return "TOK_LBRACE";
        case TOK_RBRACE:         return "TOK_RBRACE";
        case TOK_ERROR:          return "TOK_ERROR";
        default:                 return "TOK_UNKNOWN";
    }
}
