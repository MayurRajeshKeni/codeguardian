// Kildall monotone worklist solver (forward, may-analysis) over the powerset lattice.
// Reference: Kildall (1973); Aho, Lam, Sethi, Ullman, "Compilers: Principles, Techniques, and Tools",
// 2nd ed., Algorithm 9.25 (iterative algorithm for a general data-flow framework) and section 9.2.4.
//   IN[B]  = U { OUT[P] | P in Pred[B] }
//   OUT[B] = f_B(IN[B])  =  GEN[B] U (IN[B] \ KILL[B])
// Termination: |V| is finite and every f_B is monotone, so each OUT[B] can only grow and
// can change at most |V| times (least fixed point, Tarski).
import { AnalysisError } from './errors.js';
import { emptySet, equals, union } from './lattice.js';
import { transferBlock } from './transfer.js';

export function solveTaint(cfg, ruleIndex) {
  const byId = new Map(cfg.blocks.map((block) => [block.id, block]));
  const IN = new Map();
  const OUT = new Map();
  for (const block of cfg.blocks) {
    IN.set(block.id, emptySet());
    OUT.set(block.id, emptySet());
  }

  // Safety net: the theoretical bound on pops is far below this; exceeding it means a bug.
  const instructionCount = cfg.blocks.reduce((n, b) => n + b.instructions.length, 0);
  const bound = (cfg.blocks.length + 1) * (cfg.blocks.length + 1) * (instructionCount + 2);

  const worklist = cfg.blocks.map((block) => block.id);
  const queued = new Set(worklist);
  let iterations = 0;

  while (worklist.length > 0) {
    const id = worklist.shift();
    queued.delete(id);
    iterations += 1;
    if (iterations > bound) {
      throw new AnalysisError('Data-flow solver exceeded its iteration bound', [{ path: '/', message: `more than ${bound} iterations` }]);
    }

    const block = byId.get(id);
    let inSet = emptySet();
    for (const predecessor of block.predecessors) {
      if (!OUT.has(predecessor)) {
        throw new AnalysisError(`Block ${id} has unknown predecessor ${predecessor}`, [{ path: `/blocks/${id}/predecessors`, message: 'unknown block' }]);
      }
      inSet = union(inSet, OUT.get(predecessor));
    }
    IN.set(id, inSet);

    const newOut = transferBlock(block, inSet, ruleIndex).out;
    if (!equals(newOut, OUT.get(id))) {
      OUT.set(id, newOut);
      for (const successor of block.successors) {
        if (!byId.has(successor)) {
          throw new AnalysisError(`Block ${id} has unknown successor ${successor}`, [{ path: `/blocks/${id}/successors`, message: 'unknown block' }]);
        }
        if (!queued.has(successor)) {
          worklist.push(successor);
          queued.add(successor);
        }
      }
    }
  }

  return { in: IN, out: OUT, iterations };
}
