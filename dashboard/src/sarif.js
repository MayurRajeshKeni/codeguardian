// SARIF 2.1.0 Exporter for CodeGuardian Static Taint Analysis
export function generateSarifReport({ audit, source, name, cfg }) {
  const rules = [
    {
      id: 'CWE-89',
      name: 'SQLInjection',
      shortDescription: { text: 'Improper Neutralization of Special Elements used in an SQL Command (SQL Injection)' },
      defaultConfiguration: { level: 'error' },
      helpUri: 'https://cwe.mitre.org/data/definitions/89.html',
    },
    {
      id: 'CWE-78',
      name: 'CommandInjection',
      shortDescription: { text: 'Improper Neutralization of Special Elements used in an OS Command (Command Injection)' },
      defaultConfiguration: { level: 'error' },
      helpUri: 'https://cwe.mitre.org/data/definitions/78.html',
    },
    {
      id: 'CWE-79',
      name: 'CrossSiteScripting',
      shortDescription: { text: 'Improper Neutralization of Input During Web Page Generation (XSS)' },
      defaultConfiguration: { level: 'warning' },
      helpUri: 'https://cwe.mitre.org/data/definitions/79.html',
    },
  ];

  const results = (audit?.vulnerabilities || []).map((v) => ({
    ruleId: v.cwe,
    ruleIndex: v.cwe === 'CWE-89' ? 0 : v.cwe === 'CWE-78' ? 1 : 2,
    level: v.severity === 'CRITICAL' ? 'error' : v.severity === 'HIGH' ? 'error' : 'warning',
    message: {
      text: `${v.type.replace(/_/g, ' ')}: untrusted taint from ${v.sourceInstruction.sourceFunction}() at line ${v.sourceInstruction.line} flows along basic blocks [${v.taintPath.join(' -> ')}] and reaches compromised sink ${v.sinkInstruction.sinkFunction}() at line ${v.sinkInstruction.line} without sanitization.`,
    },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: name || 'input.c' },
          region: {
            startLine: v.sinkInstruction.line,
            startColumn: 1,
            snippet: { text: `${v.sinkInstruction.sinkFunction}(${v.variable});` },
          },
        },
      },
    ],
    codeFlows: [
      {
        threadFlows: [
          {
            locations: [
              {
                location: {
                  message: { text: `Taint source: ${v.sourceInstruction.sourceFunction}() ingests untrusted input` },
                  physicalLocation: {
                    artifactLocation: { uri: name || 'input.c' },
                    region: { startLine: v.sourceInstruction.line },
                  },
                },
              },
              {
                location: {
                  message: { text: `Compromised sink: ${v.sinkInstruction.sinkFunction}() receives tainted argument '${v.variable}'` },
                  physicalLocation: {
                    artifactLocation: { uri: name || 'input.c' },
                    region: { startLine: v.sinkInstruction.line },
                  },
                },
              },
            ],
          },
        ],
      },
    ],
    properties: {
      severity: v.severity,
      taintPath: v.taintPath,
      remediation: v.remediation,
    },
  }));

  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'CodeGuardian Security Engine',
            semanticVersion: '0.1.0',
            informationUri: 'https://github.com/MayurRajeshKeni/codeguardian',
            rules,
          },
        },
        results,
      },
    ],
  };
}

export function downloadJsonFile(filename, data) {
  const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
