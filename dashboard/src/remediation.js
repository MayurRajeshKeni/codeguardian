// Remediation patch computation for CodeGuardian vulnerabilities
export function computeRemediationPatch(source, vuln) {
  if (!source || !vuln || !vuln.sinkInstruction) return null;

  const lines = source.split('\n');
  const sinkLineNum = vuln.sinkInstruction.line;
  const sinkLineIdx = sinkLineNum - 1;

  if (sinkLineIdx < 0 || sinkLineIdx >= lines.length) return null;

  const variable = vuln.variable;
  const sanitizer = vuln.type === 'SQL_INJECTION'
    ? 'escape_sql'
    : vuln.type === 'COMMAND_INJECTION'
    ? 'sanitize'
    : 'html_encode';

  const originalLine = lines[sinkLineIdx];
  const indentMatch = originalLine.match(/^(\s*)/);
  const indent = indentMatch ? indentMatch[1] : '    ';
  const cleanVarName = `sanitized_${variable}`;

  // Build the sanitized replacement lines
  const sanitizedAssignment = `${indent}${cleanVarName} = ${sanitizer}(${variable});`;
  const sanitizedSinkCall = originalLine.replace(new RegExp(`\\b${variable}\\b`), cleanVarName);

  const fixLines = [
    `${indent}// [CodeGuardian Fix]: Neutralize tainted input before reaching sensitive sink`,
    sanitizedAssignment,
    sanitizedSinkCall,
  ];

  const patchedLines = [...lines];
  patchedLines.splice(sinkLineIdx, 1, ...fixLines);
  const patchedSource = patchedLines.join('\n');

  return {
    sinkLineNum,
    sanitizer,
    variable,
    cwe: vuln.cwe,
    type: vuln.type,
    originalLine,
    fixLines,
    patchedSource,
    removedLines: [originalLine],
    addedLines: fixLines,
  };
}
