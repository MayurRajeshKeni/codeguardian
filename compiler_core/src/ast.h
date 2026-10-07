#ifndef CODEGUARDIAN_AST_H
#define CODEGUARDIAN_AST_H

#include <stdio.h>
#include <stdbool.h>

/*
 * Abstract Syntax Tree Node Types
 * Conforming to Mini-C Formal Grammar Specification
 */
typedef enum {
    AST_PROGRAM,
    AST_FUNC_DECL,
    AST_VAR_DECL,
    AST_PARAM,
    AST_COMPOUND_STMT,
    AST_EXPR_STMT,
    AST_IF_STMT,
    AST_WHILE_STMT,
    AST_RETURN_STMT,
    AST_ASSIGN_EXPR,
    AST_BINARY_EXPR,
    AST_UNARY_EXPR,
    AST_CALL_EXPR,
    AST_IDENTIFIER,
    AST_INT_LITERAL,
    AST_STRING_LITERAL,
    AST_BOOL_LITERAL
} AstNodeType;

/*
 * Binary Operators
 */
typedef enum {
    BINOP_NONE = 0,
    BINOP_ADD,
    BINOP_SUB,
    BINOP_MUL,
    BINOP_DIV,
    BINOP_MOD,
    BINOP_EQ,
    BINOP_NEQ,
    BINOP_LT,
    BINOP_LE,
    BINOP_GT,
    BINOP_GE,
    BINOP_AND,
    BINOP_OR
} BinaryOp;

/*
 * Unary Operators
 */
typedef enum {
    UNOP_NONE = 0,
    UNOP_NOT,
    UNOP_MINUS,
    UNOP_PLUS
} UnaryOp;

/*
 * AST Node Structure
 */
typedef struct AstNode {
    AstNodeType type;
    int line;
    int column;

    /* Semantic attributes */
    char *name;         /* Identifier name, func name, or var type */
    char *data_type;    /* "int", "bool", "void" */
    int int_val;        /* Numeric or boolean value */
    char *str_val;      /* String literal contents */
    BinaryOp binop;     /* Binary operator type if AST_BINARY_EXPR */
    UnaryOp unop;       /* Unary operator type if AST_UNARY_EXPR */

    /* Children nodes (dynamically allocated array) */
    struct AstNode **children;
    int child_count;
    int child_capacity;
} AstNode;

/*
 * Constructors and Node Management
 */
AstNode* ast_create_node(AstNodeType type, int line, int column);
void ast_add_child(AstNode *parent, AstNode *child);
void ast_set_name(AstNode *node, const char *name);
void ast_set_data_type(AstNode *node, const char *data_type);
void ast_set_str_val(AstNode *node, const char *str);
void ast_free(AstNode *node);

/*
 * Visualization and Serialization
 */
const char* ast_node_type_to_string(AstNodeType type);
const char* binop_to_string(BinaryOp op);
const char* unop_to_string(UnaryOp op);
void ast_print(const AstNode *node, int indent);
void ast_to_json(const AstNode *node, FILE *out);

#endif /* CODEGUARDIAN_AST_H */
