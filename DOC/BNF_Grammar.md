# Mini-C Formal Grammar Specification (BNF) — CodeGuardian
**Compiler-Based Static Security Analysis Engine**
**Author**: Member 1 (Compiler Core)
**Phase**: Phase 1 — Grammar Specification & Data Contracts

---

## 1. Introduction & Language Overview

**Mini-C** is a deterministic, strongly typed imperative subset of C designed for static program analysis, control flow synthesis, and data-flow security verification. Mini-C eliminates dynamic heap allocation, pointers, structs, and preprocessor complexity to guarantee deterministic LALR(1) parsing and mathematical convergence of static taint lattices.

Mini-C supports:
- Scalar primitive types: `int`, `bool`, and `void`
- Structured control flow: `if`, `if-else`, and `while`
- Expressions: Full arithmetic, relational, and boolean logic with standard C precedence
- Functions & Procedures: Global function declarations with typed parameter lists
- Function Calls: Invocations with comma-separated arguments, including security primitives (`read_input`, `sanitize`, `execute_query`, etc.)

---

## 2. Lexical Grammar & Token Definitions

### 2.1 Keywords
```bnf
<keyword> ::= "int" | "bool" | "void"
            | "if"  | "else" | "while"
            | "return" | "true" | "false"
```

### 2.2 Identifiers & Literals
```bnf
<letter>       ::= [a-zA-Z_]
<digit>        ::= [0-9]
<identifier>   ::= <letter> ( <letter> | <digit> )*
<int_literal>  ::= <digit>+
<bool_literal> ::= "true" | "false"
<str_literal>  ::= '"' ( [^"\\\n] | '\\' . )* '"'
```

### 2.3 Operators & Punctuation
```bnf
<arith_op>   ::= "+" | "-" | "*" | "/" | "%"
<rel_op>     ::= "==" | "!=" | "<=" | ">=" | "<" | ">"
<logic_op>   ::= "&&" | "||" | "!"
<assign_op>  ::= "="
<punct>      ::= ";" | "," | "(" | ")" | "{" | "}"
```

### 2.4 Comments & Whitespace
```bnf
<whitespace> ::= [ \t\r\n]+
<line_cmt>   ::= "//" [^\n]*
<block_cmt>  ::= "/*" ( [^*] | "*"+ [^*/] )* "*"+ "/"
```

---

## 3. Concrete Syntax Grammar (BNF / EBNF)

### 3.1 Program & Declarations
```bnf
<program> ::= <decl_list>

<decl_list> ::= <decl>
              | <decl_list> <decl>

<decl> ::= <var_decl>
         | <func_decl>

<type_specifier> ::= "int"
                   | "bool"
                   | "void"

<var_decl> ::= <type_specifier> <identifier> ";"
             | <type_specifier> <identifier> "=" <expr> ";"

<func_decl> ::= <type_specifier> <identifier> "(" <param_list_opt> ")" <compound_stmt>

<param_list_opt> ::= ε
                   | <param_list>

<param_list> ::= <param>
               | <param_list> "," <param>

<param> ::= <type_specifier> <identifier>
```

### 3.2 Statements
```bnf
<stmt> ::= <var_decl>
         | <expr_stmt>
         | <compound_stmt>
         | <if_stmt>
         | <while_stmt>
         | <return_stmt>

<stmt_list_opt> ::= ε
                  | <stmt_list>

<stmt_list> ::= <stmt>
              | <stmt_list> <stmt>

<compound_stmt> ::= "{" <stmt_list_opt> "}"

<expr_stmt> ::= ";"
              | <expr> ";"

<if_stmt> ::= "if" "(" <expr> ")" <stmt>
            | "if" "(" <expr> ")" <stmt> "else" <stmt>

<while_stmt> ::= "while" "(" <expr> ")" <stmt>

<return_stmt> ::= "return" ";"
                | "return" <expr> ";"
```

### 3.3 Expressions & Operator Precedence

Mini-C expressions strictly enforce standard C operator precedence, formalized below in an unambiguous stratified grammar (and mapped directly to Bison `%left` / `%right` directives).

```bnf
<expr> ::= <assign_expr>

<assign_expr> ::= <identifier> "=" <assign_expr>
                | <logical_or_expr>

<logical_or_expr> ::= <logical_and_expr>
                    | <logical_or_expr> "||" <logical_and_expr>

<logical_and_expr> ::= <equality_expr>
                     | <logical_and_expr> "&&" <equality_expr>

<equality_expr> ::= <relational_expr>
                  | <equality_expr> "==" <relational_expr>
                  | <equality_expr> "!=" <relational_expr>

<relational_expr> ::= <additive_expr>
                    | <relational_expr> "<"  <additive_expr>
                    | <relational_expr> "<=" <additive_expr>
                    | <relational_expr> ">"  <additive_expr>
                    | <relational_expr> ">=" <additive_expr>

<additive_expr> ::= <multiplicative_expr>
                  | <additive_expr> "+" <multiplicative_expr>
                  | <additive_expr> "-" <multiplicative_expr>

<multiplicative_expr> ::= <unary_expr>
                        | <multiplicative_expr> "*" <unary_expr>
                        | <multiplicative_expr> "/" <unary_expr>
                        | <multiplicative_expr> "%" <unary_expr>

<unary_expr> ::= <postfix_expr>
               | "+" <unary_expr>
               | "-" <unary_expr>
               | "!" <unary_expr>

<postfix_expr> ::= <primary_expr>
                 | <identifier> "(" <arg_list_opt> ")"

<arg_list_opt> ::= ε
                 | <arg_list>

<arg_list> ::= <expr>
             | <arg_list> "," <expr>

<primary_expr> ::= <identifier>
                 | <int_literal>
                 | <str_literal>
                 | <bool_literal>
                 | "(" <expr> ")"
```

---

## 4. Operator Precedence & Associativity Table

| Precedence | Operator | Description | Associativity | Bison Directive |
| :---: | :---: | :---: | :---: | :---: |
| 1 (Lowest) | `=` | Simple Assignment | Right | `%right ASSIGN` |
| 2 | `\|\|` | Logical OR | Left | `%left OR` |
| 3 | `&&` | Logical AND | Left | `%left AND` |
| 4 | `==`, `!=` | Equality / Inequality | Left | `%left EQ NEQ` |
| 5 | `<`, `<=`, `>`, `>=` | Relational Comparisons | Left | `%left LT LE GT GE` |
| 6 | `+`, `-` | Addition / Subtraction | Left | `%left PLUS MINUS` |
| 7 | `*`, `/`, `%` | Multiplication / Division / Modulo | Left | `%left STAR SLASH PERCENT` |
| 8 (Highest) | `!`, `+`, `-` (unary) | Logical NOT, Unary Sign | Right | `%right UMINUS UPLUS NOT` |

---

## 5. Ambiguity Resolution & Dangling-Else Handling

In standard C, the grammar for `if-else` contains an inherent shift/reduce ambiguity:
```
if ( e1 ) if ( e2 ) s1 else s2
```
To ensure that `else` associates unambiguously with the nearest preceding unmatched `if`, Bison precedence directives are declared:
```yacc
%nonassoc LOWER_THAN_ELSE
%nonassoc ELSE

%%
if_stmt:
      TOK_IF '(' expr ')' stmt %prec LOWER_THAN_ELSE
    | TOK_IF '(' expr ')' stmt TOK_ELSE stmt
    ;
```
This forces Bison to shift `TOK_ELSE` upon encountering the token, resolving the conflict in accordance with standard C semantics.

---

## 6. Built-in Security Primitives

Mini-C recognizes standard security analysis primitives as syntactic function calls conforming to `<postfix_expr>`:

| Primitive | Signature | Role in Static Analysis |
| :--- | :--- | :--- |
| `read_input` | `int read_input()` | Taint Source ($GEN$) |
| `get_param` | `int get_param(name)` | Taint Source ($GEN$) |
| `sanitize` | `int sanitize(var)` | Taint Cleanser ($KILL$) |
| `escape_sql` | `int escape_sql(var)` | Taint Cleanser ($KILL$) |
| `html_encode` | `int html_encode(var)` | Taint Cleanser ($KILL$) |
| `execute_query` | `void execute_query(sql)` | Security Sink (SQL Injection / CWE-89) |
| `system_exec` | `void system_exec(cmd)` | Security Sink (Command Injection / CWE-78) |
| `render_output`| `void render_output(html)`| Security Sink (XSS / CWE-79) |
