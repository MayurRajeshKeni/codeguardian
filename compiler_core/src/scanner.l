%{
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "tokens.h"
#include "parser.tab.h"

int current_line = 1;
int current_column = 1;

static void update_loc(void) {
    yylloc.first_line = current_line;
    yylloc.first_column = current_column;
    yylloc.last_line = current_line;
    yylloc.last_column = current_column + yyleng - 1;
    current_column += yyleng;
}
%}

%option noyywrap
%option nounput
%option noinput

%x COMMENT

%%

"/*"                { BEGIN(COMMENT); }
<COMMENT>"*/"       { BEGIN(INITIAL); }
<COMMENT>\n         { current_line++; current_column = 1; }
<COMMENT>.          { current_column += yyleng; }
<COMMENT><<EOF>>    {
    fprintf(stderr, "[Lexical Error] Line %d, Column %d: Unterminated block comment\n", current_line, current_column);
    return TOK_ERROR;
}

"//"[^\r\n]*        { /* Single-line comment: ignored */ }

[ \t\r]+            { current_column += yyleng; }
\n                  { current_line++; current_column = 1; }

"int"               { update_loc(); return TOK_INT; }
"bool"              { update_loc(); return TOK_BOOL; }
"void"              { update_loc(); return TOK_VOID; }
"if"                { update_loc(); return TOK_IF; }
"else"              { update_loc(); return TOK_ELSE; }
"while"             { update_loc(); return TOK_WHILE; }
"return"            { update_loc(); return TOK_RETURN; }
"true"              { update_loc(); yylval.int_val = 1; return TOK_TRUE; }
"false"             { update_loc(); yylval.int_val = 0; return TOK_FALSE; }

"=="                { update_loc(); return TOK_EQ; }
"!="                { update_loc(); return TOK_NEQ; }
"<="                { update_loc(); return TOK_LE; }
">="                { update_loc(); return TOK_GE; }
"&&"                { update_loc(); return TOK_AND; }
"||"                { update_loc(); return TOK_OR; }

"="                 { update_loc(); return TOK_ASSIGN; }
"+"                 { update_loc(); return TOK_PLUS; }
"-"                 { update_loc(); return TOK_MINUS; }
"*"                 { update_loc(); return TOK_STAR; }
"/"                 { update_loc(); return TOK_SLASH; }
"%"                 { update_loc(); return TOK_PERCENT; }
"<"                 { update_loc(); return TOK_LT; }
">"                 { update_loc(); return TOK_GT; }
"!"                 { update_loc(); return TOK_NOT; }

";"                 { update_loc(); return TOK_SEMI; }
","                 { update_loc(); return TOK_COMMA; }
"("                 { update_loc(); return TOK_LPAREN; }
")"                 { update_loc(); return TOK_RPAREN; }
"{"                 { update_loc(); return TOK_LBRACE; }
"}"                 { update_loc(); return TOK_RBRACE; }

[0-9]+              {
    update_loc();
    yylval.int_val = atoi(yytext);
    return TOK_INT_LITERAL;
}

\"([^\"\\\n]|\\.)*\" {
    update_loc();
    strncpy(yylval.str_val, yytext, sizeof(yylval.str_val) - 1);
    yylval.str_val[sizeof(yylval.str_val) - 1] = '\0';
    return TOK_STRING_LITERAL;
}

[a-zA-Z_][a-zA-Z0-9_]* {
    update_loc();
    strncpy(yylval.str_val, yytext, sizeof(yylval.str_val) - 1);
    yylval.str_val[sizeof(yylval.str_val) - 1] = '\0';
    return TOK_IDENTIFIER;
}

.                   {
    update_loc();
    fprintf(stderr, "[Lexical Error] Line %d, Column %d: Unrecognized token '%s'\n", current_line, current_column - yyleng, yytext);
    return TOK_ERROR;
}

%%
