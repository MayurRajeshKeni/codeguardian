#include "ast.h"
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

AstNode* ast_create_node(AstNodeType type, int line, int column) {
    AstNode *node = (AstNode*)malloc(sizeof(AstNode));
    if (!node) {
        fprintf(stderr, "[Fatal Error] Out of memory in ast_create_node\n");
        exit(EXIT_FAILURE);
    }

    node->type = type;
    node->line = line;
    node->column = column;
    node->name = NULL;
    node->data_type = NULL;
    node->int_val = 0;
    node->str_val = NULL;
    node->binop = BINOP_NONE;
    node->unop = UNOP_NONE;

    node->child_count = 0;
    node->child_capacity = 4;
    node->children = (AstNode**)malloc(sizeof(AstNode*) * node->child_capacity);
    if (!node->children) {
        fprintf(stderr, "[Fatal Error] Out of memory in ast_create_node (children array)\n");
        free(node);
        exit(EXIT_FAILURE);
    }

    return node;
}

void ast_add_child(AstNode *parent, AstNode *child) {
    if (!parent || !child) return;

    if (parent->child_count >= parent->child_capacity) {
        parent->child_capacity *= 2;
        AstNode **new_children = (AstNode**)realloc(parent->children, sizeof(AstNode*) * parent->child_capacity);
        if (!new_children) {
            fprintf(stderr, "[Fatal Error] Out of memory expanding AST children\n");
            exit(EXIT_FAILURE);
        }
        parent->children = new_children;
    }

    parent->children[parent->child_count++] = child;
}

void ast_set_name(AstNode *node, const char *name) {
    if (!node) return;
    if (node->name) free(node->name);
    node->name = safe_strdup(name);
}

void ast_set_data_type(AstNode *node, const char *data_type) {
    if (!node) return;
    if (node->data_type) free(node->data_type);
    node->data_type = safe_strdup(data_type);
}

void ast_set_str_val(AstNode *node, const char *str) {
    if (!node) return;
    if (node->str_val) free(node->str_val);
    node->str_val = safe_strdup(str);
}

void ast_free(AstNode *node) {
    if (!node) return;

    for (int i = 0; i < node->child_count; i++) {
        ast_free(node->children[i]);
    }
    free(node->children);

    if (node->name) free(node->name);
    if (node->data_type) free(node->data_type);
    if (node->str_val) free(node->str_val);

    free(node);
}

const char* ast_node_type_to_string(AstNodeType type) {
    switch (type) {
        case AST_PROGRAM:        return "Program";
        case AST_FUNC_DECL:      return "FunctionDecl";
        case AST_VAR_DECL:       return "VarDecl";
        case AST_PARAM:          return "Param";
        case AST_COMPOUND_STMT:  return "CompoundStmt";
        case AST_EXPR_STMT:      return "ExprStmt";
        case AST_IF_STMT:        return "IfStmt";
        case AST_WHILE_STMT:     return "WhileStmt";
        case AST_RETURN_STMT:    return "ReturnStmt";
        case AST_ASSIGN_EXPR:    return "AssignExpr";
        case AST_BINARY_EXPR:    return "BinaryExpr";
        case AST_UNARY_EXPR:     return "UnaryExpr";
        case AST_CALL_EXPR:      return "CallExpr";
        case AST_IDENTIFIER:     return "Identifier";
        case AST_INT_LITERAL:    return "IntLiteral";
        case AST_STRING_LITERAL: return "StringLiteral";
        case AST_BOOL_LITERAL:   return "BoolLiteral";
        default:                 return "UnknownNode";
    }
}

const char* binop_to_string(BinaryOp op) {
    switch (op) {
        case BINOP_ADD:  return "+";
        case BINOP_SUB:  return "-";
        case BINOP_MUL:  return "*";
        case BINOP_DIV:  return "/";
        case BINOP_MOD:  return "%";
        case BINOP_EQ:   return "==";
        case BINOP_NEQ:  return "!=";
        case BINOP_LT:   return "<";
        case BINOP_LE:   return "<=";
        case BINOP_GT:   return ">";
        case BINOP_GE:   return ">=";
        case BINOP_AND:  return "&&";
        case BINOP_OR:   return "||";
        default:         return "?";
    }
}

const char* unop_to_string(UnaryOp op) {
    switch (op) {
        case UNOP_NOT:   return "!";
        case UNOP_MINUS: return "-";
        case UNOP_PLUS:  return "+";
        default:         return "?";
    }
}

void ast_print(const AstNode *node, int indent) {
    if (!node) return;

    for (int i = 0; i < indent; i++) printf("  ");
    printf("%s", ast_node_type_to_string(node->type));

    if (node->name) printf(" [name: '%s']", node->name);
    if (node->data_type) printf(" [type: '%s']", node->data_type);
    if (node->type == AST_INT_LITERAL || node->type == AST_BOOL_LITERAL) {
        printf(" [val: %d]", node->int_val);
    }
    if (node->str_val) printf(" [str: '%s']", node->str_val);
    if (node->type == AST_BINARY_EXPR) printf(" [op: '%s']", binop_to_string(node->binop));
    if (node->type == AST_UNARY_EXPR) printf(" [op: '%s']", unop_to_string(node->unop));

    printf(" (line %d)\n", node->line);

    for (int i = 0; i < node->child_count; i++) {
        ast_print(node->children[i], indent + 1);
    }
}

static void print_indent(FILE *out, int indent) {
    for (int i = 0; i < indent; i++) fputs("  ", out);
}

static void ast_to_json_internal(const AstNode *node, FILE *out, int indent) {
    if (!node) {
        fputs("null", out);
        return;
    }

    fputs("{\n", out);
    print_indent(out, indent + 1);
    fprintf(out, "\"nodeType\": \"%s\",\n", ast_node_type_to_string(node->type));

    print_indent(out, indent + 1);
    fprintf(out, "\"line\": %d", node->line);

    if (node->name) {
        fprintf(out, ",\n");
        print_indent(out, indent + 1);
        fprintf(out, "\"name\": \"%s\"", node->name);
    }
    if (node->data_type) {
        fprintf(out, ",\n");
        print_indent(out, indent + 1);
        fprintf(out, "\"dataType\": \"%s\"", node->data_type);
    }
    if (node->type == AST_INT_LITERAL || node->type == AST_BOOL_LITERAL) {
        fprintf(out, ",\n");
        print_indent(out, indent + 1);
        fprintf(out, "\"value\": %d", node->int_val);
    }
    if (node->str_val) {
        fprintf(out, ",\n");
        print_indent(out, indent + 1);
        fprintf(out, "\"value\": \"%s\"", node->str_val);
    }
    if (node->type == AST_BINARY_EXPR) {
        fprintf(out, ",\n");
        print_indent(out, indent + 1);
        fprintf(out, "\"op\": \"%s\"", binop_to_string(node->binop));
    }
    if (node->type == AST_UNARY_EXPR) {
        fprintf(out, ",\n");
        print_indent(out, indent + 1);
        fprintf(out, "\"op\": \"%s\"", unop_to_string(node->unop));
    }

    if (node->child_count > 0) {
        fprintf(out, ",\n");
        print_indent(out, indent + 1);
        fputs("\"children\": [\n", out);
        for (int i = 0; i < node->child_count; i++) {
            print_indent(out, indent + 2);
            ast_to_json_internal(node->children[i], out, indent + 2);
            if (i < node->child_count - 1) fputc(',', out);
            fputc('\n', out);
        }
        print_indent(out, indent + 1);
        fputs("]\n", out);
    } else {
        fputc('\n', out);
    }

    print_indent(out, indent);
    fputs("}", out);
}

void ast_to_json(const AstNode *node, FILE *out) {
    if (!node || !out) return;
    ast_to_json_internal(node, out, 0);
    fputc('\n', out);
}
