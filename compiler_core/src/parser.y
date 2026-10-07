%{
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "tokens.h"

extern int yylex(void);
extern int current_line;
extern int current_column;
void yyerror(const char *s);
%}

%locations
%define parse.error verbose

%union {
    int int_val;
    char str_val[256];
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
      decl_list
    ;

decl_list:
      decl
    | decl_list decl
    ;

decl:
      var_decl
    | func_decl
    ;

type_specifier:
      TOK_INT
    | TOK_BOOL
    | TOK_VOID
    ;

var_decl:
      type_specifier TOK_IDENTIFIER TOK_SEMI
    | type_specifier TOK_IDENTIFIER TOK_ASSIGN expr TOK_SEMI
    ;

func_decl:
      type_specifier TOK_IDENTIFIER TOK_LPAREN param_list_opt TOK_RPAREN compound_stmt
    ;

param_list_opt:
      /* empty */
    | param_list
    ;

param_list:
      param
    | param_list TOK_COMMA param
    ;

param:
      type_specifier TOK_IDENTIFIER
    ;

compound_stmt:
      TOK_LBRACE stmt_list_opt TOK_RBRACE
    ;

stmt_list_opt:
      /* empty */
    | stmt_list
    ;

stmt_list:
      stmt
    | stmt_list stmt
    ;

stmt:
      var_decl
    | expr_stmt
    | compound_stmt
    | if_stmt
    | while_stmt
    | return_stmt
    ;

expr_stmt:
      TOK_SEMI
    | expr TOK_SEMI
    ;

if_stmt:
      TOK_IF TOK_LPAREN expr TOK_RPAREN stmt %prec LOWER_THAN_ELSE
    | TOK_IF TOK_LPAREN expr TOK_RPAREN stmt TOK_ELSE stmt
    ;

while_stmt:
      TOK_WHILE TOK_LPAREN expr TOK_RPAREN stmt
    ;

return_stmt:
      TOK_RETURN TOK_SEMI
    | TOK_RETURN expr TOK_SEMI
    ;

expr:
      TOK_IDENTIFIER TOK_ASSIGN expr
    | expr TOK_OR expr
    | expr TOK_AND expr
    | expr TOK_EQ expr
    | expr TOK_NEQ expr
    | expr TOK_LT expr
    | expr TOK_LE expr
    | expr TOK_GT expr
    | expr TOK_GE expr
    | expr TOK_PLUS expr
    | expr TOK_MINUS expr
    | expr TOK_STAR expr
    | expr TOK_SLASH expr
    | expr TOK_PERCENT expr
    | TOK_NOT expr
    | TOK_MINUS expr %prec UMINUS
    | TOK_PLUS expr %prec UPLUS
    | primary_expr
    ;

primary_expr:
      TOK_IDENTIFIER
    | TOK_INT_LITERAL
    | TOK_STRING_LITERAL
    | TOK_TRUE
    | TOK_FALSE
    | TOK_IDENTIFIER TOK_LPAREN arg_list_opt TOK_RPAREN
    | TOK_LPAREN expr TOK_RPAREN
    ;

arg_list_opt:
      /* empty */
    | arg_list
    ;

arg_list:
      expr
    | arg_list TOK_COMMA expr
    ;

%%

void yyerror(const char *s) {
    fprintf(stderr, "[Syntax Error] Line %d, Column %d: %s\n", current_line, current_column, s);
}
