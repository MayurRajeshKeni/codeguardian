%code requires {
    #include "ast.h"
}

%{
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "tokens.h"

extern int yylex(void);
extern int current_line;
extern int current_column;
void yyerror(const char *s);

AstNode *root_ast = NULL;
%}

%locations
%define parse.error verbose

%union {
    int int_val;
    char str_val[256];
    AstNode *ast;
}

/* Tokens */
%token <str_val> TOK_IDENTIFIER
%token <int_val> TOK_INT_LITERAL
%token <str_val> TOK_STRING_LITERAL

%token TOK_INT
%token TOK_BOOL
%token TOK_VOID
%token TOK_IF
%token TOK_ELSE
%token TOK_WHILE
%token TOK_RETURN
%token TOK_TRUE
%token TOK_FALSE

%token TOK_ASSIGN
%token TOK_PLUS
%token TOK_MINUS
%token TOK_STAR
%token TOK_SLASH
%token TOK_PERCENT
%token TOK_EQ
%token TOK_NEQ
%token TOK_LT
%token TOK_LE
%token TOK_GT
%token TOK_GE
%token TOK_AND
%token TOK_OR
%token TOK_NOT

%token TOK_SEMI
%token TOK_COMMA
%token TOK_LPAREN
%token TOK_RPAREN
%token TOK_LBRACE
%token TOK_RBRACE
%token TOK_ERROR

/* Types */
%type <str_val> type_specifier
%type <ast> program decl_list decl var_decl func_decl
%type <ast> param_list_opt param_list param
%type <ast> compound_stmt stmt_list_opt stmt_list stmt
%type <ast> expr_stmt if_stmt while_stmt return_stmt
%type <ast> expr primary_expr arg_list_opt arg_list

/* Precedence and Associativity */
%right TOK_ASSIGN
%left TOK_OR
%left TOK_AND
%left TOK_EQ TOK_NEQ
%left TOK_LT TOK_LE TOK_GT TOK_GE
%left TOK_PLUS TOK_MINUS
%left TOK_STAR TOK_SLASH TOK_PERCENT
%right UMINUS UPLUS TOK_NOT

%nonassoc LOWER_THAN_ELSE
%nonassoc TOK_ELSE

%start program

%%

program:
      decl_list {
          $$ = $1;
          root_ast = $$;
      }
    ;

decl_list:
      decl {
          $$ = ast_create_node(AST_PROGRAM, @1.first_line, @1.first_column);
          ast_add_child($$, $1);
      }
    | decl_list decl {
          $$ = $1;
          ast_add_child($$, $2);
      }
    ;

decl:
      var_decl  { $$ = $1; }
    | func_decl { $$ = $1; }
    ;

type_specifier:
      TOK_INT  { strncpy($$, "int", sizeof($$)); }
    | TOK_BOOL { strncpy($$, "bool", sizeof($$)); }
    | TOK_VOID { strncpy($$, "void", sizeof($$)); }
    ;

var_decl:
      type_specifier TOK_IDENTIFIER TOK_SEMI {
          $$ = ast_create_node(AST_VAR_DECL, @2.first_line, @2.first_column);
          ast_set_data_type($$, $1);
          ast_set_name($$, $2);
      }
    | type_specifier TOK_IDENTIFIER TOK_ASSIGN expr TOK_SEMI {
          $$ = ast_create_node(AST_VAR_DECL, @2.first_line, @2.first_column);
          ast_set_data_type($$, $1);
          ast_set_name($$, $2);
          ast_add_child($$, $4);
      }
    ;

func_decl:
      type_specifier TOK_IDENTIFIER TOK_LPAREN param_list_opt TOK_RPAREN compound_stmt {
          $$ = ast_create_node(AST_FUNC_DECL, @2.first_line, @2.first_column);
          ast_set_data_type($$, $1);
          ast_set_name($$, $2);
          if ($4) {
              ast_add_child($$, $4);
          }
          ast_add_child($$, $6);
      }
    ;

param_list_opt:
      /* empty */ { $$ = NULL; }
    | param_list  { $$ = $1; }
    ;

param_list:
      param {
          $$ = ast_create_node(AST_PROGRAM, @1.first_line, @1.first_column);
          ast_add_child($$, $1);
      }
    | param_list TOK_COMMA param {
          $$ = $1;
          ast_add_child($$, $3);
      }
    ;

param:
      type_specifier TOK_IDENTIFIER {
          $$ = ast_create_node(AST_PARAM, @2.first_line, @2.first_column);
          ast_set_data_type($$, $1);
          ast_set_name($$, $2);
      }
    ;

compound_stmt:
      TOK_LBRACE stmt_list_opt TOK_RBRACE {
          if ($2) {
              $$ = $2;
          } else {
              $$ = ast_create_node(AST_COMPOUND_STMT, @1.first_line, @1.first_column);
          }
      }
    ;

stmt_list_opt:
      /* empty */ { $$ = NULL; }
    | stmt_list   { $$ = $1; }
    ;

stmt_list:
      stmt {
          $$ = ast_create_node(AST_COMPOUND_STMT, @1.first_line, @1.first_column);
          ast_add_child($$, $1);
      }
    | stmt_list stmt {
          $$ = $1;
          ast_add_child($$, $2);
      }
    ;

stmt:
      var_decl      { $$ = $1; }
    | expr_stmt     { $$ = $1; }
    | compound_stmt { $$ = $1; }
    | if_stmt       { $$ = $1; }
    | while_stmt    { $$ = $1; }
    | return_stmt   { $$ = $1; }
    ;

expr_stmt:
      TOK_SEMI {
          $$ = ast_create_node(AST_EXPR_STMT, @1.first_line, @1.first_column);
      }
    | expr TOK_SEMI {
          $$ = ast_create_node(AST_EXPR_STMT, @1.first_line, @1.first_column);
          ast_add_child($$, $1);
      }
    ;

if_stmt:
      TOK_IF TOK_LPAREN expr TOK_RPAREN stmt %prec LOWER_THAN_ELSE {
          $$ = ast_create_node(AST_IF_STMT, @1.first_line, @1.first_column);
          ast_add_child($$, $3);
          ast_add_child($$, $5);
      }
    | TOK_IF TOK_LPAREN expr TOK_RPAREN stmt TOK_ELSE stmt {
          $$ = ast_create_node(AST_IF_STMT, @1.first_line, @1.first_column);
          ast_add_child($$, $3);
          ast_add_child($$, $5);
          ast_add_child($$, $7);
      }
    ;

while_stmt:
      TOK_WHILE TOK_LPAREN expr TOK_RPAREN stmt {
          $$ = ast_create_node(AST_WHILE_STMT, @1.first_line, @1.first_column);
          ast_add_child($$, $3);
          ast_add_child($$, $5);
      }
    ;

return_stmt:
      TOK_RETURN TOK_SEMI {
          $$ = ast_create_node(AST_RETURN_STMT, @1.first_line, @1.first_column);
      }
    | TOK_RETURN expr TOK_SEMI {
          $$ = ast_create_node(AST_RETURN_STMT, @1.first_line, @1.first_column);
          ast_add_child($$, $2);
      }
    ;

expr:
      TOK_IDENTIFIER TOK_ASSIGN expr {
          $$ = ast_create_node(AST_ASSIGN_EXPR, @2.first_line, @2.first_column);
          ast_set_name($$, $1);
          ast_add_child($$, $3);
      }
    | expr TOK_OR expr {
          $$ = ast_create_node(AST_BINARY_EXPR, @2.first_line, @2.first_column);
          $$->binop = BINOP_OR;
          ast_add_child($$, $1);
          ast_add_child($$, $3);
      }
    | expr TOK_AND expr {
          $$ = ast_create_node(AST_BINARY_EXPR, @2.first_line, @2.first_column);
          $$->binop = BINOP_AND;
          ast_add_child($$, $1);
          ast_add_child($$, $3);
      }
    | expr TOK_EQ expr {
          $$ = ast_create_node(AST_BINARY_EXPR, @2.first_line, @2.first_column);
          $$->binop = BINOP_EQ;
          ast_add_child($$, $1);
          ast_add_child($$, $3);
      }
    | expr TOK_NEQ expr {
          $$ = ast_create_node(AST_BINARY_EXPR, @2.first_line, @2.first_column);
          $$->binop = BINOP_NEQ;
          ast_add_child($$, $1);
          ast_add_child($$, $3);
      }
    | expr TOK_LT expr {
          $$ = ast_create_node(AST_BINARY_EXPR, @2.first_line, @2.first_column);
          $$->binop = BINOP_LT;
          ast_add_child($$, $1);
          ast_add_child($$, $3);
      }
    | expr TOK_LE expr {
          $$ = ast_create_node(AST_BINARY_EXPR, @2.first_line, @2.first_column);
          $$->binop = BINOP_LE;
          ast_add_child($$, $1);
          ast_add_child($$, $3);
      }
    | expr TOK_GT expr {
          $$ = ast_create_node(AST_BINARY_EXPR, @2.first_line, @2.first_column);
          $$->binop = BINOP_GT;
          ast_add_child($$, $1);
          ast_add_child($$, $3);
      }
    | expr TOK_GE expr {
          $$ = ast_create_node(AST_BINARY_EXPR, @2.first_line, @2.first_column);
          $$->binop = BINOP_GE;
          ast_add_child($$, $1);
          ast_add_child($$, $3);
      }
    | expr TOK_PLUS expr {
          $$ = ast_create_node(AST_BINARY_EXPR, @2.first_line, @2.first_column);
          $$->binop = BINOP_ADD;
          ast_add_child($$, $1);
          ast_add_child($$, $3);
      }
    | expr TOK_MINUS expr {
          $$ = ast_create_node(AST_BINARY_EXPR, @2.first_line, @2.first_column);
          $$->binop = BINOP_SUB;
          ast_add_child($$, $1);
          ast_add_child($$, $3);
      }
    | expr TOK_STAR expr {
          $$ = ast_create_node(AST_BINARY_EXPR, @2.first_line, @2.first_column);
          $$->binop = BINOP_MUL;
          ast_add_child($$, $1);
          ast_add_child($$, $3);
      }
    | expr TOK_SLASH expr {
          $$ = ast_create_node(AST_BINARY_EXPR, @2.first_line, @2.first_column);
          $$->binop = BINOP_DIV;
          ast_add_child($$, $1);
          ast_add_child($$, $3);
      }
    | expr TOK_PERCENT expr {
          $$ = ast_create_node(AST_BINARY_EXPR, @2.first_line, @2.first_column);
          $$->binop = BINOP_MOD;
          ast_add_child($$, $1);
          ast_add_child($$, $3);
      }
    | TOK_NOT expr {
          $$ = ast_create_node(AST_UNARY_EXPR, @1.first_line, @1.first_column);
          $$->unop = UNOP_NOT;
          ast_add_child($$, $2);
      }
    | TOK_MINUS expr %prec UMINUS {
          $$ = ast_create_node(AST_UNARY_EXPR, @1.first_line, @1.first_column);
          $$->unop = UNOP_MINUS;
          ast_add_child($$, $2);
      }
    | TOK_PLUS expr %prec UPLUS {
          $$ = ast_create_node(AST_UNARY_EXPR, @1.first_line, @1.first_column);
          $$->unop = UNOP_PLUS;
          ast_add_child($$, $2);
      }
    | primary_expr { $$ = $1; }
    ;

primary_expr:
      TOK_IDENTIFIER {
          $$ = ast_create_node(AST_IDENTIFIER, @1.first_line, @1.first_column);
          ast_set_name($$, $1);
      }
    | TOK_INT_LITERAL {
          $$ = ast_create_node(AST_INT_LITERAL, @1.first_line, @1.first_column);
          $$->int_val = $1;
      }
    | TOK_STRING_LITERAL {
          $$ = ast_create_node(AST_STRING_LITERAL, @1.first_line, @1.first_column);
          ast_set_str_val($$, $1);
      }
    | TOK_TRUE {
          $$ = ast_create_node(AST_BOOL_LITERAL, @1.first_line, @1.first_column);
          $$->int_val = 1;
      }
    | TOK_FALSE {
          $$ = ast_create_node(AST_BOOL_LITERAL, @1.first_line, @1.first_column);
          $$->int_val = 0;
      }
    | TOK_IDENTIFIER TOK_LPAREN arg_list_opt TOK_RPAREN {
          $$ = ast_create_node(AST_CALL_EXPR, @1.first_line, @1.first_column);
          ast_set_name($$, $1);
          if ($3) {
              for (int i = 0; i < $3->child_count; i++) {
                  ast_add_child($$, $3->children[i]);
              }
              free($3->children);
              free($3);
          }
      }
    | TOK_LPAREN expr TOK_RPAREN {
          $$ = $2;
      }
    ;

arg_list_opt:
      /* empty */ { $$ = NULL; }
    | arg_list    { $$ = $1; }
    ;

arg_list:
      expr {
          $$ = ast_create_node(AST_PROGRAM, @1.first_line, @1.first_column);
          ast_add_child($$, $1);
      }
    | arg_list TOK_COMMA expr {
          $$ = $1;
          ast_add_child($$, $3);
      }
    ;

%%

void yyerror(const char *s) {
    fprintf(stderr, "[Syntax Error] Line %d, Column %d: %s\n", current_line, current_column, s);
}
