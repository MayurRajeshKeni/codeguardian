import { readFileSync } from 'node:fs';

export const DEFAULT_RULES_URL = new URL('./security_rules.json', import.meta.url);

export function loadRules(location = DEFAULT_RULES_URL) {
  return JSON.parse(readFileSync(location, 'utf8'));
}
