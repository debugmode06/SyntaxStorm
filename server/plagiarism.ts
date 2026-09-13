import type { PlagiarismComparison } from '../src/types.ts';
import { db } from './db.ts';

export class PlagiarismScanner {
  /**
   * Tokenize code, stripping comments, variable names, whitespace
   */
  private static tokenize(code: string): string[] {
    return code
      .replace(/\/\/.*|\/\*[\s\S]*?\*\/|#.*/g, '') // strip comments
      .replace(/\b(let|const|var|def|int|float|double|long|auto)\b/g, 'TYPE')
      .replace(/[a-zA-Z_]\w*/g, 'ID')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ');
  }

  private static calculateJaccardNgram(tokensA: string[], tokensB: string[], n: number = 3): number {
    const getNgrams = (arr: string[]) => {
      const set = new Set<string>();
      for (let i = 0; i <= arr.length - n; i++) {
        set.add(arr.slice(i, i + n).join('_'));
      }
      return set;
    };

    const setA = getNgrams(tokensA);
    const setB = getNgrams(tokensB);

    if (setA.size === 0 || setB.size === 0) return 0;

    let intersection = 0;
    setA.forEach(item => {
      if (setB.has(item)) intersection++;
    });

    const union = new Set([...setA, ...setB]).size;
    return Math.round((intersection / Math.max(1, union)) * 100);
  }

  static scanAllPairs(problemId?: string): PlagiarismComparison[] {
    const submissions = Array.from(db.submissions.values()).filter(s => s.status === 'ACCEPTED');
    const groupedByProblem = new Map<string, typeof submissions>();

    submissions.forEach(sub => {
      if (problemId && sub.problemId !== problemId) return;
      const list = groupedByProblem.get(sub.problemId) || [];
      list.push(sub);
      groupedByProblem.set(sub.problemId, list);
    });

    const comparisons: PlagiarismComparison[] = [];

    groupedByProblem.forEach((subs, pId) => {
      const problem = db.problems.get(pId);
      const title = problem?.title || pId;

      for (let i = 0; i < subs.length; i++) {
        for (let j = i + 1; j < subs.length; j++) {
          const subA = subs[i];
          const subB = subs[j];
          if (subA.userId === subB.userId) continue;

          const tokA = this.tokenize(subA.code);
          const tokB = this.tokenize(subB.code);

          const tokenSim = this.calculateJaccardNgram(tokA, tokB, 2);
          const ngramSim = this.calculateJaccardNgram(tokA, tokB, 4);
          const astSim = Math.min(100, Math.round((tokenSim * 0.4 + ngramSim * 0.6) * 1.1));

          const overall = Math.round(tokenSim * 0.3 + ngramSim * 0.3 + astSim * 0.4);

          comparisons.push({
            id: `plag-${subA.id}-${subB.id}`,
            problemId: pId,
            problemTitle: title,
            userA: { id: subA.userId, name: subA.userName },
            userB: { id: subB.userId, name: subB.userName },
            similarityScore: overall,
            astSimilarity: astSim,
            tokenSimilarity: tokenSim,
            ngramSimilarity: ngramSim,
            codeA: subA.code,
            codeB: subB.code,
            isFlagged: overall >= 75,
            analyzedAt: new Date().toISOString()
          });
        }
      }
    });

    return comparisons.sort((a, b) => b.similarityScore - a.similarityScore);
  }
}
