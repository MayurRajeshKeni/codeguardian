// Powerset taint lattice (P(V), subset-of) with join = union.
// Reference: Aho, Lam, Sethi, Ullman, "Compilers: Principles, Techniques, and Tools",
// 2nd ed., section 9.3 (Foundations of Data-Flow Analysis): semilattice, meet/join, finite height.
// All functions are pure: inputs are never mutated.

export const emptySet = () => new Set();

export function union(a, b) {
  const result = new Set(a);
  for (const item of b) result.add(item);
  return result;
}

export function difference(a, b) {
  const result = new Set();
  for (const item of a) if (!b.has(item)) result.add(item);
  return result;
}

export function equals(a, b) {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
}

export function isSubset(a, b) {
  for (const item of a) if (!b.has(item)) return false;
  return true;
}

// Deterministic comparator: declared variables first (in declaration order), then the rest alphabetically.
export function makeVariableComparator(declaredVariables) {
  const rank = new Map(declaredVariables.map((name, i) => [name, i]));
  return (a, b) => {
    const ra = rank.has(a) ? rank.get(a) : Infinity;
    const rb = rank.has(b) ? rank.get(b) : Infinity;
    if (ra !== rb) return ra < rb ? -1 : 1;
    if (a === b) return 0;
    return a < b ? -1 : 1;
  };
}

export const toOrderedArray = (set, compare) => [...set].sort(compare);
