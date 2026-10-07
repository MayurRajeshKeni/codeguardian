#ifndef CODEGUARDIAN_JSON_EMIT_H
#define CODEGUARDIAN_JSON_EMIT_H

#include <stdio.h>
#include "ast.h"
#include "cfg.h"

/*
 * JSON Serializers for CodeGuardian Data Contracts
 */
void json_emit_cfg(const CfgGraph *cfg, FILE *out);
void json_emit_ast(const AstNode *ast, FILE *out);

#endif /* CODEGUARDIAN_JSON_EMIT_H */
