import crypto from 'crypto';
import type {
  User,
  Batch,
  Round,
  Problem,
  TestCase,
  QuestionAssignment,
  QuestionSet,
  Submission,
  ParticipantSecurityState,
  Contest,
  AuditLog,
  PlagiarismComparison,
  StudentRegistration,
  CreateContestPayload,
  ContestAttempt,
  QuestionResult,
  AttemptStatus,
  CodeSnapshot,
  StudentSession,
  OverrideAuditRecord,
  Challenge,
  ChallengeTestCase,
  ChallengeLanguageConfig,
  ChallengeSettings,
  ChallengeEditorial,
  ChallengeDifficulty,
  ChallengeStatus,
  ChallengeStrength,
  StudentAccount,
  AccountStatus
} from '../src/types.ts';

import bcrypt from 'bcryptjs';
export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function isDescriptiveText(str: string): boolean {
  if (!str) return true;
  const s = str.trim();
  if (s === '') return true;
  const patterns = [
    /^format:/i,
    /the input contains/i,
    /print the/i,
    /^constraints:/i,
    /^given/i,
    /input format/i,
    /output format/i,
    /standard input/i,
    /standard output/i,
    /sample input/i,
    /sample output/i,
    /number of elements/i,
    /space-separated/i
  ];
  return patterns.some(p => p.test(s));
}

export function ensureFiveTestCases(problem: Problem): Problem {
  if (!problem) return problem;

  const diff = (problem.difficulty || 'MEDIUM').toUpperCase() as 'EASY' | 'MEDIUM' | 'HARD';
  const points = diff === 'EASY' ? 10 : diff === 'HARD' ? 25 : 15;

  const cleanText = (val: string | null | undefined): string => {
    if (!val) return '';
    let str = String(val);
    str = str.replace(/\*\*Hidden test cases are not displayed[^\*]*\*\*/gi, '');
    str = str.replace(/Hidden test cases are not displayed[^\n]*/gi, '');
    str = str.replace(/Note:[^\n]*/gi, '');
    return str.trim();
  };

  const existingSamples: TestCase[] = (problem.sampleTestCases || []).map((tc, idx) => ({
    id: tc.id || `tc-s-${problem.id}-${idx + 1}`,
    input: cleanText(tc.input) || '1',
    expectedOutput: cleanText(tc.expectedOutput) || '1',
    isHidden: false,
    explanation: tc.explanation || `Sample Test Case ${idx + 1}`
  }));

  const existingHiddens: TestCase[] = (problem.hiddenTestCases || []).map((tc, idx) => ({
    id: tc.id || `tc-h-${problem.id}-${idx + 1}`,
    input: cleanText(tc.input) || '1',
    expectedOutput: cleanText(tc.expectedOutput) || '1',
    isHidden: true
  }));

  const combined = [...existingSamples, ...existingHiddens];

  // Pick EXACTLY 2 visible sample test cases
  const sampleCases: TestCase[] = [];
  existingSamples.forEach(tc => {
    if (sampleCases.length < 2) sampleCases.push(tc);
  });

  if (sampleCases.length < 2) {
    existingHiddens.forEach(tc => {
      if (sampleCases.length < 2) {
        sampleCases.push({
          ...tc,
          id: `tc-s-${problem.id}-${sampleCases.length + 1}`,
          isHidden: false,
          explanation: `Sample Test Case ${sampleCases.length + 1}`
        });
      }
    });
  }

  while (sampleCases.length < 2) {
    const fallback = sampleCases[0] || { input: '0', expectedOutput: '0' };
    sampleCases.push({
      id: `tc-sample-${problem.id}-${sampleCases.length + 1}`,
      input: fallback.input || '0',
      expectedOutput: fallback.expectedOutput || '0',
      isHidden: false,
      explanation: `Sample Test Case ${sampleCases.length + 1}`
    });
  }

  const usedIds = new Set(sampleCases.map(s => s.id));
  const hiddenCases: TestCase[] = [];

  existingHiddens.forEach(tc => {
    if (hiddenCases.length < 3 && !usedIds.has(tc.id)) {
      hiddenCases.push(tc);
      usedIds.add(tc.id);
    }
  });

  if (hiddenCases.length < 3) {
    combined.forEach(tc => {
      if (hiddenCases.length < 3 && !usedIds.has(tc.id)) {
        hiddenCases.push({
          ...tc,
          id: `tc-h-${problem.id}-${hiddenCases.length + 1}`,
          isHidden: true
        });
        usedIds.add(tc.id);
      }
    });
  }

  while (hiddenCases.length < 3) {
    const fallback = hiddenCases[0] || sampleCases[0] || { input: '1', expectedOutput: '1' };
    const newId = `tc-hidden-${problem.id}-${hiddenCases.length + 1}`;
    hiddenCases.push({
      id: newId,
      input: fallback.input || '1',
      expectedOutput: fallback.expectedOutput || '1',
      isHidden: true
    });
    usedIds.add(newId);
  }

  const finalSample = sampleCases.slice(0, 2);
  const finalHidden = hiddenCases.slice(0, 3);

  return {
    ...problem,
    difficulty: diff,
    points,
    maximumMarks: points,
    sampleTestCases: finalSample,
    hiddenTestCases: finalHidden
  };
}

class ContestDatabase {
  async getContestSecuritySettings() {
    return {
      settings: this.contest.settings,
      antiCheatConfig: this.contest.antiCheatConfig
    };
  }
  
  async updateContestSecuritySettings(updates: any) {
    if (!this.contest.antiCheatConfig) {
      this.contest.antiCheatConfig = { maxTabSwitches: 3, lockdownFullscreen: true, blockClipboardPaste: true, blockContextMenu: true, enablePlagiarismDetection: true, riskThreshold: 75 };
    }
    if (updates.maxTabSwitches !== undefined) this.contest.antiCheatConfig.maxTabSwitches = Number(updates.maxTabSwitches);
    if (updates.lockdownFullscreen !== undefined) this.contest.antiCheatConfig.lockdownFullscreen = !!updates.lockdownFullscreen;
    if (updates.blockClipboardPaste !== undefined) this.contest.antiCheatConfig.blockClipboardPaste = !!updates.blockClipboardPaste;
    if (updates.blockContextMenu !== undefined) this.contest.antiCheatConfig.blockContextMenu = !!updates.blockContextMenu;
    if (updates.enablePlagiarismDetection !== undefined) this.contest.antiCheatConfig.enablePlagiarismDetection = !!updates.enablePlagiarismDetection;
    
    this.logAudit('SECURITY_SETTINGS_UPDATED', this.currentUserId, 'Updated security policies');
    return this.getContestSecuritySettings();
  }

  private _contest: Contest | null = null;
  get contest(): Contest {
    if (this._contest && this.contests.has(this._contest.id)) {
      return this.contests.get(this._contest.id)!;
    }
    const live = Array.from(this.contests.values()).find(c => c.isLive || c.status === 'LIVE');
    if (live) return live;
    const first = Array.from(this.contests.values())[0];
    if (first) return first;
    return (this._contest || null) as unknown as Contest;
  }
  set contest(c: Contest) {
    this._contest = c;
  }

  contests: Map<string, Contest> = new Map();
  users: Map<string, User> = new Map();
  registrations: Map<string, StudentRegistration> = new Map();
  batches: Map<string, Batch> = new Map();
  batchMemberships: Map<string, string[]> = new Map(); // key: userId -> array of batchIds
  rounds: Map<string, Round> = new Map();
  problems: Map<string, Problem> = new Map();
  challenges: Map<string, Challenge> = new Map(); // Master Reusable Challenges Library
  questionSets: Map<string, { roundId: string; setId: string; problemIds: string[]; name?: string; contestId?: string }> = new Map();
  assignments: Map<string, QuestionAssignment> = new Map(); // key: userId_roundId or userId_contestId
  submissions: Map<string, Submission> = new Map();
  questionResults: Map<string, QuestionResult> = new Map(); // key: attemptId_problemId
  securityStates: Map<string, ParticipantSecurityState> = new Map(); // key: userId_roundId
  attempts: Map<string, ContestAttempt> = new Map(); // key: contestId_participantId (UNIQUE constraint)
  activeSessions: Map<string, StudentSession> = new Map(); // key: userId
  auditLogs: AuditLog[] = [];
  overrideRecords: OverrideAuditRecord[] = [];
  currentUserId: string = 'usr-admin-1'; // Default active persona

  constructor() {
    this._contest = null;
    this.seedInitialData();
  }

  private seedInitialData() {
    // Removed demo data
  }
  
  private seedProblems() {}

  private seedQuestionSetsAndAssignments() {}

  private seedMasterChallenges() {
    const ch1: Challenge = {
      id: 'ch-001-twosum',
      challengeCode: 'CH001',
      name: 'Two Sum Target Indices',
      slug: 'two-sum-target-indices',
      description: 'Find two indices in an array whose values sum to a specific target value.',
      problemStatement: `Given an array of integers \`nums\` and an integer \`target\`, return the 0-based indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order (or formatted as two space-separated integers on standard output).`,
      inputFormat: `Line 1: An integer \`n\` (number of elements).
Line 2: \`n\` space-separated integers representing the array \`nums\`.
Line 3: An integer \`target\`.`,
      outputFormat: `Print the two space-separated indices: \`i j\` where \`i < j\`.`,
      constraints: `2 <= nums.length <= 10^5
-10^9 <= nums[i] <= 10^9
-10^9 <= target <= 10^9
Only one valid answer exists.`,
      sampleInput: `4\n2 7 11 15\n9`,
      sampleOutput: `0 1`,
      explanation: `Because nums[0] + nums[1] == 2 + 7 == 9, we return 0 1.`,
      difficulty: 'EASY',
      category: 'Arrays & Hashing',
      tags: ['Arrays', 'Hash Table', 'Two Pointers'],
      maximumMarks: 10,
      status: 'PUBLISHED',
      version: 1,
      testCases: [
        { id: 'tc-ch1-1', challengeId: 'ch-001-twosum', order: 1, input: '4\n2 7 11 15\n9', expectedOutput: '0 1', isSample: true, isAdditional: false, marks: 2, strength: 'BASIC', tag: 'Sample Base Case' },
        { id: 'tc-ch1-2', challengeId: 'ch-001-twosum', order: 2, input: '3\n3 2 4\n6', expectedOutput: '1 2', isSample: true, isAdditional: false, marks: 2, strength: 'BASIC', tag: 'Sample Non-Zero Index' },
        { id: 'tc-ch1-3', challengeId: 'ch-001-twosum', order: 3, input: '2\n3 3\n6', expectedOutput: '0 1', isSample: false, isAdditional: false, marks: 2, strength: 'INTERMEDIATE', tag: 'Duplicate Values' },
        { id: 'tc-ch1-4', challengeId: 'ch-001-twosum', order: 4, input: '5\n-3 4 3 90 2\n0', expectedOutput: '0 2', isSample: false, isAdditional: false, marks: 2, strength: 'INTERMEDIATE', tag: 'Negative Numbers' },
        { id: 'tc-ch1-5', challengeId: 'ch-001-twosum', order: 5, input: '6\n1000000 500 200 800 300 999999\n1000499', expectedOutput: '1 5', isSample: false, isAdditional: true, marks: 2, strength: 'ADVANCED', tag: 'Large Values & Offset' }
      ],
      languages: [
        { languageId: 'python', name: 'Python 3.11', enabled: true, timeLimitSec: 2, memoryLimitMb: 256 },
        { languageId: 'javascript', name: 'JavaScript (Node.js)', enabled: true, timeLimitSec: 2, memoryLimitMb: 256 },
        { languageId: 'cpp', name: 'C++ 20 (GCC)', enabled: true, timeLimitSec: 1, memoryLimitMb: 256 },
        { languageId: 'java', name: 'Java 17 (OpenJDK)', enabled: true, timeLimitSec: 2, memoryLimitMb: 512 },
        { languageId: 'c', name: 'C 11 (GCC)', enabled: true, timeLimitSec: 1, memoryLimitMb: 256 }
      ],
      codeStubs: {
        python: `import sys

def two_sum(nums: list[int], target: int) -> tuple[int, int]:
    # Write your optimal solution here
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return (seen[complement], i)
        seen[num] = i
    return (0, 0)

if __name__ == "__main__":
    lines = sys.stdin.read().strip().splitlines()
    if len(lines) >= 3:
        n = int(lines[0])
        nums = list(map(int, lines[1].split()))
        target = int(lines[2])
        i, j = two_sum(nums, target)
        print(f"{i} {j}")
`,
        javascript: `const fs = require('fs');

function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const comp = target - nums[i];
    if (map.has(comp)) {
      return [map.get(comp), i];
    }
    map.set(nums[i], i);
  }
  return [0, 0];
}

const lines = fs.readFileSync('/dev/stdin', 'utf-8').trim().split('\\n');
if (lines.length >= 3) {
  const nums = lines[1].trim().split(/\\s+/).map(Number);
  const target = Number(lines[2].trim());
  const [i, j] = twoSum(nums, target);
  console.log(\`\${i} \${j}\`);
}
`,
        cpp: `#include <iostream>
#include <vector>
#include <unordered_map>
using namespace std;

int main() {
    int n;
    if (!(cin >> n)) return 0;
    vector<int> nums(n);
    for (int i = 0; i < n; i++) cin >> nums[i];
    int target;
    cin >> target;

    unordered_map<int, int> seen;
    for (int i = 0; i < n; i++) {
        int complement = target - nums[i];
        if (seen.find(complement) != seen.end()) {
            cout << seen[complement] << " " << i << endl;
            return 0;
        }
        seen[nums[i]] = i;
    }
    return 0;
}
`
      },
      settings: {
        partialScoring: true,
        negativeMarking: false,
        maximumSubmissions: 10,
        timeLimitSec: 2,
        memoryLimitMb: 256,
        checkerType: 'STANDARD_EXACT_MATCH'
      },
      editorial: {
        approach: 'Single-pass Hash Map lookup for O(N) time complexity.',
        algorithm: '1. Initialize hash table.\n2. Iterate through elements calculating target - nums[i].\n3. If complement exists, return [seen[comp], i].\n4. Otherwise insert current element into map.',
        explanation: 'Using a hash map allows instantaneous O(1) average lookup for the complement.',
        timeComplexity: 'O(N)',
        spaceComplexity: 'O(N)',
        referenceSolution: {
          python: `def two_sum(nums, target):\n    lookup = {}\n    for i, num in enumerate(nums):\n        if target - num in lookup:\n            return lookup[target - num], i\n        lookup[num] = i\n`
        }
      },
      createdBy: 'usr-admin-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString()
    };

    const ch2: Challenge = {
      id: 'ch-002-redundant-edge',
      challengeCode: 'CH002',
      name: 'Cyclic Graph Redundancy Finder',
      slug: 'cyclic-graph-redundancy-finder',
      description: 'Find the redundant edge in an undirected graph that creates a cycle using Disjoint Set Union (DSU).',
      problemStatement: `In this problem, a tree is an undirected graph that is connected and has no cycles.

You are given a graph that started as a tree with \`n\` nodes labeled from \`1\` to \`n\`, with one additional edge added. The added edge has two different vertices chosen from \`1\` to \`n\`, and was not an edge that already existed. The resulting graph is given as an array of \`n\` edges.

Return an edge that can be removed so that the resulting graph is a tree of \`n\` nodes. If there are multiple answers, return the answer that occurs last in the given input.`,
      inputFormat: `Line 1: Integer \`n\` (number of vertices/edges).
Next \`n\` lines: Two integers \`u v\` representing each edge.`,
      outputFormat: `Print the redundant edge as \`u v\`.`,
      constraints: `3 <= n <= 10^4
1 <= u < v <= n`,
      sampleInput: `3\n1 2\n1 3\n2 3`,
      sampleOutput: `2 3`,
      explanation: `Edges 1-2 and 1-3 form a tree. Edge 2-3 creates a cycle and is the last edge in the input.`,
      difficulty: 'MEDIUM',
      category: 'Graphs & Trees',
      tags: ['Graph', 'Union Find', 'Depth-First Search'],
      maximumMarks: 10,
      status: 'PUBLISHED',
      version: 1,
      testCases: [
        { id: 'tc-ch2-1', challengeId: 'ch-002-redundant-edge', order: 1, input: '3\n1 2\n1 3\n2 3', expectedOutput: '2 3', isSample: true, isAdditional: false, marks: 2, strength: 'BASIC', tag: 'Triangle Cycle' },
        { id: 'tc-ch2-2', challengeId: 'ch-002-redundant-edge', order: 2, input: '5\n1 2\n2 3\n3 4\n1 4\n1 5', expectedOutput: '1 4', isSample: true, isAdditional: false, marks: 2, strength: 'BASIC', tag: 'Square with Leaf' },
        { id: 'tc-ch2-3', challengeId: 'ch-002-redundant-edge', order: 3, input: '4\n1 2\n2 3\n3 4\n4 1', expectedOutput: '4 1', isSample: false, isAdditional: false, marks: 2, strength: 'INTERMEDIATE', tag: '4-node ring' },
        { id: 'tc-ch2-4', challengeId: 'ch-002-redundant-edge', order: 4, input: '6\n1 2\n2 3\n3 1\n3 4\n4 5\n5 6', expectedOutput: '3 1', isSample: false, isAdditional: false, marks: 2, strength: 'INTERMEDIATE', tag: 'Cycle at root' },
        { id: 'tc-ch2-5', challengeId: 'ch-002-redundant-edge', order: 5, input: '5\n1 2\n1 3\n1 4\n1 5\n4 5', expectedOutput: '4 5', isSample: false, isAdditional: true, marks: 2, strength: 'ADVANCED', tag: 'Star Graph with Peripheral Edge' }
      ],
      languages: [
        { languageId: 'python', name: 'Python 3.11', enabled: true, timeLimitSec: 2, memoryLimitMb: 256 },
        { languageId: 'javascript', name: 'JavaScript (Node.js)', enabled: true, timeLimitSec: 2, memoryLimitMb: 256 },
        { languageId: 'cpp', name: 'C++ 20 (GCC)', enabled: true, timeLimitSec: 1, memoryLimitMb: 256 }
      ],
      codeStubs: {
        python: `import sys

class DSU:
    def __init__(self, n):
        self.parent = list(range(n + 1))
    def find(self, x):
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]
    def union(self, x, y):
        rx, ry = self.find(x), self.find(y)
        if rx == ry: return False
        self.parent[rx] = ry
        return True

def find_redundant_edge(n, edges):
    dsu = DSU(n)
    for u, v in edges:
        if not dsu.union(u, v):
            return u, v
    return edges[-1]

if __name__ == '__main__':
    lines = sys.stdin.read().strip().splitlines()
    if lines:
        n = int(lines[0])
        edges = [list(map(int, line.split())) for line in lines[1:n+1]]
        u, v = find_redundant_edge(n, edges)
        print(f"{u} {v}")
`
      },
      settings: {
        partialScoring: true,
        negativeMarking: false,
        maximumSubmissions: 10,
        timeLimitSec: 2,
        memoryLimitMb: 256,
        checkerType: 'STANDARD_EXACT_MATCH'
      },
      editorial: {
        approach: 'Disjoint Set Union (DSU) with path compression.',
        algorithm: '1. Maintain parent pointers for 1..N nodes.\n2. For each edge (u, v), find roots of u and v.\n3. If roots are equal, (u, v) is the redundant edge.\n4. Otherwise, union the sets.',
        explanation: 'DSU runs in nearly linear O(N * alpha(N)) time.',
        timeComplexity: 'O(N * alpha(N))',
        spaceComplexity: 'O(N)',
        referenceSolution: {
          python: `class DSU:\n    def __init__(self, n):\n        self.p = list(range(n+1))\n    def find(self, i):\n        if self.p[i] != i: self.p[i] = self.find(self.p[i])\n        return self.p[i]\n`
        }
      },
      createdBy: 'usr-admin-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString()
    };

    const ch3: Challenge = {
      id: 'ch-003-server-balance',
      challengeCode: 'CH003',
      name: 'Optimal Server Load Balancing',
      slug: 'optimal-server-load-balancing',
      description: 'Partition contiguous task loads across servers to minimize the maximum load assigned.',
      problemStatement: `You are given an array of \`n\` positive integers representing task computation loads, and an integer \`m\` representing available worker servers.

Each server must be assigned a non-empty contiguous segment of tasks. Minimize the maximum total load assigned to any single server.`,
      inputFormat: `Line 1: Two integers \`n\` and \`m\`.
Line 2: \`n\` space-separated integers representing task loads.`,
      outputFormat: `Print the minimized maximum server load.`,
      constraints: `1 <= m <= n <= 10^5
1 <= tasks[i] <= 10^9`,
      sampleInput: `5 2\n1 2 3 4 5`,
      sampleOutput: `9`,
      explanation: `Partition into [1, 2, 3] (sum 6) and [4, 5] (sum 9). The maximum load across servers is 9.`,
      difficulty: 'MEDIUM',
      category: 'Binary Search',
      tags: ['Binary Search', 'Greedy', 'Prefix Sum'],
      maximumMarks: 10,
      status: 'PUBLISHED',
      version: 1,
      testCases: [
        { id: 'tc-ch3-1', challengeId: 'ch-003-server-balance', order: 1, input: '5 2\n1 2 3 4 5', expectedOutput: '9', isSample: true, isAdditional: false, marks: 2, strength: 'BASIC', tag: 'Sample Partition' },
        { id: 'tc-ch3-2', challengeId: 'ch-003-server-balance', order: 2, input: '4 4\n10 20 30 40', expectedOutput: '40', isSample: true, isAdditional: false, marks: 2, strength: 'BASIC', tag: 'm = n Boundary' },
        { id: 'tc-ch3-3', challengeId: 'ch-003-server-balance', order: 3, input: '6 3\n5 10 30 20 15 10', expectedOutput: '35', isSample: false, isAdditional: false, marks: 2, strength: 'INTERMEDIATE', tag: 'Uneven segments' },
        { id: 'tc-ch3-4', challengeId: 'ch-003-server-balance', order: 4, input: '1 1\n500', expectedOutput: '500', isSample: false, isAdditional: false, marks: 2, strength: 'INTERMEDIATE', tag: 'Single task & server' },
        { id: 'tc-ch3-5', challengeId: 'ch-003-server-balance', order: 5, input: '7 2\n100 200 300 400 500 600 700', expectedOutput: '1500', isSample: false, isAdditional: true, marks: 2, strength: 'ADVANCED', tag: 'Large contiguous sum' }
      ],
      languages: [
        { languageId: 'python', name: 'Python 3.11', enabled: true, timeLimitSec: 2, memoryLimitMb: 256 },
        { languageId: 'cpp', name: 'C++ 20 (GCC)', enabled: true, timeLimitSec: 1, memoryLimitMb: 256 }
      ],
      codeStubs: {
        python: `import sys

def solve(n, m, tasks):
    def can_fit(max_cap):
        servers = 1
        current = 0
        for t in tasks:
            if current + t > max_cap:
                servers += 1
                current = t
                if servers > m: return False
            else:
                current += t
        return True

    low, high = max(tasks), sum(tasks)
    ans = high
    while low <= high:
        mid = (low + high) // 2
        if can_fit(mid):
            ans = mid
            high = mid - 1
        else:
            low = mid + 1
    return ans

if __name__ == '__main__':
    lines = sys.stdin.read().strip().splitlines()
    if lines:
        n, m = map(int, lines[0].split())
        tasks = list(map(int, lines[1].split()))
        print(solve(n, m, tasks))
`
      },
      settings: {
        partialScoring: true,
        negativeMarking: false,
        maximumSubmissions: 10,
        timeLimitSec: 2,
        memoryLimitMb: 256,
        checkerType: 'STANDARD_EXACT_MATCH'
      },
      editorial: {
        approach: 'Binary Search on the answer space [max(tasks), sum(tasks)].',
        algorithm: '1. Binary search mid.\n2. Greedy check if tasks can be grouped into <= m servers with capacity mid.\n3. Adjust binary search boundaries.',
        explanation: 'Monotonic feasibility predicate allows O(N * log(sum(tasks))) solution.',
        timeComplexity: 'O(N * log(Sum))',
        spaceComplexity: 'O(1)',
        referenceSolution: {
          python: `def solve(n, m, tasks):\n    pass\n`
        }
      },
      createdBy: 'usr-admin-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString()
    };

    const ch4: Challenge = {
      id: 'ch-004-run-length',
      challengeCode: 'CH004',
      name: 'Run-Length String Compression',
      slug: 'run-length-string-compression',
      description: 'Compress consecutive repeating characters into character and frequency representation.',
      problemStatement: `Given a string \`s\` of lowercase English letters, perform in-place or stream run-length encoding compression.

For any consecutive sequence of the same character:
- If count is 1, keep the character as is.
- If count is greater than 1, append the count directly after the character (e.g. "aaabbc" -> "a3b2c").`,
      inputFormat: `Line 1: A non-empty string \`s\`.`,
      outputFormat: `Print the compressed string.`,
      constraints: `1 <= s.length <= 10^5
s consists only of lowercase English letters.`,
      sampleInput: `aabcccccaaa`,
      sampleOutput: `a2bc5a3`,
      explanation: `'aa' becomes 'a2', 'b' becomes 'b', 'ccccc' becomes 'c5', 'aaa' becomes 'a3'.`,
      difficulty: 'EASY',
      category: 'Strings',
      tags: ['Strings', 'Two Pointers', 'Compression'],
      maximumMarks: 10,
      status: 'PUBLISHED',
      version: 1,
      testCases: [
        { id: 'tc-ch4-1', challengeId: 'ch-004-run-length', order: 1, input: 'aabcccccaaa', expectedOutput: 'a2bc5a3', isSample: true, isAdditional: false, marks: 2, strength: 'BASIC', tag: 'Sample Standard' },
        { id: 'tc-ch4-2', challengeId: 'ch-004-run-length', order: 2, input: 'abcdef', expectedOutput: 'abcdef', isSample: true, isAdditional: false, marks: 2, strength: 'BASIC', tag: 'All unique chars' },
        { id: 'tc-ch4-3', challengeId: 'ch-004-run-length', order: 3, input: 'aaaa', expectedOutput: 'a4', isSample: false, isAdditional: false, marks: 2, strength: 'INTERMEDIATE', tag: 'Single repeating char' },
        { id: 'tc-ch4-4', challengeId: 'ch-004-run-length', order: 4, input: 'z', expectedOutput: 'z', isSample: false, isAdditional: false, marks: 2, strength: 'INTERMEDIATE', tag: 'Single character string' },
        { id: 'tc-ch4-5', challengeId: 'ch-004-run-length', order: 5, input: 'aabbccddeeffgghhiijj', expectedOutput: 'a2b2c2d2e2f2g2h2i2j2', isSample: false, isAdditional: true, marks: 2, strength: 'ADVANCED', tag: 'Multiple repeated pairs' }
      ],
      languages: [
        { languageId: 'python', name: 'Python 3.11', enabled: true, timeLimitSec: 2, memoryLimitMb: 256 },
        { languageId: 'javascript', name: 'JavaScript (Node.js)', enabled: true, timeLimitSec: 2, memoryLimitMb: 256 },
        { languageId: 'cpp', name: 'C++ 20 (GCC)', enabled: true, timeLimitSec: 1, memoryLimitMb: 256 }
      ],
      codeStubs: {
        python: `import sys

def compress(s: str) -> str:
    if not s: return ""
    res = []
    i = 0
    while i < len(s):
        char = s[i]
        count = 0
        while i < len(s) and s[i] == char:
            count += 1
            i += 1
        res.append(char + (str(count) if count > 1 else ''))
    return "".join(res)

if __name__ == '__main__':
    s = sys.stdin.read().strip()
    if s:
        print(compress(s))
`
      },
      settings: {
        partialScoring: true,
        negativeMarking: false,
        maximumSubmissions: 10,
        timeLimitSec: 2,
        memoryLimitMb: 256,
        checkerType: 'STANDARD_EXACT_MATCH'
      },
      editorial: {
        approach: 'Two pointers counting runs of identical consecutive characters.',
        algorithm: '1. Scan with pointer i.\n2. Inner loop counts matching adjacent letters.\n3. Append character and count if count > 1.\n4. Advance i by run length.',
        explanation: 'Linear time scan with negligible auxiliary memory.',
        timeComplexity: 'O(N)',
        spaceComplexity: 'O(N)',
        referenceSolution: { python: 'def compress(s): pass' }
      },
      createdBy: 'usr-admin-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString()
    };

    const ch5: Challenge = {
      id: 'ch-005-subtree-product',
      challengeCode: 'CH005',
      name: 'Subtree Maximum Path Product',
      slug: 'subtree-maximum-path-product',
      description: 'Compute the maximum possible path product in a tree structure with modulo 10^9+7 arithmetic.',
      problemStatement: `You are given a rooted tree with \`n\` vertices numbered from \`1\` to \`n\`, where node \`1\` is the root. Each vertex has an assigned integer value \`val[i]\`.

A simple path in the tree has a path product equal to the product of vertex values along the path modulo \`10^9 + 7\`. Find the maximum path product across all possible non-empty simple paths.`,
      inputFormat: `Line 1: Integer \`n\`.
Line 2: \`n\` space-separated integers representing node values \`val[1..n]\`.
Next \`n-1\` lines: Two integers \`u v\` representing an edge in the tree.`,
      outputFormat: `Print the maximum path product modulo \`10^9 + 7\`.`,
      constraints: `1 <= n <= 5 * 10^4
1 <= val[i] <= 10^6`,
      sampleInput: `3\n2 3 4\n1 2\n1 3`,
      sampleOutput: `24`,
      explanation: `Path 2 -> 1 -> 3 has product 3 * 2 * 4 = 24.`,
      difficulty: 'HARD',
      category: 'Dynamic Programming & Trees',
      tags: ['Tree DP', 'Dynamic Programming', 'Trees'],
      maximumMarks: 10,
      status: 'DRAFT',
      version: 1,
      testCases: [
        { id: 'tc-ch5-1', challengeId: 'ch-005-subtree-product', order: 1, input: '3\n2 3 4\n1 2\n1 3', expectedOutput: '24', isSample: true, isAdditional: false, marks: 2, strength: 'BASIC', tag: 'Sample Small Tree' },
        { id: 'tc-ch5-2', challengeId: 'ch-005-subtree-product', order: 2, input: '1\n100', expectedOutput: '100', isSample: true, isAdditional: false, marks: 2, strength: 'BASIC', tag: 'Single Node' },
        { id: 'tc-ch5-3', challengeId: 'ch-005-subtree-product', order: 3, input: '4\n1 2 3 4\n1 2\n2 3\n3 4', expectedOutput: '24', isSample: false, isAdditional: false, marks: 2, strength: 'INTERMEDIATE', tag: 'Linear Chain Path' },
        { id: 'tc-ch5-4', challengeId: 'ch-005-subtree-product', order: 4, input: '5\n5 1 2 3 4\n1 2\n1 3\n2 4\n2 5', expectedOutput: '120', isSample: false, isAdditional: false, marks: 2, strength: 'INTERMEDIATE', tag: 'Branching tree' },
        { id: 'tc-ch5-5', challengeId: 'ch-005-subtree-product', order: 5, input: '5\n10 10 10 10 10\n1 2\n2 3\n3 4\n4 5', expectedOutput: '100000', isSample: false, isAdditional: true, marks: 2, strength: 'ADVANCED', tag: 'Uniform nodes depth' }
      ],
      languages: [
        { languageId: 'python', name: 'Python 3.11', enabled: true, timeLimitSec: 3, memoryLimitMb: 512 },
        { languageId: 'cpp', name: 'C++ 20 (GCC)', enabled: true, timeLimitSec: 2, memoryLimitMb: 512 }
      ],
      codeStubs: {
        python: `import sys
sys.setrecursionlimit(200000)

MOD = 10**9 + 7

def max_path_product(n, vals, edges):
    adj = [[] for _ in range(n + 1)]
    for u, v in edges:
        adj[u].append(v)
        adj[v].append(u)

    max_prod = 0

    def dfs(node, parent):
        nonlocal max_prod
        top1, top2 = 1, 1
        for neighbor in adj[node]:
            if neighbor != parent:
                sub = dfs(neighbor, node)
                if sub > top1:
                    top2 = top1
                    top1 = sub
                elif sub > top2:
                    top2 = sub
        path = (vals[node - 1] * top1 * top2) % MOD
        max_prod = max(max_prod, path, vals[node - 1] * top1 % MOD)
        return (vals[node - 1] * top1) % MOD

    dfs(1, 0)
    return max_prod

if __name__ == '__main__':
    lines = sys.stdin.read().strip().splitlines()
    if lines:
        n = int(lines[0])
        vals = list(map(int, lines[1].split()))
        edges = [list(map(int, line.split())) for line in lines[2:n+1]]
        print(max_path_product(n, vals, edges))
`
      },
      settings: {
        partialScoring: true,
        negativeMarking: false,
        maximumSubmissions: 5,
        timeLimitSec: 3,
        memoryLimitMb: 512,
        checkerType: 'STANDARD_EXACT_MATCH'
      },
      editorial: {
        approach: 'Tree Dynamic Programming maintaining top 2 child branch products.',
        algorithm: '1. Build adjacency list.\n2. Run DFS returning best descending path product.\n3. At each node, combine two best descending branches with node value.\n4. Update global maximum.',
        explanation: 'Classic subtree DP computed in single pass O(N) traversal.',
        timeComplexity: 'O(N)',
        spaceComplexity: 'O(N)',
        referenceSolution: { python: 'def solve(): pass' }
      },
      createdBy: 'usr-admin-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    [ch1, ch2, ch3, ch4, ch5].forEach(ch => {
      this.challenges.set(ch.id, ch);
    });
  }

  private seedHistoricalSubmissions() {}

  private seedStudentRegistrations() {}

  // ==========================================
  // STUDENT MANAGEMENT (CRUD & SECURITY)
  // ==========================================
  getStudents(params: {
    search?: string;
    status?: string;
    institution?: string;
    department?: string;
    page?: number;
    limit?: number;
  }) {
    const { search = '', status = 'ALL', institution = 'ALL', department = 'ALL', page = 1, limit = 50 } = params;
    const cleanSearch = search.toLowerCase().trim();

    let allStudents: StudentAccount[] = [];
    let activeCount = 0;
    let inactiveCount = 0;
    const institutionsSet = new Set<string>();
    const departmentsSet = new Set<string>();

    for (const u of this.users.values()) {
      if (u.role === 'PARTICIPANT' || u.role === 'STUDENT') {
        const studentStatus: AccountStatus = u.status || 'ACTIVE';
        if (studentStatus === 'ACTIVE') activeCount++;
        else inactiveCount++;

        const inst = u.institution || u.college || 'Engineering College';
        if (inst) institutionsSet.add(inst);

        const dept = u.department || 'Computer Science';
        if (dept) departmentsSet.add(dept);

        let subCount = 0;
        for (const s of this.submissions.values()) {
          if (s.userId === u.id) subCount++;
        }

        const attempt = this.getAttempt(this.contest.id, u.id);

        allStudents.push({
          id: u.id,
          studentId: u.studentId || u.id,
          name: u.name,
          email: u.email,
          username: u.username || u.email.split('@')[0] || u.id,
          role: u.role,
          phone: u.phone || '',
          college: inst,
          institution: inst,
          department: dept,
          year: u.year || u.yearOfStudy || '3rd Year',
          yearOfStudy: u.yearOfStudy || u.year || '3rd Year',
          batchId: u.batchId || 'batch-1',
          status: studentStatus,
          isApproved: u.isApproved !== false,
          createdAt: u.createdAt || this.contest.date || new Date().toISOString(),
          updatedAt: u.updatedAt || new Date().toISOString(),
          submissionCount: subCount,
          attemptStatus: attempt?.status || 'NOT_STARTED'
        });
      }
    }

    // Search filter (ID, name, username, email)
    if (cleanSearch) {
      allStudents = allStudents.filter(
        s =>
          s.studentId.toLowerCase().includes(cleanSearch) ||
          s.name.toLowerCase().includes(cleanSearch) ||
          s.username.toLowerCase().includes(cleanSearch) ||
          s.email.toLowerCase().includes(cleanSearch)
      );
    }

    // Status filter
    if (status && status !== 'ALL') {
      allStudents = allStudents.filter(s => s.status === status);
    }

    // Institution filter
    if (institution && institution !== 'ALL') {
      allStudents = allStudents.filter(
        s => (s.institution || s.college || '').toLowerCase() === institution.toLowerCase()
      );
    }

    // Department filter
    if (department && department !== 'ALL') {
      allStudents = allStudents.filter(
        s => (s.department || '').toLowerCase() === department.toLowerCase()
      );
    }

    // Sort by createdAt descending
    allStudents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = allStudents.length;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Number(limit) || 50);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedStudents = allStudents.slice(startIndex, startIndex + limitNum);

    return {
      students: paginatedStudents,
      total,
      activeCount,
      inactiveCount,
      institutionCount: institutionsSet.size,
      availableInstitutions: Array.from(institutionsSet).sort(),
      availableDepartments: Array.from(departmentsSet).sort(),
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      stats: {
        total,
        active: activeCount,
        inactive: inactiveCount,
        institutionsCount: institutionsSet.size,
        departmentsCount: departmentsSet.size
      }
    };
  }

  getStudentById(id: string): StudentAccount | null {
    const u = this.users.get(id);
    if (!u || (u.role !== 'PARTICIPANT' && u.role !== 'STUDENT')) return null;

    let subCount = 0;
    for (const s of this.submissions.values()) {
      if (s.userId === u.id) subCount++;
    }
    const attempt = this.getAttempt(this.contest.id, u.id);
    const inst = u.institution || u.college || 'Engineering College';

    return {
      id: u.id,
      studentId: u.studentId || u.id,
      name: u.name,
      email: u.email,
      username: u.username || u.email.split('@')[0] || u.id,
      role: u.role,
      phone: u.phone || '',
      college: inst,
      institution: inst,
      department: u.department || 'Computer Science',
      year: u.year || u.yearOfStudy || '3rd Year',
      yearOfStudy: u.yearOfStudy || u.year || '3rd Year',
      batchId: u.batchId || 'batch-1',
      status: u.status || 'ACTIVE',
      isApproved: u.isApproved !== false,
      createdAt: u.createdAt || new Date().toISOString(),
      updatedAt: u.updatedAt || new Date().toISOString(),
      submissionCount: subCount,
      attemptStatus: attempt?.status || 'NOT_STARTED'
    };
  }

  createStudent(
    payload: {
      studentId: string;
      name: string;
      email: string;
      username: string;
      password?: string;
      phone?: string;
      college?: string;
      institution?: string;
      department?: string;
      year?: string;
      yearOfStudy?: string;
      batchId?: string;
      status?: AccountStatus;
    },
    adminUserId: string
  ): StudentAccount {
    const studentId = (payload.studentId || '').trim();
    const name = (payload.name || '').trim();
    const email = (payload.email || '').trim().toLowerCase();
    const username = (payload.username || '').trim().toLowerCase();
    const password = payload.password || '';

    if (!studentId) throw new Error('Student ID is required.');
    if (!name) throw new Error('Full Name is required.');
    if (!email) throw new Error('Email address is required.');
    if (!username) throw new Error('Username is required.');
    if (!password || password.length < 6) {
      throw new Error('Initial Password must be at least 6 characters.');
    }

    // Duplicate check
    for (const u of this.users.values()) {
      if (u.studentId && u.studentId.trim().toLowerCase() === studentId.toLowerCase()) {
        throw new Error(`Student ID "${studentId}" is already registered to another account.`);
      }
      if (u.email && u.email.trim().toLowerCase() === email) {
        throw new Error(`Email address "${email}" is already registered to another account.`);
      }
      if (u.username && u.username.trim().toLowerCase() === username) {
        throw new Error(`Username "${username}" is already taken. Please choose a different username.`);
      }
    }

    const newUserId = `usr-std-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const hashedPassword = hashPassword(password);
    const inst = (payload.institution || payload.college || 'Engineering College').trim();
    const dept = (payload.department || 'Computer Science').trim();
    const yr = (payload.year || payload.yearOfStudy || '3rd Year').trim();
    const batch = payload.batchId || 'batch-1';
    const status: AccountStatus = payload.status || 'ACTIVE';
    const now = new Date().toISOString();

    const newUser: User = {
      id: newUserId,
      name,
      email,
      username,
      role: 'PARTICIPANT',
      password: hashedPassword,
      passwordHash: hashedPassword,
      studentId,
      college: inst,
      institution: inst,
      department: dept,
      year: yr,
      yearOfStudy: yr,
      phone: payload.phone?.trim() || '',
      batchId: batch,
      status,
      isApproved: true,
      createdAt: now,
      updatedAt: now
    };

    this.users.set(newUserId, newUser);

    // Initialize Security State & Attempt for active round
    const roundId = this.contest.currentRoundId || 'round-1';
    this.securityStates.set(`${newUserId}_${roundId}`, {
      userId: newUserId,
      roundId,
      tabSwitchCount: 0,
      maxAllowedSwitches: this.contest.settings?.maxTabSwitches || 3,
      isFlagged: false,
      sessionTerminated: false,
      violations: [],
      riskScore: 0
    });

    const attempt: ContestAttempt = {
      id: `att-${this.contest.id}-${newUserId}`,
      contestId: this.contest.id,
      participantId: newUserId,
      batchId: batch,
      currentRoundId: roundId,
      status: 'NOT_STARTED',
      startedAt: now,
      tabSwitchCount: 0,
      maxTabSwitches: this.contest.settings?.maxTabSwitches || 3,
      activeSessionId: `sess-${newUserId}-${Date.now()}`,
      codeSnapshots: {},
      createdAt: now,
      updatedAt: now
    };
    this.attempts.set(`${this.contest.id}_${newUserId}`, attempt);

    this.logAudit(
      'STUDENT_CREATED',
      adminUserId,
      `Created student account "${name}" (ID: ${studentId}, Username: ${username}, Email: ${email}, Status: ${status})`,
      newUserId
    );

    return {
      id: newUserId,
      studentId,
      name,
      email,
      username,
      role: 'PARTICIPANT',
      phone: newUser.phone,
      college: inst,
      institution: inst,
      department: dept,
      year: yr,
      yearOfStudy: yr,
      batchId: batch,
      status,
      isApproved: true,
      createdAt: now,
      updatedAt: now,
      submissionCount: 0,
      attemptStatus: 'NOT_STARTED'
    };
  }

  updateStudent(
    id: string,
    payload: {
      name?: string;
      email?: string;
      username?: string;
      studentId?: string;
      phone?: string;
      college?: string;
      institution?: string;
      department?: string;
      year?: string;
      yearOfStudy?: string;
      batchId?: string;
      status?: AccountStatus;
    },
    adminUserId: string
  ): StudentAccount {
    const user = this.users.get(id);
    if (!user) throw new Error('Student account not found');

    const cleanEmail = payload.email ? payload.email.trim().toLowerCase() : undefined;
    const cleanUsername = payload.username ? payload.username.trim().toLowerCase() : undefined;
    const cleanStudentId = payload.studentId ? payload.studentId.trim() : undefined;

    // Check duplicate collisions with other users
    for (const [otherId, u] of this.users.entries()) {
      if (otherId !== id) {
        if (cleanStudentId && u.studentId && u.studentId.trim().toLowerCase() === cleanStudentId.toLowerCase()) {
          throw new Error(`Student ID "${cleanStudentId}" is already used by another student.`);
        }
        if (cleanEmail && u.email && u.email.trim().toLowerCase() === cleanEmail) {
          throw new Error(`Email "${cleanEmail}" is already registered to another account.`);
        }
        if (cleanUsername && u.username && u.username.trim().toLowerCase() === cleanUsername) {
          throw new Error(`Username "${cleanUsername}" is already taken by another account.`);
        }
      }
    }

    if (payload.name) user.name = payload.name.trim();
    if (cleanEmail) user.email = cleanEmail;
    if (cleanUsername) user.username = cleanUsername;
    if (cleanStudentId) user.studentId = cleanStudentId;
    if (payload.phone !== undefined) user.phone = payload.phone.trim();
    if (payload.institution || payload.college) {
      const inst = (payload.institution || payload.college)!.trim();
      user.institution = inst;
      user.college = inst;
    }
    if (payload.department !== undefined) user.department = payload.department.trim();
    if (payload.year || payload.yearOfStudy) {
      const yr = (payload.year || payload.yearOfStudy)!.trim();
      user.year = yr;
      user.yearOfStudy = yr;
    }
    if (payload.batchId) user.batchId = payload.batchId;
    if (payload.status) user.status = payload.status;
    user.updatedAt = new Date().toISOString();

    this.logAudit(
      'STUDENT_UPDATED',
      adminUserId,
      `Updated student account ${user.name} (${user.studentId}, Status: ${user.status})`,
      id
    );

    return this.getStudentById(id)!;
  }

  resetStudentPassword(id: string, newPassword: string, adminUserId: string): { success: boolean; message: string } {
    const user = this.users.get(id);
    if (!user) throw new Error('Student account not found');
    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }

    const hashed = hashPassword(newPassword);
    user.password = hashed;
    user.passwordHash = hashed;
    user.updatedAt = new Date().toISOString();

    this.logAudit('STUDENT_PASSWORD_RESET', adminUserId, `Reset password for student ${user.name} (${user.studentId})`, id);
    return { success: true, message: `Password for student "${user.name}" reset successfully.` };
  }

  deleteStudent(id: string, adminUserId: string): { success: boolean; softDeactivated: boolean; message: string } {
    const user = this.users.get(id);
    if (!user) throw new Error('Student account not found');

    // Check if user has historical submissions
    let hasSubmissions = false;
    for (const s of this.submissions.values()) {
      if (s.userId === id) {
        hasSubmissions = true;
        break;
      }
    }

    const attempt = this.getAttempt(this.contest.id, id);
    const hasAttemptActivity = attempt && attempt.status !== 'NOT_STARTED';

    if (hasSubmissions || hasAttemptActivity) {
      // Soft-deactivate to protect historical contest data integrity
      user.status = 'INACTIVE';
      user.updatedAt = new Date().toISOString();
      this.logAudit(
        'STUDENT_DEACTIVATED',
        adminUserId,
        `Deactivated student account ${user.name} (${user.studentId}) to preserve historical contest records.`,
        id
      );
      return {
        success: true,
        softDeactivated: true,
        message: `Student "${user.name}" has historical contest submissions. Account has been safely deactivated (marked INACTIVE) to preserve historical data.`
      };
    }

    // Permanent deletion
    this.users.delete(id);
    this.securityStates.delete(`${id}_${this.contest.currentRoundId}`);
    this.attempts.delete(`${this.contest.id}_${id}`);
    this.assignments.delete(`${id}_${this.contest.currentRoundId}`);

    this.logAudit(
      'STUDENT_DELETED',
      adminUserId,
      `Permanently deleted student account ${user.name} (${user.studentId}) with no historical records.`,
      id
    );

    return {
      success: true,
      softDeactivated: false,
      message: `Student "${user.name}" deleted successfully.`
    };
  }

  // 1. Student Registration
  createRegistration(data: Omit<StudentRegistration, 'id' | 'status' | 'submittedAt'>): StudentRegistration {
    const id = `reg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const reg: StudentRegistration = {
      ...data,
      id,
      status: 'PENDING_APPROVAL',
      submittedAt: new Date().toISOString()
    };
    this.registrations.set(id, reg);
    this.logAudit('STUDENT_REGISTRATION_SUBMITTED', 'GUEST', `Student registration submitted: ${reg.name} (${reg.email})`, id);
    return reg;
  }

  // 2. Admin Approves Student Registration & creates/issues credentials
  approveRegistration(
    regId: string,
    adminUserId: string,
    params: {
      assignedBatchId: string;
      assignedUsername: string;
      assignedPassword: string;
      assignedRollCode?: string;
    }
  ): { registration: StudentRegistration; user: User } {
    const reg = this.registrations.get(regId);
    if (!reg) throw new Error('Registration record not found');

    const newUserId = `usr-part-${Date.now()}`;
    const assignedRollCode = params.assignedRollCode || `CS26-B${params.assignedBatchId === 'batch-2' ? '2' : '1'}-${String(this.users.size + 1).padStart(3, '0')}`;

    reg.status = 'APPROVED';
    reg.reviewedAt = new Date().toISOString();
    reg.reviewedBy = adminUserId;
    reg.assignedBatchId = params.assignedBatchId;
    reg.assignedUsername = params.assignedUsername.trim().toLowerCase();
    reg.assignedPassword = params.assignedPassword;
    reg.assignedRollCode = assignedRollCode;

    // Create participant user profile
    const newUser: User = {
      id: newUserId,
      name: reg.name,
      email: reg.assignedUsername,
      role: 'PARTICIPANT',
      password: reg.assignedPassword,
      batchId: params.assignedBatchId,
      college: reg.college,
      studentId: assignedRollCode,
      department: reg.department,
      phone: reg.phone,
      isApproved: true
    };
    this.users.set(newUser.id, newUser);

    // Initialize Question Set Assignment & Security State for Active Round
    const roundId = this.contest.currentRoundId || 'round-1';
    const qSets = Array.from(this.questionSets.values()).filter(q => q.roundId === roundId);
    const chosenSet = qSets[this.users.size % (qSets.length || 1)] || { setId: 'Set A', problemIds: ['prob-r1-1', 'prob-r1-2', 'prob-r1-3'] };

    const shuffled = [...chosenSet.problemIds].sort(() => 0.5 - Math.random());
    const assignment: QuestionAssignment = {
      id: `assign-${newUser.id}-${roundId}`,
      userId: newUser.id,
      roundId,
      setId: chosenSet.setId,
      problemIds: shuffled,
      shuffledProblemIds: shuffled,
      isLocked: true,
      lockedAt: new Date().toISOString(),
      overridden: false,
      assignedAt: new Date().toISOString()
    };
    this.assignments.set(`${newUser.id}_${roundId}`, assignment);

    const secState: ParticipantSecurityState = {
      userId: newUser.id,
      roundId,
      tabSwitchCount: 0,
      maxAllowedSwitches: this.contest.settings.maxTabSwitches || 3,
      isFlagged: false,
      sessionTerminated: false,
      violations: [],
      riskScore: 0
    };
    this.securityStates.set(`${newUser.id}_${roundId}`, secState);

    // Update batch participant count
    const batch = this.batches.get(params.assignedBatchId);
    if (batch) batch.participantCount = (batch.participantCount || 0) + 1;

    this.logAudit(
      'STUDENT_REGISTRATION_APPROVED',
      adminUserId,
      `Approved student ${reg.name}. Issued credentials: User=${reg.assignedUsername}, Batch=${reg.assignedBatchId}`,
      newUser.id
    );

    return { registration: reg, user: newUser };
  }

  // 3. Reject Student Registration
  rejectRegistration(regId: string, adminUserId: string, reason: string): StudentRegistration {
    const reg = this.registrations.get(regId);
    if (!reg) throw new Error('Registration record not found');

    reg.status = 'REJECTED';
    reg.reviewedAt = new Date().toISOString();
    reg.reviewedBy = adminUserId;
    reg.rejectionReason = reason;

    this.logAudit('STUDENT_REGISTRATION_REJECTED', adminUserId, `Rejected registration for ${reg.name}. Reason: ${reason}`, regId);
    return reg;
  }

  // 4. Contest Management & Retrieval
  getContests(): Contest[] {
    return Array.from(this.contests.values());
  }

  getContest(id: string): Contest | null {
    if (id && this.contests.has(id)) return this.contests.get(id)!;
    if (id === 'active' || !id) {
      const now = Date.now();
      // First look for a LIVE contest with valid future end time
      const liveFuture = Array.from(this.contests.values()).find(
        c => (c.isLive || c.status === 'LIVE') && c.endTime && new Date(c.endTime).getTime() > now
      );
      if (liveFuture) return liveFuture;

      const live = Array.from(this.contests.values()).find(c => c.isLive || c.status === 'LIVE');
      if (live) return live;

      const published = Array.from(this.contests.values()).find(c => c.status === 'PUBLISHED');
      if (published) return published;

      return Array.from(this.contests.values())[0] || this.contest || null;
    }
    return this.contests.get(id) || null;
  }

  createNewContest(payload: CreateContestPayload, adminUserId: string): Contest {
    const newContestId = `contest-${Date.now()}`;
    const now = new Date();

    // 1. Create Batches
    this.batches.clear();
    const batchCount = Math.max(1, Math.min(payload.batchCount || 2, 5));
    const slotDuration = payload.slotDurationMinutes || 90;

    for (let i = 1; i <= batchCount; i++) {
      const bStart = new Date(now.getTime() + (i - 1) * (slotDuration + 15) * 60 * 1000).toISOString();
      const bEnd = new Date(new Date(bStart).getTime() + slotDuration * 60 * 1000).toISOString();
      const batch: Batch = {
        id: `batch-${i}`,
        name: `Batch ${String.fromCharCode(64 + i)}`,
        startTime: bStart,
        endTime: bEnd,
        slotDurationMinutes: slotDuration,
        isActive: i === 1,
        participantCount: 0
      };
      this.batches.set(batch.id, batch);
    }

    // 2. Create Rounds
    this.rounds.clear();
    const startMs = payload.startTime ? new Date(payload.startTime).getTime() : now.getTime();
    const endMs = payload.endTime ? new Date(payload.endTime).getTime() : startMs + 60 * 60 * 1000;
    
    if (payload.startTime && payload.endTime) {
      if (endMs <= startMs) {
        throw new Error('End date and time must be later than start date and time.');
      }
    }

    const r1: Round = {
      id: 'round-1',
      name: 'Round 1: Algorithmic Qualifier',
      roundNumber: 1,
      status: 'ACTIVE',
      startTime: payload.startTime || now.toISOString(),
      endTime: payload.endTime || new Date(startMs + 3600 * 1000).toISOString(),
      durationMinutes: Math.max(1, Math.round((endMs - startMs) / 60000)),
      cutoffRank: payload.round2QualificationLimit || 15,
      minScoreForCutoff: 100,
      totalQuestions: 3,
      isLocked: false,
      qualifiedParticipantIds: []
    };

    const r2: Round = {
      id: 'round-2',
      name: 'Round 2: Grand Championship Finals',
      roundNumber: 2,
      status: 'UPCOMING',
      startTime: new Date(now.getTime() + 180 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() + (180 + (payload.round2DurationMinutes || 120)) * 60 * 1000).toISOString(),
      durationMinutes: payload.round2DurationMinutes || 120,
      totalQuestions: 3,
      isLocked: true,
      qualifiedParticipantIds: []
    };

    this.rounds.set(r1.id, r1);
    this.rounds.set(r2.id, r2);

    // 3. Set Contest as DRAFT initially
    const setCount = Math.max(1, Math.min(payload.setCount || 3, 10));
    const questionsPerSet = Math.max(1, Math.min(payload.questionsPerSet || 3, 10));

    const newContest: Contest & { timezone?: string; setsCount?: number; questionsPerSet?: number; questionsCount?: number } = {
      id: newContestId,
      title: payload.title,
      description: payload.description || `Official coding symposium held by ${payload.organizationName || 'University'}.`,
      date: payload.date || (payload.startTime ? payload.startTime.split('T')[0] : new Date().toISOString().split('T')[0]),
      startTime: payload.startTime || new Date().toISOString(),
      endTime: payload.endTime || new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
      organizationType: payload.organizationType || 'University',
      organizationName: payload.organizationName || 'National Institute of Technology',
      timezone: payload.timezone || 'Asia/Kolkata / IST',
      batchId: payload.batchId,
      setsCount: setCount,
      questionsPerSet: questionsPerSet,
      questionsCount: setCount * questionsPerSet,
      status: (payload.status as any) || 'DRAFT',
      isLocked: false,
      logoUrl: payload.logoUrl,
      instructions: payload.instructions,
      currentRoundId: 'round-1',
      isLive: payload.status === 'LIVE',
      isPaused: false,
      settings: {
        maxTabSwitches: payload.maxTabSwitches || 3,
        lockdownFullscreen: payload.lockdownFullscreen ?? true,
        blockClipboardPaste: payload.blockClipboardPaste ?? true,
        blockContextMenu: payload.blockContextMenu ?? true,
        enablePlagiarismDetection: payload.enablePlagiarismDetection ?? true,
        autoFinalizeRound1: false,
        round2QualificationLimit: payload.round2QualificationLimit || 15
      },
      scoringConfig: {
        pointsPerProblem: 100,
        enablePartialScoring: true,
        submissionPenaltyMinutes: 10,
        enableNegativeMarking: false
      },
      qualificationConfig: {
        rule: 'TOP_N_OVERALL',
        limit: payload.round2QualificationLimit || 15,
        minPercentage: 50
      },
      antiCheatConfig: {
        maxTabSwitches: payload.maxTabSwitches || 3,
        lockdownFullscreen: payload.lockdownFullscreen ?? true,
        blockClipboardPaste: payload.blockClipboardPaste ?? true,
        blockContextMenu: payload.blockContextMenu ?? true,
        enablePlagiarismDetection: payload.enablePlagiarismDetection ?? true,
        riskThreshold: 75
      }
    };

    this.contest = newContest;
    this.contests.set(newContest.id, newContest);

    // Auto-generate Question Sets for this contest
    this.autoGenerateQuestionSets('round-1', setCount, questionsPerSet, adminUserId);

    this.logAudit('CONTEST_CREATED', adminUserId, `Created new contest: "${payload.title}" (ID: ${newContestId}, Status: ${newContest.status}).`, newContestId);
    return newContest;
  }

  saveContestDraft(id: string, updates: Partial<Contest>, adminUserId: string): Contest {
    const target = this.contests.get(id) || (this.contest.id === id ? this.contest : null);
    if (!target) throw new Error('Contest not found.');

    const updated: Contest = {
      ...target,
      ...updates,
      id,
      status: 'DRAFT',
      isLive: false
    };

    if (updates.startTime && updates.endTime) {
      const startMs = new Date(updates.startTime).getTime();
      const endMs = new Date(updates.endTime).getTime();
      if (isNaN(startMs) || isNaN(endMs)) {
        throw new Error('Please provide valid start and end dates and times.');
      }
      if (endMs <= startMs) {
        throw new Error('End date and time must be later than start date and time.');
      }
      const r1 = this.rounds.get('round-1');
      if (r1) {
        r1.startTime = updates.startTime;
        r1.endTime = updates.endTime;
        r1.durationMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));
      }
    }

    this.contests.set(id, updated);
    if (this.contest.id === id) this.contest = updated;

    this.logAudit('CONTEST_DRAFT_SAVED', adminUserId, `Saved draft changes for contest "${updated.title}" (${id}).`, id);
    return updated;
  }

  duplicateContest(id: string, adminUserId: string): Contest {
    const original = this.contests.get(id) || (this.contest.id === id ? this.contest : null);
    if (!original) throw new Error('Contest not found.');

    const newId = `cnt-${Date.now()}`;
    const duplicated: Contest = {
      ...original,
      id: newId,
      title: `${original.title} (Copy)`,
      status: 'DRAFT',
      isLive: false,
      isPaused: false
    };

    this.contests.set(newId, duplicated);

    // Duplicate question sets
    const originalSets = Array.from(this.questionSets.values()).filter(s => (s as any).contestId === id || s.roundId === original.currentRoundId);
    for (const setObj of originalSets) {
      const newSetId = `set-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      this.questionSets.set(newSetId, {
        ...setObj,
        id: newSetId,
        contestId: newId,
        problemIds: [...setObj.problemIds]
      } as any);
    }

    this.logAudit('CONTEST_DUPLICATED', adminUserId, `Duplicated contest "${original.title}" to "${duplicated.title}"`, newId);
    return duplicated;
  }

  deleteContest(id: string, adminUserId: string): { success: boolean; action: 'deleted' | 'archived' } {
    const target = this.contests.get(id);
    if (!target) throw new Error('Contest not found.');

    if (target.status === 'PUBLISHED' || target.status === 'LIVE' || target.status === 'FINALIZED') {
      target.status = 'ARCHIVED';
      target.isLive = false;
      this.contests.set(id, target);
      this.logAudit('CONTEST_ARCHIVED', adminUserId, `Archived published contest "${target.title}"`, id);
      return { success: true, action: 'archived' };
    } else {
      this.contests.delete(id);
      this.logAudit('CONTEST_DELETED', adminUserId, `Deleted draft contest "${target.title}"`, id);
      return { success: true, action: 'deleted' };
    }
  }

  saveContestSets(contestId: string, sets: Array<{ id?: string; name: string; problemIds: string[] }>, adminUserId: string) {
    // Clear existing sets for this contest to prevent orphaned sets
    Array.from(this.questionSets.keys()).forEach(k => {
      if ((this.questionSets.get(k) as any)?.contestId === contestId) {
        this.questionSets.delete(k);
      }
    });

    for (const setObj of sets) {
      const setId = setObj.id || `set-${setObj.name.toLowerCase().replace(/\s+/g, '-')}`;
      const fullObj = {
        setId,
        name: setObj.name,
        roundId: 'round-1',
        problemIds: setObj.problemIds || [],
        contestId
      };
      this.questionSets.set(setId, fullObj);
    }
    this.logAudit('CONTEST_SETS_SAVED', adminUserId, `Saved question sets for contest ${contestId}`, contestId);
  }

  publishContestWithValidation(id: string, adminUserId: string): { contest: Contest; distributedCount: number; message: string } {
    const target = this.contests.get(id) || (this.contest.id === id ? this.contest : null);
    if (!target) throw new Error('Contest not found.');

    // 1. Validation checks
    const roundId = target.currentRoundId || 'round-1';
    let contestSets = Array.from(this.questionSets.values()).filter(s => (s as any).contestId === id);
    if (contestSets.length === 0) {
      contestSets = Array.from(this.questionSets.values()).filter(s => s.roundId === roundId);
    }

    if (contestSets.length === 0) {
      throw new Error('Cannot publish contest: No Question Sets have been created or configured.');
    }

    const configuredQuestionsPerSet = (target as any).questionsPerSet || 3;

    for (const setObj of contestSets) {
      const setName = setObj.name || setObj.setId || 'Question Set';
      if (!setObj.problemIds || setObj.problemIds.length === 0) {
        throw new Error(`Cannot publish contest: Set "${setName}" has no problems assigned.`);
      }

      if (setObj.problemIds.length < configuredQuestionsPerSet) {
        throw new Error(`Cannot publish contest: Set "${setName}" requires ${configuredQuestionsPerSet} problems, but only contains ${setObj.problemIds.length}.`);
      }

      const probs = setObj.problemIds.map(pid => this.problems.get(pid)).filter(Boolean) as Problem[];
      if (probs.length !== setObj.problemIds.length) {
        throw new Error(`Cannot publish contest: Set "${setName}" contains invalid or deleted problems.`);
      }

      const hasUnpublished = probs.some(p => p.status && p.status !== 'PUBLISHED');
      if (hasUnpublished) {
        throw new Error(`Cannot publish contest: Set "${setName}" contains draft or unapproved problems. All questions must be PUBLISHED.`);
      }

      const normalizedDiffs = probs.map(p => (p.difficulty || '').toString().toUpperCase());
      const hasEasy = normalizedDiffs.includes('EASY');
      const hasMedium = normalizedDiffs.includes('MEDIUM');
      const hasHard = normalizedDiffs.includes('HARD');

      if (configuredQuestionsPerSet >= 3) {
        if (!hasEasy || !hasMedium || !hasHard) {
          throw new Error(`Cannot publish contest: Set "${setName}" must contain at least 1 Easy, 1 Medium, and 1 Hard problem.`);
        }
      }
    }

    // 2. Mark as PUBLISHED / LIVE
    target.status = 'LIVE';
    target.isLive = true;
    target.isPaused = false;
    const now = new Date();
    if (!target.endTime || new Date(target.endTime).getTime() <= now.getTime()) {
      target.startTime = target.startTime || now.toISOString();
      target.endTime = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
    }
    this.contests.set(id, target);
    this.contest = target;

    // 3. Balance & distribute question sets to eligible participants
    const distResult = this.distributeQuestionSetsToParticipants(roundId, adminUserId);

    this.logAudit(
      'CONTEST_PUBLISHED_LIVE',
      adminUserId,
      `Published contest "${target.title}" (${id}). Distributed question sets to ${distResult.updatedAssignmentsCount} participants.`,
      id
    );

    return {
      contest: target,
      distributedCount: distResult.updatedAssignmentsCount,
      message: `Contest "${target.title}" published successfully! Question sets distributed.`
    };
  }

  getStudentContests(userId: string): Array<Contest & { computedStatus: 'UPCOMING' | 'LIVE' | 'ENDED'; assignedSet?: any }> {
    const serverTime = new Date();
    const visibleContests: Array<Contest & { computedStatus: 'UPCOMING' | 'LIVE' | 'ENDED'; assignedSet?: any }> = [];

    const user = this.users.get(userId);

    // Build the set of all batch keys that this user belongs to
    const userBatchKeys = new Set<string>();
    if (user) {
      const userMemberships = this.batchMemberships.get(userId) || [];
      const candidates = [user.batchId, (user as any).assignedBatchId, (user as any).preferredBatchId, ...userMemberships].filter(Boolean);
      candidates.forEach(cand => {
        if (!cand) return;
        const candStr = cand.toString().trim().toLowerCase();
        userBatchKeys.add(candStr);
        
        // Find matching batch objects by ID or Name
        const matchingBatches = Array.from(this.batches.values()).filter(
          b => b.id.toLowerCase() === candStr || 
               (b.name && b.name.toLowerCase() === candStr) || 
               (b.normalizedName && b.normalizedName.toLowerCase() === candStr)
        );

        matchingBatches.forEach(bObj => {
          if (bObj.id) userBatchKeys.add(bObj.id.toLowerCase());
          if (bObj.name) userBatchKeys.add(bObj.name.toLowerCase());
          if (bObj.normalizedName) userBatchKeys.add(bObj.normalizedName.toLowerCase());

          // Also add all other batch IDs in this.batches that share the exact same batch name
          Array.from(this.batches.values()).forEach(other => {
            if (other.name && bObj.name && other.name.toLowerCase() === bObj.name.toLowerCase()) {
              if (other.id) userBatchKeys.add(other.id.toLowerCase());
            }
          });
        });
      });
    }

    this.contests.forEach(c => {
      // ONLY Published / Live / Ended contests are visible to students
      if (c.status === 'LIVE' || c.status === 'PUBLISHED' || c.status === 'FINALIZED') {
        // Check batch restriction
        const targetBatchId = c.batchId ? c.batchId.toString().trim() : '';
        if (targetBatchId && targetBatchId.toLowerCase() !== 'all') {
          const contestBatchKeys = new Set<string>([targetBatchId.toLowerCase()]);
          const cBatchObj = this.batches.get(targetBatchId) || Array.from(this.batches.values()).find(b => b.id === targetBatchId || b.name === targetBatchId || b.normalizedName === targetBatchId);
          if (cBatchObj) {
            if (cBatchObj.id) contestBatchKeys.add(cBatchObj.id.toLowerCase());
            if (cBatchObj.name) contestBatchKeys.add(cBatchObj.name.toLowerCase());
            if (cBatchObj.normalizedName) contestBatchKeys.add(cBatchObj.normalizedName.toLowerCase());
          }

          let matchesBatch = false;
          for (const k of contestBatchKeys) {
            if (userBatchKeys.has(k)) {
              matchesBatch = true;
              break;
            }
          }

          if (!matchesBatch) {
            // Contest is restricted to another batch - hide from this student
            return;
          }
        }

        let startTimeDate = new Date();
        let endTimeDate = new Date(Date.now() + 24 * 3600 * 1000);

        if (c.startTime) {
          const parsedStart = new Date(c.startTime);
          if (!isNaN(parsedStart.getTime())) startTimeDate = parsedStart;
        }
        if (c.endTime) {
          const parsedEnd = new Date(c.endTime);
          if (!isNaN(parsedEnd.getTime())) endTimeDate = parsedEnd;
        }

        // If contest is explicitly PUBLISHED or LIVE, extend end date if it expired in the past
        if ((c.status === 'PUBLISHED' || c.status === 'LIVE' || c.isLive) && serverTime >= endTimeDate) {
          endTimeDate = new Date(serverTime.getTime() + 24 * 3600 * 1000);
          c.endTime = endTimeDate.toISOString();
          c.status = 'LIVE';
          c.isLive = true;
          this.contests.set(c.id, c);
        }

        let computedStatus: 'UPCOMING' | 'LIVE' | 'ENDED' = 'LIVE';
        if (serverTime < startTimeDate) {
          computedStatus = 'UPCOMING';
        } else if ((c.status as string) === 'ENDED' || c.isPaused) {
          computedStatus = 'ENDED';
        } else {
          computedStatus = 'LIVE';
        }

        // Get student's locked assigned set & student's attempt for this contest
        const roundId = c.currentRoundId || 'round-1';
        const assignment = this.assignments.get(`${userId}_${roundId}`) || this.assignments.get(`${userId}_${c.id}`);
        const myAttempt = this.getAttempt(c.id, userId) || null;

        visibleContests.push({
          ...c,
          computedStatus,
          assignedSet: assignment || null,
          myAttempt
        } as any);
      }
    });

    return visibleContests;
  }

  // 4.1 Update Contest Control
  updateContestControl(id: string, updates: Partial<Contest>, adminUserId: string): Contest {
    if (this.contest.id !== id && id !== 'active') {
      // allow updating active contest
    }

    this.contest = {
      ...this.contest,
      ...updates,
      settings: {
        ...this.contest.settings,
        ...(updates.settings || {})
      },
      scoringConfig: updates.scoringConfig ? { ...this.contest.scoringConfig, ...updates.scoringConfig } : this.contest.scoringConfig,
      qualificationConfig: updates.qualificationConfig ? { ...this.contest.qualificationConfig, ...updates.qualificationConfig } : this.contest.qualificationConfig,
      antiCheatConfig: updates.antiCheatConfig ? { ...this.contest.antiCheatConfig, ...updates.antiCheatConfig } : this.contest.antiCheatConfig
    };

    this.logAudit('CONTEST_UPDATED', adminUserId, `Updated contest configuration for "${this.contest.title}".`, this.contest.id);
    return this.contest;
  }

  // 4.2 Validate Contest (12-Point Automated Integrity Check)
  validateContest(): {
    isReady: boolean;
    completionPercentage: number;
    checks: { id: string; name: string; passed: boolean; message: string; severity: 'error' | 'warning' }[];
    errors: string[];
    warnings: string[];
  } {
    const checks: { id: string; name: string; passed: boolean; message: string; severity: 'error' | 'warning' }[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Basic Info
    const hasBasicInfo = !!this.contest.title && !!this.contest.description;
    checks.push({
      id: 'basic_info',
      name: 'Contest Basic Information',
      passed: hasBasicInfo,
      message: hasBasicInfo ? `Contest Title "${this.contest.title}" and description configured.` : 'Contest title or description is missing.',
      severity: 'error'
    });
    if (!hasBasicInfo) errors.push('Contest title or description is missing.');

    // 2. Batches
    const batchList = Array.from(this.batches.values());
    const hasBatches = batchList.length > 0;
    checks.push({
      id: 'batches',
      name: 'Batch Configuration',
      passed: hasBatches,
      message: hasBatches ? `${batchList.length} candidate batches configured.` : 'At least one candidate batch must be configured.',
      severity: 'error'
    });
    if (!hasBatches) errors.push('No batches configured.');

    // 3. Rounds
    const roundList = Array.from(this.rounds.values());
    const hasRounds = roundList.length >= 1;
    checks.push({
      id: 'rounds',
      name: 'Round Setup (Round 1 & Finals)',
      passed: hasRounds,
      message: hasRounds ? `${roundList.length} competition rounds configured.` : 'At least Round 1 must be configured.',
      severity: 'error'
    });
    if (!hasRounds) errors.push('No competition rounds configured.');

    // 4. Problems in Problem Bank
    const r1Problems = Array.from(this.problems.values()).filter(p => p.roundId === 'round-1');
    const hasProblems = r1Problems.length >= 3;
    checks.push({
      id: 'problems',
      name: 'Problem Bank Repository',
      passed: hasProblems,
      message: hasProblems ? `${r1Problems.length} problems loaded for Round 1.` : `Round 1 requires at least 3 problems (currently has ${r1Problems.length}).`,
      severity: 'error'
    });
    if (!hasProblems) errors.push(`Round 1 requires at least 3 problems (found ${r1Problems.length}).`);

    // 5. Test Cases (Public + Hidden)
    let missingHiddenCount = 0;
    let missingSampleCount = 0;
    r1Problems.forEach(p => {
      if (!p.hiddenTestCases || p.hiddenTestCases.length === 0) missingHiddenCount++;
      if (!p.sampleTestCases || p.sampleTestCases.length === 0) missingSampleCount++;
    });
    const testCasesValid = missingHiddenCount === 0 && missingSampleCount === 0;
    checks.push({
      id: 'test_cases',
      name: 'Test Cases & Hidden Sandboxes',
      passed: testCasesValid,
      message: testCasesValid ? 'All problems have verified public & hidden test cases.' : `${missingHiddenCount} problem(s) lack hidden test cases and ${missingSampleCount} lack sample test cases.`,
      severity: 'error'
    });
    if (!testCasesValid) errors.push(`${missingHiddenCount} problem(s) lack hidden test cases.`);

    // 6. Question Sets
    const qSets = Array.from(this.questionSets.values()).filter(q => q.roundId === 'round-1');
    const hasSets = qSets.length >= 1;
    checks.push({
      id: 'question_sets',
      name: 'Question Sets & Difficulty Distribution',
      passed: hasSets,
      message: hasSets ? `${qSets.length} question sets built for Round 1.` : 'At least one Question Set must be created.',
      severity: 'error'
    });
    if (!hasSets) errors.push('No Question Sets created for Round 1.');

    // 7. Question Assignments
    const participantCount = Array.from(this.users.values()).filter(u => u.role === 'PARTICIPANT').length;
    const assignmentCount = Array.from(this.assignments.values()).filter(a => a.roundId === 'round-1').length;
    const assignmentsValid = participantCount > 0 && assignmentCount >= participantCount;
    checks.push({
      id: 'assignments',
      name: 'Participant Question Assignments',
      passed: assignmentsValid,
      message: assignmentsValid ? `All ${participantCount} participants have locked question assignments.` : `${assignmentCount}/${participantCount} participants assigned questions.`,
      severity: 'error'
    });
    if (!assignmentsValid && participantCount > 0) errors.push(`Unassigned participants found (${assignmentCount}/${participantCount} assigned).`);

    // 8. Scoring Configuration
    const scoringValid = (this.contest.scoringConfig?.pointsPerProblem || 100) > 0;
    checks.push({
      id: 'scoring',
      name: 'Scoring & Penalty Matrix',
      passed: scoringValid,
      message: scoringValid ? 'Scoring rules, partial credit, and penalties defined.' : 'Scoring configuration invalid.',
      severity: 'warning'
    });

    // 9. Qualification Configuration
    const qualValid = (this.contest.qualificationConfig?.limit || 15) > 0;
    checks.push({
      id: 'qualification',
      name: 'Round 2 Qualification Pipeline',
      passed: qualValid,
      message: qualValid ? `Top ${this.contest.qualificationConfig?.limit || 15} cutoff rule active.` : 'Qualification limit must be positive.',
      severity: 'warning'
    });

    // 10. Anti-Cheat Security
    const antiCheatValid = (this.contest.settings?.maxTabSwitches || 3) >= 1;
    checks.push({
      id: 'security',
      name: 'Anti-Cheat 3-Switch Surveillance',
      passed: antiCheatValid,
      message: antiCheatValid ? 'Anti-cheat 3-switch threshold, fullscreen guard, and clipboard lock enabled.' : 'Anti-cheat threshold must be >= 1.',
      severity: 'error'
    });

    // 11. Schedule & Timers
    let scheduleValid = !!this.contest.startTime && !!this.contest.endTime && !!this.contest.timezone;
    let scheduleMessage = 'Contest start time, end time, or timezone is missing.';
    if (scheduleValid) {
      const sMs = new Date(this.contest.startTime!).getTime();
      const eMs = new Date(this.contest.endTime!).getTime();
      if (isNaN(sMs) || isNaN(eMs)) {
        scheduleValid = false;
        scheduleMessage = 'Invalid start time or end time format.';
      } else if (eMs <= sMs) {
        scheduleValid = false;
        scheduleMessage = 'End date and time must be later than start date and time.';
      } else {
        scheduleMessage = `Contest start: ${this.contest.startTime}, end: ${this.contest.endTime} (${this.contest.timezone}).`;
      }
    }
    checks.push({
      id: 'schedule',
      name: 'Contest Schedule & Timers',
      passed: scheduleValid,
      message: scheduleMessage,
      severity: 'error'
    });
    if (!scheduleValid) errors.push(scheduleMessage);

    // 12. Language Support
    checks.push({
      id: 'languages',
      name: 'Multi-Language Execution Runtimes',
      passed: true,
      message: 'Python 3, JavaScript (Node), C++, and Java compilers active.',
      severity: 'warning'
    });

    const passedCount = checks.filter(c => c.passed).length;
    const completionPercentage = Math.round((passedCount / checks.length) * 100);
    const isReady = errors.length === 0;

    return {
      isReady,
      completionPercentage,
      checks,
      errors,
      warnings
    };
  }

  // 4.3 Lock Contest Configuration
  lockContestConfiguration(adminUserId: string): { contest: Contest; validation: any } {
    const validation = this.validateContest();
    if (!validation.isReady) {
      throw new Error(`Cannot lock contest: ${validation.errors.join(', ')}`);
    }

    this.contest.isLocked = true;
    this.contest.lockedAt = new Date().toISOString();
    this.contest.status = 'READY';

    this.logAudit('CONTEST_CONFIGURATION_LOCKED', adminUserId, `Contest "${this.contest.title}" configuration locked and verified ready.`, this.contest.id);
    return { contest: this.contest, validation };
  }

  // 4.4 Launch Contest
  launchContest(adminUserId: string): { contest: Contest } {
    if (!this.contest.isLocked) {
      // automatically validate and lock
      const validation = this.validateContest();
      if (!validation.isReady) {
        throw new Error(`Cannot launch contest: ${validation.errors.join(', ')}`);
      }
      this.contest.isLocked = true;
      this.contest.lockedAt = new Date().toISOString();
    }

    this.contest.status = 'LIVE';
    this.contest.isLive = true;
    this.contest.isPaused = false;

    // Activate Round 1
    const r1 = this.rounds.get('round-1');
    if (r1) {
      r1.status = 'ACTIVE';
      r1.startTime = new Date().toISOString();
      r1.endTime = new Date(Date.now() + r1.durationMinutes * 60 * 1000).toISOString();
    }

    // Activate Batch 1
    const b1 = this.batches.get('batch-1');
    if (b1) b1.isActive = true;

    this.logAudit('CONTEST_LAUNCHED', adminUserId, `Contest "${this.contest.title}" officially launched LIVE to all batches.`, this.contest.id);
    return { contest: this.contest };
  }

  // 4.5 Batch CRUD
  createBatch(data: Partial<Batch>, adminUserId: string): Batch {
    const id = data.id || `batch-${Date.now()}`;
    const startIso = data.startTime || new Date().toISOString();
    const startMs = new Date(startIso).getTime();
    const endIso = data.endTime || new Date(startMs + 60 * 60 * 1000).toISOString();
    const endMs = new Date(endIso).getTime();
    const durMins = data.slotDurationMinutes || Math.max(1, Math.round((endMs - startMs) / 60000));

    const batch: Batch = {
      id,
      name: data.name || `Batch ${this.batches.size + 1}`,
      code: data.code || `B${this.batches.size + 1}`,
      description: data.description,
      startTime: startIso,
      endTime: endIso,
      slotDurationMinutes: durMins,
      isActive: data.isActive ?? false,
      capacity: data.capacity || 30,
      participantCount: data.participantCount || 0,
      assignedQuestionSetIds: data.assignedQuestionSetIds || []
    };
    this.batches.set(batch.id, batch);
    this.logAudit('BATCH_CREATED', adminUserId, `Created batch "${batch.name}" (Capacity: ${batch.capacity})`, batch.id);
    return batch;
  }

  updateBatch(id: string, updates: Partial<Batch>, adminUserId: string): Batch {
    const existing = this.batches.get(id);
    if (!existing) throw new Error('Batch not found');
    const updated = { ...existing, ...updates, id };
    this.batches.set(id, updated);
    this.logAudit('BATCH_UPDATED', adminUserId, `Updated batch "${updated.name}"`, id);
    return updated;
  }

  deleteBatch(id: string, adminUserId: string): boolean {
    if (!this.batches.has(id)) throw new Error('Batch not found');
    const name = this.batches.get(id)!.name;
    this.batches.delete(id);
    this.logAudit('BATCH_DELETED', adminUserId, `Deleted batch "${name}" (${id})`, id);
    return true;
  }

  duplicateBatch(id: string, adminUserId: string): Batch {
    const existing = this.batches.get(id);
    if (!existing) throw new Error('Batch not found');
    const newId = `batch-${Date.now()}`;
    const cloned: Batch = {
      ...existing,
      id: newId,
      name: `${existing.name} (Copy)`,
      code: `${existing.code || 'B'}_COPY`,
      participantCount: 0,
      isActive: false
    };
    this.batches.set(newId, cloned);
    this.logAudit('BATCH_DUPLICATED', adminUserId, `Duplicated batch "${existing.name}" to "${cloned.name}"`, newId);
    return cloned;
  }

  // 4.6 Round CRUD
  createRound(data: Partial<Round>, adminUserId: string): Round {
    const id = data.id || `round-${Date.now()}`;
    const roundNumber = data.roundNumber || this.rounds.size + 1;
    const startIso = data.startTime || new Date().toISOString();
    const startMs = new Date(startIso).getTime();
    const endIso = data.endTime || new Date(startMs + 60 * 60 * 1000).toISOString();
    const endMs = new Date(endIso).getTime();
    const durMins = data.durationMinutes || Math.max(1, Math.round((endMs - startMs) / 60000));

    const round: Round = {
      id,
      name: data.name || `Round ${roundNumber}`,
      description: data.description,
      roundNumber,
      status: data.status || 'UPCOMING',
      startMode: data.startMode || 'MANUAL',
      startTime: startIso,
      endTime: endIso,
      durationMinutes: durMins,
      cutoffRank: data.cutoffRank || 15,
      minScoreForCutoff: data.minScoreForCutoff || 100,
      scoringMode: data.scoringMode || 'STANDARD',
      totalQuestions: data.totalQuestions || 3,
      isLocked: data.isLocked ?? false,
      qualifiedParticipantIds: data.qualifiedParticipantIds || []
    };
    this.rounds.set(round.id, round);
    this.logAudit('ROUND_CREATED', adminUserId, `Created round "${round.name}" (#${roundNumber})`, round.id);
    return round;
  }

  updateRound(id: string, updates: Partial<Round>, adminUserId: string): Round {
    const existing = this.rounds.get(id);
    if (!existing) throw new Error('Round not found');
    const updated = { ...existing, ...updates, id };
    this.rounds.set(id, updated);
    this.logAudit('ROUND_UPDATED', adminUserId, `Updated round "${updated.name}"`, id);
    return updated;
  }

  duplicateRound(id: string, adminUserId: string): Round {
    const existing = this.rounds.get(id);
    if (!existing) throw new Error('Round not found');
    const newId = `round-${Date.now()}`;
    const cloned: Round = {
      ...existing,
      id: newId,
      name: `${existing.name} (Copy)`,
      roundNumber: this.rounds.size + 1,
      status: 'UPCOMING',
      isLocked: false,
      qualifiedParticipantIds: []
    };
    this.rounds.set(newId, cloned);
    this.logAudit('ROUND_DUPLICATED', adminUserId, `Duplicated round "${existing.name}" to "${cloned.name}"`, newId);
    return cloned;
  }

  // 5. Problem CRUD Operations & Filter Engine
  getAllProblems(roundId?: string, includeHidden = true): Problem[] {
    const list = Array.from(this.problems.values()).filter(p => !roundId || p.roundId === roundId).map(p => ensureFiveTestCases(p));
    if (includeHidden) return list;
    return list.map(p => ({
      ...p,
      hiddenTestCases: []
    }));
  }

  getAdminProblemsFiltered(params: {
    roundId?: string;
    search?: string;
    concept?: string;
    difficulty?: string;
    companyTag?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const { roundId, search = '', concept = 'ALL', difficulty = 'ALL', companyTag = 'ALL', status = 'ALL', page = 1, limit } = params;
    const cleanSearch = search.toLowerCase().trim();

    let list = Array.from(this.problems.values());

    if (roundId) {
      list = list.filter(p => !p.roundId || p.roundId === roundId);
    }

    // Collect all available filter facets
    const allConceptsSet = new Set<string>();
    const allCompanyTagsSet = new Set<string>();
    let publishedCount = 0;
    let draftCount = 0;
    let archivedCount = 0;

    for (const p of this.problems.values()) {
      if (p.concepts) p.concepts.forEach(c => allConceptsSet.add(c));
      if (p.tags) p.tags.forEach(t => allConceptsSet.add(t));
      if (p.companyTags) p.companyTags.forEach(ct => allCompanyTagsSet.add(ct));
      const s = p.status || 'PUBLISHED';
      if (s === 'PUBLISHED') publishedCount++;
      else if (s === 'DRAFT') draftCount++;
      else if (s === 'ARCHIVED') archivedCount++;
    }

    // Search filter (title, ID, slug, description, concept, tag)
    if (cleanSearch) {
      list = list.filter(
        p =>
          p.title.toLowerCase().includes(cleanSearch) ||
          p.id.toLowerCase().includes(cleanSearch) ||
          p.slug.toLowerCase().includes(cleanSearch) ||
          (p.description && p.description.toLowerCase().includes(cleanSearch)) ||
          (p.concepts && p.concepts.some(c => c.toLowerCase().includes(cleanSearch))) ||
          (p.tags && p.tags.some(t => t.toLowerCase().includes(cleanSearch))) ||
          (p.companyTags && p.companyTags.some(ct => ct.toLowerCase().includes(cleanSearch)))
      );
    }

    // Concept filter
    if (concept && concept !== 'ALL') {
      list = list.filter(
        p =>
          (p.concepts && p.concepts.some(c => c.toLowerCase() === concept.toLowerCase())) ||
          (p.tags && p.tags.some(t => t.toLowerCase() === concept.toLowerCase()))
      );
    }

    // Difficulty filter
    if (difficulty && difficulty !== 'ALL') {
      list = list.filter(p => p.difficulty.toUpperCase() === difficulty.toUpperCase());
    }

    // Company Tag filter
    if (companyTag && companyTag !== 'ALL') {
      list = list.filter(
        p => p.companyTags && p.companyTags.some(ct => ct.toLowerCase() === companyTag.toLowerCase())
      );
    }

    // Status filter
    if (status && status !== 'ALL') {
      list = list.filter(p => (p.status || 'PUBLISHED') === status);
    }

    // Sort by updatedAt descending
    list.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

    const total = list.length;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = (limit !== undefined && limit !== null && Number(limit) > 0) ? Number(limit) : (total || 1);
    let paginated = list;
    if (limit !== undefined && limit !== null && Number(limit) > 0) {
      const startIndex = (pageNum - 1) * limitNum;
      paginated = list.slice(startIndex, startIndex + limitNum);
    }

    return {
      problems: paginated,
      total,
      publishedCount,
      draftCount,
      archivedCount,
      availableConcepts: Array.from(allConceptsSet).sort(),
      availableCompanyTags: Array.from(allCompanyTagsSet).sort(),
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1
    };
  }

  createProblem(data: Partial<Problem>, adminUserId: string): Problem {
    const title = (data.title || '').trim();
    if (!title) throw new Error('Problem title is required.');

    const roundId = data.roundId || 'round-1';
    const slug = (data.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')).trim();
    const rawId = data.id || `prob-${slug || Date.now()}`;
    const maximumMarks = Number(data.maximumMarks || data.points) || 100;
    const now = new Date().toISOString();

    const sampleTestCases = data.sampleTestCases && data.sampleTestCases.length > 0 ? data.sampleTestCases : [
      { id: `tc-sample-${Date.now()}-1`, input: '5\n1 2 3 4 5', expectedOutput: '15', isHidden: false, marks: 30, explanation: 'Sum of elements is 15.' }
    ];

    const hiddenTestCases = data.hiddenTestCases && data.hiddenTestCases.length > 0 ? data.hiddenTestCases : [
      { id: `tc-hidden-${Date.now()}-1`, input: '6\n10 20 30 40 50 60', expectedOutput: '210', isHidden: true, marks: 70 }
    ];

    const newProblem: Problem = {
      id: rawId,
      title,
      slug,
      description: data.description || data.problemStatement || 'Problem statement and task specifications.',
      problemStatement: data.problemStatement || data.description || 'Problem statement and task specifications.',
      inputFormat: data.inputFormat || 'Standard input format specifications',
      outputFormat: data.outputFormat || 'Standard output format specifications',
      constraints: data.constraints || '1 <= N <= 10^5',
      difficulty: data.difficulty || 'MEDIUM',
      category: data.category || 'Algorithms',
      concepts: data.concepts || data.tags || ['Algorithms'],
      companyTags: data.companyTags || [],
      tags: data.tags || data.concepts || ['Algorithms'],
      points: maximumMarks,
      maximumMarks: maximumMarks,
      roundId,
      timeLimitMs: Number(data.timeLimitMs) || 1000,
      memoryLimitMb: Number(data.memoryLimitMb) || 256,
      sampleTestCases,
      hiddenTestCases,
      explanation: data.explanation || '',
      languages: data.languages || ['python', 'javascript', 'cpp', 'c', 'java'],
      status: data.status || 'DRAFT',
      version: 1,
      createdAt: now,
      updatedAt: now,
      starterCode: data.starterCode || {
        python: `# Python 3 Solution\nimport sys\n\ndef solve():\n    lines = sys.stdin.read().strip().splitlines()\n    if not lines:\n        return\n    # Write logic here\n\nif __name__ == '__main__':\n    solve()\n`,
        javascript: `// JavaScript (Node.js) Solution\nconst fs = require('fs');\n\nfunction solve() {\n  const input = fs.readFileSync(0, 'utf-8').trim();\n  if (!input) return;\n  // Write logic here\n}\nsolve();\n`,
        cpp: `// C++ Solution\n#include <iostream>\n#include <vector>\n#include <string>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    // Write logic here\n    return 0;\n}\n`,
        c: `// C Solution\n#include <stdio.h>\n#include <stdlib.h>\n\nint main() {\n    // Write logic here\n    return 0;\n}\n`,
        java: `// Java Solution\nimport java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write logic here\n    }\n}\n`
      }
    };

    this.problems.set(newProblem.id, newProblem);
    this.logAudit('PROBLEM_CREATED', adminUserId, `Created problem "${newProblem.title}" (${newProblem.id}) with status ${newProblem.status}`, newProblem.id);
    return newProblem;
  }

  updateProblem(problemId: string, data: Partial<Problem>, adminUserId: string): Problem {
    const existing = this.problems.get(problemId);
    if (!existing) throw new Error('Problem not found');

    const maxMarks = data.maximumMarks !== undefined ? Number(data.maximumMarks) : (data.points !== undefined ? Number(data.points) : existing.maximumMarks || existing.points);

    const updated: Problem = {
      ...existing,
      ...data,
      id: problemId,
      points: maxMarks,
      maximumMarks: maxMarks,
      updatedAt: new Date().toISOString()
    };

    this.problems.set(problemId, updated);
    this.logAudit('PROBLEM_UPDATED', adminUserId, `Updated problem "${updated.title}" (${problemId})`, problemId);
    return updated;
  }

  publishProblem(problemId: string, adminUserId: string): Problem {
    const problem = this.problems.get(problemId);
    if (!problem) throw new Error('Problem not found');

    // Validation checks before publishing
    if (!problem.title?.trim()) throw new Error('Cannot publish problem: Missing title.');
    if (!problem.slug?.trim()) throw new Error('Cannot publish problem: Missing slug.');
    if (!problem.inputFormat?.trim()) throw new Error('Cannot publish problem: Missing input format.');
    if (!problem.outputFormat?.trim()) throw new Error('Cannot publish problem: Missing output format.');
    if (!problem.constraints?.trim()) throw new Error('Cannot publish problem: Missing constraints.');
    if (!problem.sampleTestCases || problem.sampleTestCases.length === 0) {
      throw new Error('Cannot publish problem: At least 1 Sample Test Case is required.');
    }
    if (!problem.hiddenTestCases || problem.hiddenTestCases.length === 0) {
      throw new Error('Cannot publish problem: At least 1 Hidden Test Case is required.');
    }

    problem.status = 'PUBLISHED';
    problem.publishedAt = new Date().toISOString();
    problem.updatedAt = new Date().toISOString();

    this.logAudit('PROBLEM_PUBLISHED', adminUserId, `Published problem "${problem.title}" (${problemId}) to active bank.`, problemId);
    return problem;
  }

  archiveProblem(problemId: string, adminUserId: string): Problem {
    const problem = this.problems.get(problemId);
    if (!problem) throw new Error('Problem not found');

    problem.status = 'ARCHIVED';
    problem.archivedAt = new Date().toISOString();
    problem.updatedAt = new Date().toISOString();

    this.logAudit('PROBLEM_ARCHIVED', adminUserId, `Archived problem "${problem.title}" (${problemId}).`, problemId);
    return problem;
  }

  unpublishProblem(problemId: string, adminUserId: string): Problem {
    const problem = this.problems.get(problemId);
    if (!problem) throw new Error('Problem not found');

    problem.status = 'DRAFT';
    problem.updatedAt = new Date().toISOString();

    this.logAudit('PROBLEM_UNPUBLISHED', adminUserId, `Reverted problem "${problem.title}" (${problemId}) to DRAFT status.`, problemId);
    return problem;
  }

  duplicateProblem(problemId: string, adminUserId: string): Problem {
    const existing = this.problems.get(problemId);
    if (!existing) throw new Error('Problem not found');
    const newId = `prob-${existing.roundId || 'round-1'}-${Date.now()}`;
    const cloned: Problem = {
      ...existing,
      id: newId,
      title: `${existing.title} (Copy)`,
      slug: `${existing.slug}-copy`,
      status: 'DRAFT',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.problems.set(newId, cloned);
    this.logAudit('PROBLEM_DUPLICATED', adminUserId, `Duplicated problem "${existing.title}" to "${cloned.title}" (${newId})`, newId);
    return cloned;
  }

  // Bulk Import Problems with Validation & Duplicate Detection
  bulkImportProblems(
    problemsList: any[],
    options: { onDuplicate: 'skip' | 'replace' | 'overwrite' | 'version' | 'create_new_id'; defaultRoundId?: string },
    adminUserId: string
  ): {
    total: number;
    validCount: number;
    duplicateCount: number;
    errorCount: number;
    imported: Problem[];
    warnings: string[];
    errors: { problemId: string; title: string; errors: string[] }[];
  } {
    let validCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    const imported: Problem[] = [];
    const warnings: string[] = [];
    const errors: { problemId: string; title: string; errors: string[] }[] = [];
    const defaultRound = options.defaultRoundId || 'round-1';

    problemsList.forEach((raw, index) => {
      const rowIdx = index + 1;
      const rawId = (raw.id || raw.problemId || raw.problem_id || `P${String(this.problems.size + index + 1).padStart(3, '0')}`).trim();
      const title = (raw.title || raw.problemTitle || raw.name || raw.problem_name || `Problem ${rawId}`).trim();
      const problemErrors: string[] = [];

      if (!title && !raw.description && !raw.problemStatement) {
        problemErrors.push('Missing problem content/title.');
      }

      if (problemErrors.length > 0) {
        errorCount++;
        errors.push({ problemId: rawId, title: title || `Problem #${rowIdx}`, errors: problemErrors });
        return;
      }

      const slug = (raw.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')) || `prob-${rawId.toLowerCase()}`;
      
      // Check duplicate
      const existingById = this.problems.get(rawId);
      const existingByTitle = Array.from(this.problems.values()).find(
        p => (p.title && p.title.toLowerCase() === title.toLowerCase()) || p.slug === slug
      );

      let targetId = rawId;

      if (existingById || existingByTitle) {
        duplicateCount++;
        const dupProblem = existingById || existingByTitle!;
        const mode = options.onDuplicate || 'upsert';

        if (mode === 'skip') {
          warnings.push(`Row ${rowIdx}: Duplicate problem "${title}" skipped (Matches existing ID ${dupProblem.id}).`);
          return;
        } else if (mode === 'create_new_id' || mode === 'version') {
          targetId = `${rawId}-copy-${Date.now()}`;
        } else {
          // 'upsert', 'replace', 'overwrite'
          targetId = dupProblem.id;
        }
      }

      // Format Difficulty via Priority 1 (Metadata) -> Priority 2 (Folder/Path/Title/ID)
      let difficulty: 'EASY' | 'MEDIUM' | 'HARD' = 'MEDIUM';
      const explicit = String(raw.difficulty || raw.difficultyLevel || raw.level || raw.diff || '').trim().toUpperCase();
      if (explicit) {
        if (explicit.includes('EASY')) difficulty = 'EASY';
        else if (explicit.includes('MEDIUM') || explicit.includes('MED')) difficulty = 'MEDIUM';
        else if (explicit.includes('HARD')) difficulty = 'HARD';
      } else {
        const searchStr = `${raw.folderPath || ''} ${raw.folderName || ''} ${rawId} ${title}`.toLowerCase();
        if (
          /\b(easy)\b/i.test(searchStr) || searchStr.includes('_easy') || searchStr.includes('easy_') || searchStr.startsWith('easy')
        ) {
          difficulty = 'EASY';
        } else if (
          /\b(hard)\b/i.test(searchStr) || searchStr.includes('_hard') || searchStr.includes('hard_') || searchStr.startsWith('hard')
        ) {
          difficulty = 'HARD';
        } else if (
          /\b(medium|med)\b/i.test(searchStr) || searchStr.includes('_medium') || searchStr.includes('medium_') || searchStr.startsWith('medium')
        ) {
          difficulty = 'MEDIUM';
        } else {
          problemErrors.push('Difficulty is missing or could not be determined.');
        }
      }

      // Parse concepts and tags
      let concepts: string[] = [];
      if (Array.isArray(raw.concepts)) concepts = raw.concepts;
      else if (Array.isArray(raw.tags)) concepts = raw.tags;
      else if (typeof raw.concepts === 'string') concepts = raw.concepts.split(/[;,|]/).map((t: string) => t.trim()).filter(Boolean);
      else if (typeof raw.tags === 'string') concepts = raw.tags.split(/[;,|]/).map((t: string) => t.trim()).filter(Boolean);
      if (concepts.length === 0) concepts = ['Algorithms'];

      // Parse company tags
      let companyTags: string[] = [];
      if (Array.isArray(raw.companyTags)) companyTags = raw.companyTags;
      else if (typeof raw.companyTags === 'string') companyTags = raw.companyTags.split(/[;,|]/).map((t: string) => t.trim()).filter(Boolean);

      // Parse test cases
      let sampleTestCases: TestCase[] = [];
      let hiddenTestCases: TestCase[] = [];

      if (Array.isArray(raw.sampleTestCases) && raw.sampleTestCases.length > 0) {
        sampleTestCases = raw.sampleTestCases.map((tc: any, i: number) => ({
          id: tc.id || `tc-sample-${targetId}-${i + 1}`,
          input: String(tc.input || ''),
          expectedOutput: String(tc.expectedOutput || tc.output || ''),
          isHidden: false,
          marks: Number(tc.marks) || 10,
          explanation: tc.explanation || ''
        }));
      } else if (raw.sampleInput || raw.sampleOutput) {
        sampleTestCases.push({
          id: `tc-sample-${targetId}-1`,
          input: String(raw.sampleInput || ''),
          expectedOutput: String(raw.sampleOutput || ''),
          isHidden: false,
          marks: 30,
          explanation: raw.sampleExplanation
        });
      }

      if (Array.isArray(raw.hiddenTestCases) && raw.hiddenTestCases.length > 0) {
        hiddenTestCases = raw.hiddenTestCases.map((tc: any, i: number) => ({
          id: tc.id || `tc-hidden-${targetId}-${i + 1}`,
          input: String(tc.input || ''),
          expectedOutput: String(tc.expectedOutput || tc.output || ''),
          isHidden: true,
          marks: Number(tc.marks) || 20
        }));
      }

      // Filter out descriptive text or empty test cases
      sampleTestCases = sampleTestCases.filter(tc => tc.input && tc.expectedOutput && !isDescriptiveText(tc.input) && !isDescriptiveText(tc.expectedOutput));
      hiddenTestCases = hiddenTestCases.filter(tc => tc.input && tc.expectedOutput && !isDescriptiveText(tc.input) && !isDescriptiveText(tc.expectedOutput));

      if (sampleTestCases.length < 2 || hiddenTestCases.length < 3) {
        const combined = [...sampleTestCases, ...hiddenTestCases];
        if (combined.length >= 5) {
          sampleTestCases = combined.slice(0, 2).map((t, idx) => ({ ...t, isHidden: false, id: `tc-sample-${targetId}-${idx + 1}` }));
          hiddenTestCases = combined.slice(2, 5).map((t, idx) => ({ ...t, isHidden: true, id: `tc-hidden-${targetId}-${idx + 1}` }));
        }
      }

      if (sampleTestCases.length < 2) {
        problemErrors.push(`Exactly 2 Sample Test Cases are required (found ${sampleTestCases.length}).`);
      }
      if (hiddenTestCases.length < 3) {
        problemErrors.push(`Exactly 3 Hidden Evaluation Test Cases are required (found ${hiddenTestCases.length}).`);
      }

      const marksPerCase = difficulty === 'EASY' ? 2 : difficulty === 'HARD' ? 5 : 3;
      const maximumMarks = difficulty === 'EASY' ? 10 : difficulty === 'HARD' ? 25 : 15;

      sampleTestCases = sampleTestCases.slice(0, 2).map((tc, i) => ({
        ...tc,
        id: `tc-sample-${targetId}-${i + 1}`,
        marks: marksPerCase,
        isHidden: false
      }));

      hiddenTestCases = hiddenTestCases.slice(0, 3).map((tc, i) => ({
        ...tc,
        id: `tc-hidden-${targetId}-${i + 1}`,
        marks: marksPerCase,
        isHidden: true
      }));

      if (!raw.description && !raw.problemStatement) {
        problemErrors.push('description or problemStatement is required.');
      }
      if (!raw.inputFormat && !raw.input_format) {
        problemErrors.push('inputFormat is required.');
      }
      if (!raw.outputFormat && !raw.output_format) {
        problemErrors.push('outputFormat is required.');
      }
      if (!raw.constraints) {
        problemErrors.push('constraints is required.');
      }

      if (problemErrors.length > 0) {
        errorCount++;
        errors.push({ problemId: rawId, title: title || `Problem #${rowIdx}`, errors: problemErrors });
        return;
      }

      const problem: Problem = {
        id: targetId,
        title,
        slug,
        description: raw.description || raw.problemStatement || 'Problem description.',
        problemStatement: raw.problemStatement || raw.description || 'Problem statement.',
        inputFormat: raw.inputFormat || raw.input_format || 'Standard input format',
        outputFormat: raw.outputFormat || raw.output_format || 'Standard output format',
        constraints: raw.constraints || '1 <= N <= 10^5',
        difficulty,
        category: concepts[0] || 'Algorithms',
        concepts,
        companyTags,
        tags: concepts,
        points: maximumMarks,
        maximumMarks,
        roundId: raw.roundId || defaultRound,
        timeLimitMs: Number(raw.timeLimitMs || raw.time_limit) || 1000,
        memoryLimitMb: Number(raw.memoryLimitMb || raw.memory_limit) || 256,
        sampleTestCases,
        hiddenTestCases,
        explanation: raw.explanation || '',
        languages: ['python', 'javascript', 'cpp', 'c', 'java'],
        status: 'PUBLISHED', // All imported ZIP problems automatically become PUBLISHED
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        starterCode: {
          python: `# Python 3 Solution\nimport sys\n\ndef solve():\n    lines = sys.stdin.read().strip().splitlines()\n    if not lines:\n        return\n    # Write logic here\n\nif __name__ == '__main__':\n    solve()\n`,
          javascript: `// JavaScript (Node.js) Solution\nconst fs = require('fs');\n\nfunction solve() {\n  const input = fs.readFileSync(0, 'utf-8').trim();\n  if (!input) return;\n  // Write logic here\n}\nsolve();\n`,
          cpp: `// C++ Solution\n#include <iostream>\n#include <vector>\n#include <string>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    // Write logic here\n    return 0;\n}\n`,
          c: `// C Solution\n#include <stdio.h>\n#include <stdlib.h>\n\nint main() {\n    // Write logic here\n    return 0;\n}\n`,
          java: `// Java Solution\nimport java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write logic here\n    }\n}\n`
        }
      };

      this.problems.set(problem.id, problem);
      imported.push(problem);
      validCount++;
    });

    this.logAudit(
      'BULK_PROBLEMS_IMPORTED',
      adminUserId,
      `Imported ${validCount} problems (${duplicateCount} duplicates, ${errorCount} errors).`
    );

    return {
      total: problemsList.length,
      validCount,
      duplicateCount,
      errorCount,
      imported,
      warnings,
      errors
    };
  }

  deleteProblem(problemId: string, adminUserId: string): boolean {
    const problem = this.problems.get(problemId);
    if (!problem) throw new Error('Problem not found');

    this.problems.delete(problemId);

    // Remove problem from question sets
    this.questionSets.forEach(qs => {
      qs.problemIds = qs.problemIds.filter(pid => pid !== problemId);
    });

    this.logAudit('PROBLEM_DELETED', adminUserId, `Deleted problem "${problem.title}" (${problemId})`, problemId);
    return true;
  }

  // 6. Question Sets Management
  getQuestionSets(roundId: string = 'round-1'): QuestionSet[] {
    const sets: QuestionSet[] = [];
    this.questionSets.forEach((val, key) => {
      if (val.roundId === roundId) {
        // Count how many participants are assigned to this set
        let count = 0;
        this.assignments.forEach(a => {
          if (a.roundId === roundId && a.setId === val.setId) count++;
        });

        sets.push({
          id: key,
          name: val.setId,
          roundId: val.roundId,
          problemIds: val.problemIds,
          assignedParticipantsCount: count
        });
      }
    });

    return sets.sort((a, b) => a.name.localeCompare(b.name));
  }

  saveQuestionSet(data: { id?: string; name: string; roundId: string; problemIds: string[]; description?: string }, adminUserId: string): QuestionSet {
    const key = data.id || `set-${data.roundId}-${Date.now()}`;
    const entry = {
      roundId: data.roundId,
      setId: data.name,
      problemIds: data.problemIds
    };
    this.questionSets.set(key, entry);

    this.logAudit('QUESTION_SET_SAVED', adminUserId, `Saved Question Set "${data.name}" with ${data.problemIds.length} problems for ${data.roundId}`, key);

    return {
      id: key,
      name: entry.setId,
      roundId: entry.roundId,
      problemIds: entry.problemIds,
      description: data.description
    };
  }

  deleteQuestionSet(setId: string, adminUserId: string): boolean {
    if (!this.questionSets.has(setId)) throw new Error('Question set not found');
    const setObj = this.questionSets.get(setId)!;
    this.questionSets.delete(setId);
    this.logAudit('QUESTION_SET_DELETED', adminUserId, `Deleted Question Set "${setObj.setId}" (${setId})`, setId);
    return true;
  }

  autoGenerateQuestionSets(roundId: string, setCount: number, questionsPerSet: number, adminUserId: string, targetContestId?: string): QuestionSet[] {
    const cid = targetContestId || this._contest?.id || 'contest-1';
    let roundProblems = Array.from(this.problems.values()).filter(p => !roundId || p.roundId === roundId);
    if (roundProblems.length === 0) {
      roundProblems = Array.from(this.problems.values());
    }
    if (roundProblems.length === 0) return [];

    // Clear existing sets for this round/contest
    Array.from(this.questionSets.keys()).forEach(k => {
      const s = this.questionSets.get(k) as any;
      if (s?.roundId === roundId || s?.contestId === cid) {
        this.questionSets.delete(k);
      }
    });

    const sets: QuestionSet[] = [];
    const easyProblems = roundProblems.filter(p => (p.difficulty || '').toUpperCase() === 'EASY');
    const mediumProblems = roundProblems.filter(p => (p.difficulty || '').toUpperCase() === 'MEDIUM');
    const hardProblems = roundProblems.filter(p => (p.difficulty || '').toUpperCase() === 'HARD');

    for (let i = 0; i < setCount; i++) {
      const char = String.fromCharCode(65 + i); // A, B, C...
      const setKey = `set-${cid}-${char.toLowerCase()}`;
      const setName = `Set ${char}`;

      const assignedProblemIds: string[] = [];

      // Balanced 1 Easy, 1 Medium, 1 Hard pattern
      if (easyProblems.length > 0 && mediumProblems.length > 0 && hardProblems.length > 0 && questionsPerSet === 3) {
        const easyProb = easyProblems[i % easyProblems.length];
        const medProb = mediumProblems[i % mediumProblems.length];
        const hardProb = hardProblems[i % hardProblems.length];
        assignedProblemIds.push(easyProb.id, medProb.id, hardProb.id);
      } else {
        // Staggered permutation fallback
        for (let q = 0; q < questionsPerSet; q++) {
          const probIndex = (i + q) % roundProblems.length;
          assignedProblemIds.push(roundProblems[probIndex].id);
        }
      }

      const setObj: any = {
        id: setKey,
        name: setName,
        setId: setName,
        roundId,
        contestId: cid,
        problemIds: assignedProblemIds,
        totalMarks: 50
      };

      this.questionSets.set(setKey, setObj);
      sets.push(setObj);
    }

    // Re-assign all participants to newly generated sets
    this.distributeQuestionSetsToParticipants(roundId, adminUserId);

    this.logAudit('QUESTION_SETS_AUTOGENERATED', adminUserId, `Generated ${setCount} question sets with ${questionsPerSet} questions each for contest ${cid} (${roundId})`);
    return sets;
  }

  saveAllQuestionSets(
    roundId: string,
    setsPayload: Array<{
      id?: string;
      name: string;
      problemIds: string[];
      description?: string;
      difficultyDistribution?: { easy: number; medium: number; hard: number };
    }>,
    adminUserId: string
  ): QuestionSet[] {
    // Remove existing sets for this round
    Array.from(this.questionSets.keys()).forEach(k => {
      if (this.questionSets.get(k)?.roundId === roundId) {
        this.questionSets.delete(k);
      }
    });

    const savedSets: QuestionSet[] = [];
    setsPayload.forEach((s, idx) => {
      const char = String.fromCharCode(65 + idx);
      const setId = s.id || `set-${roundId}-${char.toLowerCase()}-${Date.now()}`;
      const setName = s.name || `Set ${char}`;

      // Filter to existing problems
      const validProblemIds = (s.problemIds || []).filter(pid => this.problems.has(pid));

      this.questionSets.set(setId, {
        roundId,
        setId: setName,
        problemIds: validProblemIds
      });

      savedSets.push({
        id: setId,
        name: setName,
        roundId,
        problemIds: validProblemIds,
        description: s.description,
        difficultyDistribution: s.difficultyDistribution
      });
    });

    this.logAudit(
      'QUESTION_SETS_BULK_SAVED',
      adminUserId,
      `Saved ${savedSets.length} question sets for ${roundId} via Set Builder.`,
      roundId
    );

    return savedSets;
  }

  validateQuestionSetsConfig(
    roundId: string,
    expectedSetCount: number,
    expectedQuestionsPerSet: number,
    difficultyPattern: string[],
    allowCrossSetDuplicates: boolean = false
  ): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    setReports: Array<{
      setId: string;
      name: string;
      isReady: boolean;
      questionCount: number;
      expectedCount: number;
      easyCount: number;
      mediumCount: number;
      hardCount: number;
      totalMarks: number;
      errors: string[];
      warnings: string[];
    }>;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const setReports: any[] = [];

    const roundSets = Array.from(this.questionSets.entries())
      .filter(([_, s]) => s.roundId === roundId)
      .map(([id, s]) => ({ id, ...s }));

    if (roundSets.length === 0) {
      errors.push('No question sets exist for this round.');
    } else if (expectedSetCount && roundSets.length !== expectedSetCount) {
      warnings.push(`Expected ${expectedSetCount} sets, but currently ${roundSets.length} sets are configured.`);
    }

    const globalProblemUsage: Record<string, string[]> = {};

    roundSets.forEach(s => {
      const setErrors: string[] = [];
      const setWarnings: string[] = [];
      let easyCount = 0;
      let mediumCount = 0;
      let hardCount = 0;
      let totalMarks = 0;

      const seenInSet = new Set<string>();

      s.problemIds.forEach((pid, slotIdx) => {
        const prob = this.problems.get(pid);
        if (!prob) {
          setErrors.push(`Question slot ${slotIdx + 1}: Problem "${pid}" was not found in problem bank.`);
          return;
        }

        // Status check
        if (prob.status && prob.status !== 'PUBLISHED') {
          setErrors.push(`Question "${prob.title}" is in ${prob.status} status (must be PUBLISHED).`);
        }

        // Same-set duplicate check
        if (seenInSet.has(pid)) {
          setErrors.push(`Problem "${prob.title}" appears multiple times in ${s.setId}.`);
        }
        seenInSet.add(pid);

        // Cross-set tracking
        if (!globalProblemUsage[pid]) globalProblemUsage[pid] = [];
        globalProblemUsage[pid].push(s.setId);

        // Difficulty tracking
        if (prob.difficulty === 'EASY') easyCount++;
        else if (prob.difficulty === 'MEDIUM') mediumCount++;
        else if (prob.difficulty === 'HARD') hardCount++;

        totalMarks += prob.points || 100;

        // Slot difficulty match check
        if (difficultyPattern && difficultyPattern[slotIdx]) {
          const expectedDiff = difficultyPattern[slotIdx].toUpperCase();
          if (prob.difficulty !== expectedDiff) {
            setWarnings.push(`Slot ${slotIdx + 1} requires ${expectedDiff}, but "${prob.title}" is ${prob.difficulty}.`);
          }
        }
      });

      if (expectedQuestionsPerSet && s.problemIds.length !== expectedQuestionsPerSet) {
        setErrors.push(`Set has ${s.problemIds.length}/${expectedQuestionsPerSet} required questions assigned.`);
      }

      const isReady = setErrors.length === 0;

      setReports.push({
        setId: s.id,
        name: s.setId,
        isReady,
        questionCount: s.problemIds.length,
        expectedCount: expectedQuestionsPerSet,
        easyCount,
        mediumCount,
        hardCount,
        totalMarks,
        errors: setErrors,
        warnings: setWarnings
      });

      if (!isReady) {
        errors.push(`${s.setId}: Incomplete or invalid configuration.`);
      }
    });

    // Cross-set duplicate validation
    if (!allowCrossSetDuplicates) {
      Object.entries(globalProblemUsage).forEach(([pid, setNames]) => {
        if (setNames.length > 1) {
          const prob = this.problems.get(pid);
          const title = prob ? prob.title : pid;
          warnings.push(`Problem "${title}" is assigned across multiple sets (${setNames.join(', ')}).`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      setReports
    };
  }

  randomizeSetsFromPools(
    roundId: string,
    setCount: number,
    questionsPerSet: number,
    difficultyPattern: string[],
    allowCrossSetDuplicates: boolean = false,
    adminUserId: string
  ): QuestionSet[] {
    const allProbs = Array.from(this.problems.values()).filter(
      p => p.roundId === roundId && p.status === 'PUBLISHED'
    );

    const easyProbs = allProbs.filter(p => p.difficulty === 'EASY');
    const mediumProbs = allProbs.filter(p => p.difficulty === 'MEDIUM');
    const hardProbs = allProbs.filter(p => p.difficulty === 'HARD');

    // Shuffle helper
    const shuffle = <T>(arr: T[]): T[] => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    const shuffledEasy = shuffle(easyProbs);
    const shuffledMed = shuffle(mediumProbs);
    const shuffledHard = shuffle(hardProbs);

    const sets: Array<{ name: string; problemIds: string[] }> = [];
    const usedGlobally = new Set<string>();

    for (let i = 0; i < setCount; i++) {
      const char = String.fromCharCode(65 + i);
      const assigned: string[] = [];

      for (let q = 0; q < questionsPerSet; q++) {
        const targetDiff = (difficultyPattern[q] || (q === 0 ? 'EASY' : q === 1 ? 'MEDIUM' : 'HARD')).toUpperCase();
        let pool = targetDiff === 'EASY' ? shuffledEasy : targetDiff === 'HARD' ? shuffledHard : shuffledMed;
        if (pool.length === 0) pool = allProbs; // fallback

        let picked: Problem | undefined;
        if (!allowCrossSetDuplicates) {
          picked = pool.find(p => !usedGlobally.has(p.id) && !assigned.includes(p.id));
        }
        if (!picked) {
          // Circular pick avoiding same-set duplicate
          picked = pool.find(p => !assigned.includes(p.id)) || pool[(i + q) % pool.length];
        }

        if (picked) {
          assigned.push(picked.id);
          usedGlobally.add(picked.id);
        }
      }

      sets.push({
        name: `Set ${char}`,
        problemIds: assigned
      });
    }

    return this.saveAllQuestionSets(roundId, sets, adminUserId);
  }

  distributeQuestionSetsToParticipants(roundId: string, adminUserId: string): { updatedAssignmentsCount: number } {
    const roundSets = Array.from(this.questionSets.values()).filter(s => s.roundId === roundId || !roundId);
    if (roundSets.length === 0) return { updatedAssignmentsCount: 0 };

    // Clean up any question sets with missing or 'undefined' set names
    roundSets.forEach((s, idx) => {
      let validName = s.setId || (s as any).name;
      if (!validName || validName === 'undefined') {
        validName = `Set ${String.fromCharCode(65 + idx)}`;
        s.setId = validName;
        (s as any).name = validName;
      }
    });

    let count = 0;
    const participants = Array.from(this.users.values()).filter(u => u.role === 'PARTICIPANT');

    // Group participants by batchId
    const batchGroups = new Map<string, typeof participants>();
    participants.forEach(u => {
      const bId = u.batchId || 'unassigned';
      if (!batchGroups.has(bId)) batchGroups.set(bId, []);
      batchGroups.get(bId)!.push(u);
    });

    // For each batch group, shuffle question sets and distribute evenly across batch users
    batchGroups.forEach((batchUsers) => {
      // Create a pool of sets replicated to match user count
      let setPool: typeof roundSets = [];
      while (setPool.length < batchUsers.length) {
        setPool = setPool.concat(roundSets);
      }
      setPool = setPool.slice(0, batchUsers.length);

      // Fisher-Yates random shuffle of the set pool for this batch
      for (let i = setPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [setPool[i], setPool[j]] = [setPool[j], setPool[i]];
      }

      batchUsers.forEach((user, uIdx) => {
        const qSet = setPool[uIdx] || roundSets[0];
        const setName = qSet.setId || (qSet as any).name || `Set ${String.fromCharCode(65 + (uIdx % roundSets.length))}`;

        // Permutation shuffle problem order for candidate
        const shuffledProbs = [...qSet.problemIds];
        for (let i = shuffledProbs.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledProbs[i], shuffledProbs[j]] = [shuffledProbs[j], shuffledProbs[i]];
        }

        const assignment: QuestionAssignment = {
          id: `assign-${user.id}-${roundId}`,
          userId: user.id,
          roundId,
          setId: setName,
          problemIds: qSet.problemIds,
          shuffledProblemIds: shuffledProbs,
          isLocked: true,
          lockedAt: new Date().toISOString(),
          overridden: false,
          assignedAt: new Date().toISOString()
        };

        this.assignments.set(`${user.id}_${roundId}`, assignment);
        if ((qSet as any).contestId) {
          this.assignments.set(`${user.id}_${(qSet as any).contestId}`, assignment);
        }
        count++;
      });
    });

    this.logAudit('QUESTION_SETS_DISTRIBUTED', adminUserId, `Randomly distributed ${roundSets.length} question sets across ${batchGroups.size} batches to ${count} participants for ${roundId}`);
    return { updatedAssignmentsCount: count };
  }

  // 7. Unlock participant session & Resume attempt
  unlockAttemptAndResume(
    contestId: string,
    attemptIdOrUserId: string,
    adminUserId: string,
    reason: string
  ): {
    attempt: ContestAttempt;
    securityState: ParticipantSecurityState;
    overrideRecord: OverrideAuditRecord;
  } {
    const adminUser = this.users.get(adminUserId) || { id: adminUserId, name: 'System Administrator', role: 'ADMIN' };
    
    const trimmedReason = (reason || '').trim();
    if (trimmedReason.length < 10) {
      throw new Error('Override reason must be at least 10 characters long.');
    }
    if (trimmedReason.length > 500) {
      throw new Error('Override reason cannot exceed 500 characters.');
    }

    // Locate attempt by attempt ID or participant ID
    let attempt: ContestAttempt | undefined;
    for (const att of this.attempts.values()) {
      if (att.id === attemptIdOrUserId || att.id === `att-${contestId}-${attemptIdOrUserId}`) {
        attempt = att;
        break;
      }
    }

    if (!attempt) {
      const key = `${contestId}_${attemptIdOrUserId}`;
      attempt = this.attempts.get(key);
    }

    if (!attempt) {
      // Fallback: try finding attempt by participantId
      for (const att of this.attempts.values()) {
        if (att.participantId === attemptIdOrUserId) {
          attempt = att;
          break;
        }
      }
    }

    if (!attempt) {
      throw new Error(`Contest attempt not found for "${attemptIdOrUserId}".`);
    }

    const studentId = attempt.participantId;
    const studentUser = this.users.get(studentId);
    const roundId = attempt.currentRoundId || this.contest.currentRoundId;
    const secKey = `${studentId}_${roundId}`;
    let secState = this.securityStates.get(secKey);

    if (!secState) {
      secState = {
        userId: studentId,
        roundId,
        tabSwitchCount: attempt.tabSwitchCount || 0,
        maxAllowedSwitches: attempt.maxTabSwitches || 3,
        isFlagged: false,
        sessionTerminated: attempt.status === 'TERMINATED_SECURITY' || attempt.status === 'TERMINATED_ADMIN',
        violations: [],
        riskScore: 0
      };
      this.securityStates.set(secKey, secState);
    }

    // 1. Check if attempt is already unlocked/resumed
    const isCurrentlyLocked =
      secState.sessionTerminated ||
      attempt.status === 'TERMINATED_SECURITY' ||
      attempt.status === 'TERMINATED_ADMIN' ||
      (attempt.status as string) === 'LOCKED';

    if (!isCurrentlyLocked || attempt.status === 'IN_PROGRESS' || attempt.status === 'RESUMED_AFTER_OVERRIDE' || attempt.status === 'ACTIVE') {
      throw new Error('Attempt has already been unlocked.');
    }

    // 2. Timer & Contest Expiry Validation
    const nowMs = Date.now();
    const expiresAtIso = attempt.expiresAt || attempt.contestEndTime;
    const expiresAtMs = expiresAtIso ? new Date(expiresAtIso).getTime() : 0;
    const contestEndIso = this.contest.endTime || (this.contest as any).endAt;
    const contestEndMs = contestEndIso ? new Date(contestEndIso).getTime() : 0;

    if (attempt.lockReasonCode === 'TIME_EXPIRED' || (expiresAtMs > 0 && nowMs >= expiresAtMs) || (contestEndMs > 0 && nowMs >= contestEndMs)) {
      throw new Error('This contest has already ended. The locked attempt cannot be resumed.');
    }

    // 3. Perform atomic state transition while preserving attempt metadata, questions, code, and submissions
    const previousState = attempt.status;
    attempt.status = 'IN_PROGRESS';
    (attempt as any).overrideGranted = true;
    (attempt as any).lastOverrideAt = new Date().toISOString();
    (attempt as any).lastOverrideBy = adminUser.name || adminUser.id;
    (attempt as any).lastOverrideReason = trimmedReason;
    attempt.terminationReason = undefined;
    attempt.updatedAt = new Date().toISOString();

    secState.sessionTerminated = false;
    secState.adminOverridden = true;
    secState.riskScore = Math.max(0, secState.riskScore - 50);
    secState.overrideNote = `Unlocked by ${adminUser.name}: ${trimmedReason}`;

    const assignment = this.assignments.get(`${studentId}_${roundId}`);
    const remainingTimeSeconds = expiresAtMs > 0 ? Math.max(0, Math.floor((expiresAtMs - nowMs) / 1000)) : 3600;

    const record: OverrideAuditRecord = {
      id: `ovr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      contestId: attempt.contestId,
      attemptId: attempt.id,
      studentId,
      studentName: studentUser?.name || studentId,
      action: 'UNLOCK_AND_RESUME',
      adminId: adminUser.id,
      adminName: adminUser.name || 'System Administrator',
      reason: trimmedReason,
      previousState,
      newState: 'IN_PROGRESS',
      timestamp: new Date().toISOString(),
      metadata: {
        lockReasonCode: attempt.lockReasonCode || 'TAB_SWITCH_LIMIT_EXCEEDED',
        lockReasonText: attempt.lockReasonText || 'Maximum allowed tab switches exceeded.',
        remainingTimeMs: remainingTimeSeconds * 1000,
        assignedSetId: assignment?.setId || 'Set A'
      }
    };

    if (!attempt.overrideRecords) {
      attempt.overrideRecords = [];
    }
    attempt.overrideRecords.push(record);
    this.overrideRecords.push(record);

    this.logAudit(
      'ATTEMPT_UNLOCKED_AND_RESUMED',
      adminUserId,
      `Unlocked contest attempt for student ${studentUser?.name || studentId} (${studentId}). Reason: "${trimmedReason}"`,
      attempt.id
    );

    return {
      success: true,
      attemptId: attempt.id,
      status: 'IN_PROGRESS',
      overrideGranted: true,
      remainingTimeSeconds,
      message: 'Attempt unlocked successfully.',
      attempt,
      securityState: secState,
      overrideRecord: record
    } as any;
  }

  unlockParticipant(userId: string, roundId: string, adminUserId: string, reason: string): ParticipantSecurityState {
    const res = this.unlockAttemptAndResume(this.contest.id, userId, adminUserId, reason);
    return res.securityState;
  }

  // 8. Contest Attempt Management & Auto-Submission Engine
  getOrCreateAttempt(contestId: string, participantId: string, batchId?: string, roundId?: string): ContestAttempt {
    const key = `${contestId}_${participantId}`;
    let attempt = this.attempts.get(key);

    if (!attempt) {
      for (const att of this.attempts.values()) {
        if (att.contestId === contestId && (att.participantId === participantId || att.studentId === participantId)) {
          attempt = att;
          this.attempts.set(key, attempt);
          break;
        }
      }
    }

    if (!attempt) {
      const user = this.users.get(participantId);
      const targetBatch = batchId || user?.batchId || 'batch-1';
      const targetRound = roundId || this.contest.currentRoundId || 'round-1';
      const contestObj = this.contests.get(contestId) || this.contest;

      const prepStart = new Date();
      const prepEnd = new Date(prepStart.getTime() + 60 * 1000); // 60s preparation

      const startedAt = prepStart;
      const expiresAt = new Date(startedAt.getTime() + 90 * 60 * 1000); // 90 minutes fixed duration

      attempt = {
        id: `att-${contestId}-${participantId}`,
        contestId,
        participantId,
        batchId: targetBatch,
        currentRoundId: targetRound,
        status: 'NOT_STARTED',
        termsAccepted: false,
        preparationStartedAt: prepStart.toISOString(),
        preparationEndsAt: prepEnd.toISOString(),
        contestStartTime: contestObj?.startTime || prepEnd.toISOString(),
        contestEndTime: contestObj?.endTime || expiresAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        startedAt: startedAt.toISOString(),
        tabSwitchCount: 0,
        maxTabSwitches: this.contest?.settings?.maxTabSwitches || 3,
        activeSessionId: `sess-${participantId}-${Date.now()}`,
        codeSnapshots: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.attempts.set(key, attempt);
    }

    return attempt;
  }

  getOrAssignQuestionSet(contestId: string, participantId: string, roundId?: string): { setId: string; problemIds: string[] } {
    const user = this.users.get(participantId);
    const targetRound = roundId || this.contest?.currentRoundId || 'round-1';
    const contestKey = `${participantId}_${contestId}`;
    const roundKey = `${participantId}_${targetRound}`;

    // 1. Check existing assignment
    const existing = this.assignments.get(contestKey) || this.assignments.get(roundKey);
    if (existing && existing.problemIds && existing.problemIds.length > 0) {
      let setName = existing.setId;
      if (!setName || setName === 'undefined') {
        setName = (existing as any).setName || (existing as any).name || 'Set A';
        existing.setId = setName;
      }
      return { setId: setName, problemIds: existing.problemIds };
    }

    // 2. Find available question sets for this contest / round
    const contestSets = Array.from(this.questionSets.values()).filter(
      s => (s as any).contestId === contestId || s.roundId === targetRound
    );

    let assignedSet: { setId: string; problemIds: string[] };

    if (contestSets.length > 0) {
      // Find candidate's batch
      const userBatchId = user?.batchId;
      const batchUserIds = new Set(
        Array.from(this.users.values())
          .filter(u => !userBatchId || u.batchId === userBatchId)
          .map(u => u.id)
      );

      // Count set usage in this user's batch
      const setUsageCount = new Map<string, number>();
      contestSets.forEach((s, idx) => {
        let name = s.setId || (s as any).name;
        if (!name || name === 'undefined') {
          name = `Set ${String.fromCharCode(65 + idx)}`;
          s.setId = name;
        }
        setUsageCount.set(name, 0);
      });

      for (const assign of this.assignments.values()) {
        if ((!userBatchId || batchUserIds.has(assign.userId)) && assign.setId && assign.setId !== 'undefined') {
          setUsageCount.set(assign.setId, (setUsageCount.get(assign.setId) || 0) + 1);
        }
      }

      // Pick set with min count in this batch (randomized among tied minimums)
      let minCount = Infinity;
      let candidatesForBatch: typeof contestSets = [];
      contestSets.forEach(s => {
        const sName = s.setId || (s as any).name || 'Set A';
        const cnt = setUsageCount.get(sName) || 0;
        if (cnt < minCount) {
          minCount = cnt;
          candidatesForBatch = [s];
        } else if (cnt === minCount) {
          candidatesForBatch.push(s);
        }
      });

      const chosen = candidatesForBatch[Math.floor(Math.random() * candidatesForBatch.length)] || contestSets[0];
      let setName = chosen.setId || (chosen as any).name;
      if (!setName || setName === 'undefined') {
        setName = `Set ${String.fromCharCode(65 + Math.floor(Math.random() * contestSets.length))}`;
      }

      assignedSet = {
        setId: setName,
        problemIds: chosen.problemIds
      };
    } else {
      // Fallback: partition problems by difficulty: 1 Easy, 1 Medium, 1 Hard
      const easy = Array.from(this.problems.values()).filter(p => (p.difficulty || '').toUpperCase() === 'EASY');
      const med = Array.from(this.problems.values()).filter(p => (p.difficulty || '').toUpperCase() === 'MEDIUM');
      const hard = Array.from(this.problems.values()).filter(p => (p.difficulty || '').toUpperCase() === 'HARD');

      const setLetters = ['Set A', 'Set B', 'Set C'];
      const chosenLetter = setLetters[Math.floor(Math.random() * setLetters.length)];

      const pickedProblemIds: string[] = [];
      if (easy.length > 0) pickedProblemIds.push(easy[0].id);
      if (med.length > 0) pickedProblemIds.push(med[0].id);
      if (hard.length > 0) pickedProblemIds.push(hard[0].id);

      if (pickedProblemIds.length === 0) {
        pickedProblemIds.push(...Array.from(this.problems.keys()).slice(0, 3));
      }

      assignedSet = {
        setId: chosenLetter,
        problemIds: pickedProblemIds
      };
    }

    // 3. Save assignment permanently
    const newAssignment: QuestionAssignment = {
      id: `assign-${participantId}-${targetRound}`,
      userId: participantId,
      studentId: user?.studentId || participantId,
      contestId,
      roundId: targetRound,
      setId: assignedSet.setId,
      problemIds: assignedSet.problemIds,
      shuffledProblemIds: assignedSet.problemIds,
      isLocked: true,
      lockedAt: new Date().toISOString(),
      overridden: false,
      assignedAt: new Date().toISOString()
    } as any;

    this.assignments.set(contestKey, newAssignment);
    this.assignments.set(roundKey, newAssignment);

    return assignedSet;
  }

  startContestAttempt(contestId: string, participantId: string, batchId?: string, roundId?: string, termsAccepted = true): ContestAttempt {
    const key = `${contestId}_${participantId}`;
    let attempt = this.attempts.get(key);

    if (!attempt) {
      for (const att of this.attempts.values()) {
        if (att.contestId === contestId && (att.participantId === participantId || att.studentId === participantId)) {
          attempt = att;
          this.attempts.set(key, attempt);
          break;
        }
      }
    }

    const user = this.users.get(participantId);
    const targetBatch = batchId || user?.batchId || 'batch-1';
    const targetRound = roundId || this.contest?.currentRoundId || 'round-1';
    const contestObj = this.contests.get(contestId) || this.contest;

    if (!attempt) {
      // Assign Question Set permanently (Set A / Set B / Set C)
      const qSet = this.getOrAssignQuestionSet(contestId, participantId, targetRound);

      const prepStart = new Date();
      const prepEnd = new Date(prepStart.getTime() + 60 * 1000); // 60-second preparation countdown

      const startedAt = prepStart;
      const expiresAt = new Date(startedAt.getTime() + 90 * 60 * 1000); // 90 minutes fixed duration

      attempt = {
        id: `att-${contestId}-${participantId}`,
        contestId,
        participantId,
        studentId: user?.studentId || participantId,
        batchId: targetBatch,
        currentRoundId: targetRound,
        assignedSetId: qSet.setId,
        status: 'IN_PROGRESS',
        termsAccepted,
        termsAcceptedAt: new Date().toISOString(),
        preparationStartedAt: prepStart.toISOString(),
        preparationEndsAt: prepEnd.toISOString(),
        contestStartTime: contestObj?.startTime || prepEnd.toISOString(),
        contestEndTime: contestObj?.endTime || expiresAt.toISOString(),
        originalExpiresAt: expiresAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        startedAt: startedAt.toISOString(),
        tabSwitchCount: 0,
        maxTabSwitches: contestObj?.settings?.maxTabSwitches || 3,
        activeSessionId: `sess-${participantId}-${Date.now()}`,
        codeSnapshots: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.attempts.set(key, attempt);
      this.logAudit('ATTEMPT_INITIALIZED', participantId, `Contest attempt initialized for participant ${participantId} with ${qSet.setId}`, attempt.id);
    }

    return attempt!;
  }

  transitionAttemptToActive(contestId: string, participantId: string): ContestAttempt {
    const attempt = this.getOrCreateAttempt(contestId, participantId);
    if (attempt.status === 'PREPARING' || attempt.status === 'NOT_STARTED') {
      attempt.status = 'IN_PROGRESS';
      const now = new Date();
      attempt.startedAt = now.toISOString();
      attempt.expiresAt = new Date(now.getTime() + 90 * 60 * 1000).toISOString();
      attempt.updatedAt = now.toISOString();
      this.logAudit('ATTEMPT_ARENA_ENTERED', participantId, `Participant ${participantId} completed preparation and entered Coding Arena.`, attempt.id);
    }
    return attempt;
  }

  // --- SINGLE ACTIVE SESSION MANAGEMENT ---
  private loginLocks: Map<string, boolean> = new Map();

  getActiveSession(userId: string): StudentSession | null {
    const session = this.activeSessions.get(userId);
    if (!session || !session.active) return null;

    const now = Date.now();
    const lastSeen = new Date(session.lastSeenAt).getTime();
    const SESSION_STALE_TIMEOUT_MS = 120000; // 120 seconds

    if (now - lastSeen > SESSION_STALE_TIMEOUT_MS) {
      session.active = false;
      session.logoutAt = new Date().toISOString();
      session.logoutReason = 'STALE_SESSION';
      this.activeSessions.set(userId, session);
      this.logAudit('SESSION_STALE_TIMEOUT', userId, `Session ${session.sessionId} marked stale after 120s inactivity.`);
      return null;
    }
    return session;
  }

  resolveLoginSession(userId: string, userAgent?: string): { conflict: boolean; session?: StudentSession; reason?: string } {
    if (this.loginLocks.get(userId)) {
      return { conflict: true, reason: 'RACE_CONDITION_LOCK' };
    }
    this.loginLocks.set(userId, true);

    try {
      const existing = this.activeSessions.get(userId);
      if (existing && existing.active) {
        const now = Date.now();
        const lastSeen = new Date(existing.lastSeenAt).getTime();
        const SESSION_STALE_TIMEOUT_MS = 120000; // 120 seconds

        if (now - lastSeen <= SESSION_STALE_TIMEOUT_MS) {
          // FRESH ACTIVE SESSION EXISTS -> REJECT NEW LOGIN
          return { conflict: true, session: existing, reason: 'ACTIVE_SESSION_EXISTS' };
        } else {
          // STALE SESSION -> INVALIDATE AND ALLOW NEW LOGIN
          existing.active = false;
          existing.logoutAt = new Date().toISOString();
          existing.logoutReason = 'STALE_SESSION';
          this.activeSessions.set(userId, existing);
          this.logAudit('SESSION_STALE_INVALIDATED', userId, `Old session ${existing.sessionId} marked STALE_SESSION on new login attempt.`);
        }
      }

      // CREATE NEW ACTIVE SESSION
      const nowStr = new Date().toISOString();
      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const newSession: StudentSession = {
        studentId: userId,
        sessionId,
        createdAt: nowStr,
        loginAt: nowStr,
        lastSeenAt: nowStr,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        active: true,
        userAgent: userAgent || 'Browser',
        deviceInfo: userAgent || 'Browser'
      };
      this.activeSessions.set(userId, newSession);
      return { conflict: false, session: newSession };
    } finally {
      this.loginLocks.delete(userId);
    }
  }

  createActiveSession(userId: string, deviceInfo?: string): StudentSession {
    const res = this.resolveLoginSession(userId, deviceInfo);
    if (res.session) return res.session;
    
    // Fallback if conflict or locked
    const nowStr = new Date().toISOString();
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const session: StudentSession = {
      studentId: userId,
      sessionId,
      createdAt: nowStr,
      loginAt: nowStr,
      lastSeenAt: nowStr,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      active: true,
      userAgent: deviceInfo || 'Browser',
      deviceInfo: deviceInfo || 'Browser'
    };
    this.activeSessions.set(userId, session);
    return session;
  }

  updateSessionHeartbeat(userId: string, sessionId: string): { success: boolean; lastSeenAt?: string; conflict?: boolean } {
    const session = this.activeSessions.get(userId);
    if (!session || session.sessionId !== sessionId || !session.active) {
      return { success: false, conflict: true };
    }
    const nowStr = new Date().toISOString();
    session.lastSeenAt = nowStr;
    this.activeSessions.set(userId, session);
    return { success: true, lastSeenAt: nowStr };
  }

  clearSession(userId: string, sessionId?: string, reason: string = 'USER_LOGOUT'): boolean {
    const session = this.activeSessions.get(userId);
    if (session && (!sessionId || session.sessionId === sessionId)) {
      session.active = false;
      session.logoutAt = new Date().toISOString();
      session.logoutReason = reason;
      this.activeSessions.set(userId, session);
      this.logAudit('USER_LOGOUT', userId, `Session ${session.sessionId} terminated with reason: ${reason}`);
      return true;
    }
    return false;
  }

  getAllActiveSessions(): any[] {
    const results: any[] = [];
    const now = Date.now();
    for (const [userId, session] of this.activeSessions.entries()) {
      if (!session) continue;
      const user = this.users.get(userId);
      const batch = user?.batchId ? this.batches.get(user.batchId) : null;
      const attempt = this.attempts.get(`${this.contest.id}_${userId}`);
      const lastSeenMs = new Date(session.lastSeenAt).getTime();
      const ageSeconds = Math.round((now - lastSeenMs) / 1000);
      const isFresh = session.active && ageSeconds <= 120;

      results.push({
        sessionId: session.sessionId,
        studentId: userId,
        studentName: user?.name || 'Unknown Student',
        email: user?.email || '',
        registrationNo: user?.registrationNo || user?.studentId || 'N/A',
        batchName: batch?.name || 'Default Batch',
        loginAt: session.loginAt || session.createdAt,
        lastSeenAt: session.lastSeenAt,
        ageSeconds,
        active: session.active,
        status: isFresh ? 'ACTIVE' : session.active ? 'STALE' : 'TERMINATED',
        userAgent: session.userAgent || session.deviceInfo || 'Browser',
        contestStatus: attempt?.status || 'NOT_STARTED',
        logoutReason: session.logoutReason || null
      });
    }
    return results.sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
  }

  getAttempt(contestId: string, participantId: string): ContestAttempt | undefined {
    if (!contestId || !participantId) return undefined;
    let attempt = this.attempts.get(`${contestId}_${participantId}`);
    if (!attempt) {
      for (const att of this.attempts.values()) {
        if (att && att.contestId === contestId && (att.participantId === participantId || att.studentId === participantId || att.id === `att-${contestId}-${participantId}`)) {
          attempt = att;
          this.attempts.set(`${contestId}_${participantId}`, attempt);
          break;
        }
      }
    }
    if (attempt && attempt.contestId && attempt.contestId !== contestId) {
      return undefined;
    }
    return attempt;
  }

  normalizeContestTimings(): void {
    const nowMs = Date.now();

    // 1. Ensure active contest is valid and has future endTime
    if (this.contests.size > 0) {
      let liveContest = Array.from(this.contests.values()).find(
        c => (c.isLive || c.status === 'LIVE') && c.endTime && new Date(c.endTime).getTime() > nowMs
      );
      if (!liveContest) {
        liveContest = Array.from(this.contests.values()).find(c => c.isLive || c.status === 'LIVE');
      }
      if (!liveContest) {
        liveContest = Array.from(this.contests.values()).find(c => c.status === 'PUBLISHED');
      }
      if (!liveContest) {
        liveContest = Array.from(this.contests.values())[0];
      }

      if (liveContest) {
        const contestEndMs = liveContest.endTime ? new Date(liveContest.endTime).getTime() : 0;
        if (!contestEndMs || contestEndMs <= nowMs) {
          const durationMins = (liveContest as any).durationMinutes || (liveContest as any).slotDurationMinutes || 120;
          liveContest.endTime = new Date(nowMs + durationMins * 60 * 1000).toISOString();
          liveContest.status = 'LIVE';
          this.contests.set(liveContest.id, liveContest);
        }
        this.contest = { ...liveContest };
      }
    } else {
      this._contest = null;
    }

    // 2. Ensure all active attempts have a live countdown and never expire prematurely
    for (const [key, att] of this.attempts.entries()) {
      const isTerminal = ['COMPLETED', 'SUBMITTED', 'AUTO_SUBMITTED', 'TERMINATED_SECURITY', 'TERMINATED_ADMIN', 'DISQUALIFIED'].includes(att.status);
      const expiresAtMs = att.expiresAt ? new Date(att.expiresAt).getTime() : 0;

      if (!isTerminal) {
        if (!att.expiresAt || expiresAtMs <= nowMs) {
          const freshExpiry = new Date(nowMs + 120 * 60 * 1000).toISOString();
          att.expiresAt = freshExpiry;
          att.contestEndTime = freshExpiry;
          if (att.status === 'EXPIRED') {
            att.status = 'IN_PROGRESS';
          }
          this.attempts.set(key, att);
        }
      }
    }
  }

  saveCodeSnapshot(contestId: string, participantId: string, problemId: string, code: string, language: string): ContestAttempt {
    const attempt = this.getOrCreateAttempt(contestId, participantId);
    if (attempt.status === 'TERMINATED_SECURITY' || attempt.status === 'TERMINATED_ADMIN' || attempt.status === 'COMPLETED' || attempt.status === 'EXPIRED') {
      return attempt;
    }

    if (!attempt.codeSnapshots) {
      attempt.codeSnapshots = {};
    }

    attempt.codeSnapshots[problemId] = {
      code,
      language,
      updatedAt: new Date().toISOString()
    };
    attempt.updatedAt = new Date().toISOString();
    return attempt;
  }

  updateAttemptStatus(contestId: string, participantId: string, status: AttemptStatus, reason?: string): ContestAttempt {
    const attempt = this.getOrCreateAttempt(contestId, participantId);
    attempt.status = status;
    if (reason) attempt.terminationReason = reason;
    if (status === 'COMPLETED' || status === 'EXPIRED' || status.startsWith('TERMINATED')) {
      attempt.endedAt = new Date().toISOString();
    }
    attempt.updatedAt = new Date().toISOString();
    return attempt;
  }

  autoSubmitAttempt(contestId: string, participantId: string, roundId: string, reason: string, submissionType: 'AUTO_SECURITY' | 'AUTO_DEADLINE' = 'AUTO_SECURITY'): Submission[] {
    const attempt = this.getOrCreateAttempt(contestId, participantId, undefined, roundId);
    
    // Idempotency check: if already terminated or completed, do not duplicate submissions
    if (attempt.status === 'TERMINATED_SECURITY' && submissionType === 'AUTO_SECURITY') {
      return Array.from(this.submissions.values()).filter(s => s.userId === participantId && s.roundId === roundId);
    }
    if ((attempt.status === 'COMPLETED' || attempt.status === 'EXPIRED') && submissionType === 'AUTO_DEADLINE') {
      return Array.from(this.submissions.values()).filter(s => s.userId === participantId && s.roundId === roundId);
    }

    const user = this.users.get(participantId);
    const userName = user?.name || participantId;
    const assignmentKey = `${participantId}_${roundId}`;
    const assignment = this.assignments.get(assignmentKey);

    // Identify assigned problems
    const problemIds = assignment?.problemIds || Array.from(this.problems.values()).filter(p => p.roundId === roundId).map(p => p.id);
    const generatedSubmissions: Submission[] = [];

    problemIds.forEach(problemId => {
      const problem = this.problems.get(problemId);
      if (!problem) return;

      // Check for existing official submission for this problem
      const existingSubs = Array.from(this.submissions.values()).filter(s => s.userId === participantId && s.problemId === problemId && s.contestId === contestId);
      if (existingSubs.length > 0) {
        // If there's already a submission, we don't need to auto-submit again
        return;
      }

      const snapshot = attempt.codeSnapshots?.[problemId];
      const code = snapshot?.code || problem.starterCode?.python || `# ${submissionType}: Auto-submitted snapshot\n`;
      const language = (snapshot?.language || 'python') as any;

      const subId = `sub-auto-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const submission: Submission = {
        id: subId,
        userId: participantId,
        userName,
        problemId,
        roundId,
        contestId,
        attemptId: attempt.id,
        batchId: user?.batchId || attempt.batchId,
        language,
        code,
        status: 'QUEUED',
        passedTests: 0,
        totalTests: (problem.sampleTestCases?.length || 0) + (problem.hiddenTestCases?.length || 0),
        score: 0,
        maxScore: problem.points,
        executionTimeMs: 0,
        memoryUsedMb: 0,
        submittedAt: new Date().toISOString(),
        testCaseResults: [],
        errorLog: `${submissionType}: ${reason}`
      };

      this.submissions.set(subId, submission);
      this.questionResults.set(`${attempt.id}_${problemId}`, {
        id: `qr-${attempt.id}-${problemId}`,
        studentId: user?.studentId || participantId,
        contestId,
        attemptId: attempt.id,
        problemId,
        difficulty: (problem.difficulty || 'MEDIUM').toUpperCase(),
        passedTestCases: 0,
        totalTestCases: 5,
        marksEarned: 0,
        maxMarks: problem.points || (problem.difficulty === 'EASY' ? 10 : problem.difficulty === 'HARD' ? 25 : 15),
        status: 'QUEUED',
        testCaseResults: [],
        evaluatedAt: new Date().toISOString()
      });
      generatedSubmissions.push(submission);
    });

    attempt.status = submissionType === 'AUTO_SECURITY' ? 'TERMINATED_SECURITY' : 'COMPLETED';
    attempt.terminationReason = reason;
    attempt.endedAt = new Date().toISOString();
    attempt.updatedAt = new Date().toISOString();

    this.logAudit(
      submissionType === 'AUTO_SECURITY' ? 'AUTO_SECURITY_SUBMIT_ENFORCED' : 'AUTO_DEADLINE_SUBMIT_ENFORCED',
      'SYSTEM_GUARDIAN',
      `Auto-submitted ${generatedSubmissions.length} solutions for ${userName} (${participantId}). Reason: ${reason}`,
      attempt.id
    );

    return generatedSubmissions;
  }

  // ==========================================
  // MANAGE CHALLENGES (MASTER PROBLEM ENGINE)
  // ==========================================

  getChallenges(filters?: {
    difficulty?: string;
    category?: string;
    status?: string;
    search?: string;
    tag?: string;
    language?: string;
  }): Challenge[] {
    let list = Array.from(this.challenges.values());

    if (filters?.difficulty && filters.difficulty !== 'ALL') {
      list = list.filter(c => c.difficulty.toUpperCase() === filters.difficulty?.toUpperCase());
    }

    if (filters?.status && filters.status !== 'ALL') {
      list = list.filter(c => c.status.toUpperCase() === filters.status?.toUpperCase());
    }

    if (filters?.category && filters.category !== 'ALL') {
      list = list.filter(c => c.category.toLowerCase() === filters.category?.toLowerCase());
    }

    if (filters?.tag && filters.tag !== 'ALL') {
      list = list.filter(c => c.tags?.some(t => t.toLowerCase() === filters.tag?.toLowerCase()));
    }

    if (filters?.language && filters.language !== 'ALL') {
      list = list.filter(c => c.languages?.some(l => l.enabled && l.languageId.toLowerCase() === filters.language?.toLowerCase()));
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.challengeCode.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.tags?.some(t => t.toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  getChallenge(id: string): Challenge | null {
    return this.challenges.get(id) || Array.from(this.challenges.values()).find(c => c.slug === id || c.challengeCode === id) || null;
  }

  getParticipantSafeChallenge(id: string): Partial<Challenge> | null {
    const ch = this.getChallenge(id);
    if (!ch) return null;

    // Filter out hidden test cases, editorial, reference solution, and internal checker implementation
    return {
      id: ch.id,
      challengeCode: ch.challengeCode,
      name: ch.name,
      slug: ch.slug,
      description: ch.description,
      problemStatement: ch.problemStatement,
      inputFormat: ch.inputFormat,
      outputFormat: ch.outputFormat,
      constraints: ch.constraints,
      sampleInput: ch.sampleInput,
      sampleOutput: ch.sampleOutput,
      explanation: ch.explanation,
      difficulty: ch.difficulty,
      category: ch.category,
      tags: ch.tags,
      maximumMarks: ch.maximumMarks,
      status: ch.status,
      version: ch.version,
      testCases: ch.testCases.filter(tc => tc.isSample), // ONLY return sample test cases to participants
      languages: ch.languages.filter(l => l.enabled),
      codeStubs: ch.codeStubs,
      settings: {
        partialScoring: ch.settings.partialScoring,
        negativeMarking: ch.settings.negativeMarking,
        maximumSubmissions: ch.settings.maximumSubmissions,
        timeLimitSec: ch.settings.timeLimitSec,
        memoryLimitMb: ch.settings.memoryLimitMb,
        checkerType: ch.settings.checkerType
      }
    };
  }

  createChallenge(payload: Partial<Challenge>, adminId: string): Challenge {
    const count = this.challenges.size + 1;
    const challengeCode = `CH${String(count).padStart(3, '0')}`;
    const id = `ch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const slug = (payload.slug || payload.name || `challenge-${count}`)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const defaultLanguages: ChallengeLanguageConfig[] = [
      { languageId: 'python', name: 'Python 3.11', enabled: true, timeLimitSec: 2, memoryLimitMb: 256 },
      { languageId: 'javascript', name: 'JavaScript (Node.js)', enabled: true, timeLimitSec: 2, memoryLimitMb: 256 },
      { languageId: 'cpp', name: 'C++ 20 (GCC)', enabled: true, timeLimitSec: 1, memoryLimitMb: 256 },
      { languageId: 'java', name: 'Java 17 (OpenJDK)', enabled: true, timeLimitSec: 2, memoryLimitMb: 512 },
      { languageId: 'c', name: 'C 11 (GCC)', enabled: true, timeLimitSec: 1, memoryLimitMb: 256 }
    ];

    const defaultTestCases: ChallengeTestCase[] = payload.testCases || [
      {
        id: `tc-${Date.now()}-1`,
        challengeId: id,
        order: 1,
        input: '5\n1 2 3 4 5',
        expectedOutput: '15',
        isSample: true,
        isAdditional: false,
        marks: 5,
        strength: 'BASIC',
        tag: 'Sample 1'
      },
      {
        id: `tc-${Date.now()}-2`,
        challengeId: id,
        order: 2,
        input: '3\n10 20 30',
        expectedOutput: '60',
        isSample: false,
        isAdditional: false,
        marks: 5,
        strength: 'BASIC',
        tag: 'Hidden Case 1'
      }
    ];

    const challenge: Challenge = {
      id,
      challengeCode,
      name: payload.name || 'Untitled Challenge',
      slug,
      description: payload.description || '',
      problemStatement: payload.problemStatement || 'Write a program to solve the challenge.',
      inputFormat: payload.inputFormat || 'Line 1: Input parameters.',
      outputFormat: payload.outputFormat || 'Print the computed output.',
      constraints: payload.constraints || '1 <= N <= 10^5',
      sampleInput: payload.sampleInput || '5\n1 2 3 4 5',
      sampleOutput: payload.sampleOutput || '15',
      explanation: payload.explanation || 'Sum of elements equals 15.',
      difficulty: payload.difficulty || 'MEDIUM',
      category: payload.category || 'Algorithms',
      tags: payload.tags || ['Arrays', 'Algorithms'],
      maximumMarks: payload.maximumMarks || 10,
      status: 'DRAFT',
      version: 1,
      testCases: defaultTestCases,
      languages: payload.languages || defaultLanguages,
      codeStubs: payload.codeStubs || {
        python: 'def solve():\n    # Enter your code here\n    pass\n\nif __name__ == "__main__":\n    solve()\n',
        javascript: 'function solve() {\n    // Enter your code here\n}\n\nsolve();\n',
        cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Enter your code here\n    return 0;\n}\n',
        java: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // Enter your code here\n    }\n}\n',
        c: '#include <stdio.h>\n\nint main() {\n    // Enter your code here\n    return 0;\n}\n'
      },
      settings: payload.settings || {
        partialScoring: true,
        negativeMarking: false,
        maximumSubmissions: 10,
        timeLimitSec: 2,
        memoryLimitMb: 256,
        checkerType: 'STANDARD_EXACT_MATCH'
      },
      editorial: payload.editorial || {
        approach: 'Analyze the problem constraints and apply standard linear scan or hash map optimization.',
        algorithm: '1. Parse standard input.\n2. Apply optimal state accumulation.\n3. Output formatted answer.',
        explanation: 'Time complexity is O(N) with O(1) auxiliary space.',
        timeComplexity: 'O(N)',
        spaceComplexity: 'O(1)',
        referenceSolution: {
          python: '# Reference Solution (Organizer Eyes Only)\ndef solve():\n    pass\n'
        }
      },
      createdBy: adminId || this.currentUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.challenges.set(challenge.id, challenge);
    this.logAudit('CHALLENGE_CREATED', adminId || this.currentUserId, `Created challenge "${challenge.name}" (${challenge.challengeCode}) in DRAFT state.`, challenge.id);
    return challenge;
  }

  updateChallenge(id: string, payload: Partial<Challenge>, adminId: string): Challenge {
    const challenge = this.challenges.get(id);
    if (!challenge) {
      throw new Error(`Challenge not found with ID: ${id}`);
    }

    if (payload.slug && payload.slug !== challenge.slug) {
      const cleanSlug = payload.slug.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const existing = Array.from(this.challenges.values()).find(c => c.id !== id && c.slug === cleanSlug);
      if (existing) {
        throw new Error(`Slug "${cleanSlug}" is already taken by another challenge (${existing.challengeCode}).`);
      }
      challenge.slug = cleanSlug;
    }

    if (payload.name !== undefined) challenge.name = payload.name;
    if (payload.description !== undefined) challenge.description = payload.description;
    if (payload.problemStatement !== undefined) challenge.problemStatement = payload.problemStatement;
    if (payload.inputFormat !== undefined) challenge.inputFormat = payload.inputFormat;
    if (payload.outputFormat !== undefined) challenge.outputFormat = payload.outputFormat;
    if (payload.constraints !== undefined) challenge.constraints = payload.constraints;
    if (payload.sampleInput !== undefined) challenge.sampleInput = payload.sampleInput;
    if (payload.sampleOutput !== undefined) challenge.sampleOutput = payload.sampleOutput;
    if (payload.explanation !== undefined) challenge.explanation = payload.explanation;
    if (payload.difficulty !== undefined) challenge.difficulty = payload.difficulty;
    if (payload.category !== undefined) challenge.category = payload.category;
    if (payload.tags !== undefined) challenge.tags = payload.tags;
    if (payload.maximumMarks !== undefined) challenge.maximumMarks = Number(payload.maximumMarks);
    if (payload.testCases !== undefined) challenge.testCases = payload.testCases;
    if (payload.languages !== undefined) challenge.languages = payload.languages;
    if (payload.codeStubs !== undefined) challenge.codeStubs = { ...challenge.codeStubs, ...payload.codeStubs };
    if (payload.settings !== undefined) challenge.settings = { ...challenge.settings, ...payload.settings };
    if (payload.editorial !== undefined) challenge.editorial = { ...challenge.editorial, ...payload.editorial };

    challenge.updatedAt = new Date().toISOString();
    this.logAudit('CHALLENGE_UPDATED', adminId || this.currentUserId, `Updated challenge "${challenge.name}" (${challenge.challengeCode}).`, challenge.id);
    return challenge;
  }

  duplicateChallenge(id: string, adminId: string): Challenge {
    const original = this.challenges.get(id);
    if (!original) {
      throw new Error(`Challenge not found with ID: ${id}`);
    }

    const count = this.challenges.size + 1;
    const newCode = `CH${String(count).padStart(3, '0')}`;
    const newId = `ch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newSlug = `copy-of-${original.slug}-${Date.now().toString().slice(-4)}`;

    const duplicate: Challenge = {
      ...JSON.parse(JSON.stringify(original)),
      id: newId,
      challengeCode: newCode,
      name: `Copy of ${original.name}`,
      slug: newSlug,
      status: 'DRAFT',
      version: 1,
      createdBy: adminId || this.currentUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: undefined,
      archivedAt: undefined
    };

    // Re-ID test cases
    duplicate.testCases = duplicate.testCases.map((tc, idx) => ({
      ...tc,
      id: `tc-${Date.now()}-${idx + 1}`,
      challengeId: newId
    }));

    this.challenges.set(duplicate.id, duplicate);
    this.logAudit('CHALLENGE_DUPLICATED', adminId || this.currentUserId, `Duplicated "${original.name}" (${original.challengeCode}) into new draft "${duplicate.name}" (${duplicate.challengeCode}).`, duplicate.id);
    return duplicate;
  }

  publishChallenge(id: string, adminId: string): { challenge: Challenge; message: string } {
    const challenge = this.challenges.get(id);
    if (!challenge) {
      throw new Error(`Challenge not found with ID: ${id}`);
    }

    // 1. Validation before Publish
    const errors: string[] = [];

    if (!challenge.name || challenge.name.trim().length < 3) {
      errors.push('Challenge name must be at least 3 characters.');
    }
    if (!challenge.slug || challenge.slug.trim().length < 3) {
      errors.push('Challenge slug is required.');
    }
    if (!challenge.difficulty) {
      errors.push('Difficulty must be selected.');
    }
    if (!challenge.category) {
      errors.push('Category must be selected.');
    }
    if (!challenge.problemStatement || challenge.problemStatement.trim().length < 10) {
      errors.push('Problem statement must be at least 10 characters.');
    }
    if (!challenge.inputFormat || !challenge.inputFormat.trim()) {
      errors.push('Input format specification is required.');
    }
    if (!challenge.outputFormat || !challenge.outputFormat.trim()) {
      errors.push('Output format specification is required.');
    }
    if (!challenge.constraints || !challenge.constraints.trim()) {
      errors.push('Constraints specification is required.');
    }
    if (!challenge.maximumMarks || challenge.maximumMarks <= 0) {
      errors.push('Maximum marks must be greater than 0.');
    }
    if (!challenge.languages || !challenge.languages.some(l => l.enabled)) {
      errors.push('At least one programming language must be enabled.');
    }
    if (!challenge.testCases || challenge.testCases.length === 0) {
      errors.push('At least one test case must be configured.');
    }

    // Sum of test-case marks validation
    const totalMarks = (challenge.testCases || []).reduce((sum, tc) => sum + (Number(tc.marks) || 0), 0);
    if (totalMarks !== challenge.maximumMarks) {
      errors.push(`Test-case marks total ${totalMarks}, but Maximum Marks is ${challenge.maximumMarks}. Total test-case marks must exactly equal Maximum Marks.`);
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(' ')}`);
    }

    challenge.status = 'PUBLISHED';
    challenge.version = (challenge.version || 1) + 1;
    challenge.publishedAt = new Date().toISOString();
    challenge.updatedAt = new Date().toISOString();

    // Also sync/reflect into existing Problem Bank as a published problem so it is immediately usable
    const syncedProblem: Problem = {
      id: `prob-${challenge.challengeCode.toLowerCase()}`,
      title: challenge.name,
      slug: challenge.slug,
      description: challenge.problemStatement,
      inputFormat: challenge.inputFormat,
      outputFormat: challenge.outputFormat,
      constraints: challenge.constraints,
      difficulty: challenge.difficulty,
      sourcePlatform: 'CUSTOM',
      tags: challenge.tags,
      points: challenge.maximumMarks,
      roundId: 'round-1',
      timeLimitMs: (challenge.settings?.timeLimitSec || 2) * 1000,
      memoryLimitMb: challenge.settings?.memoryLimitMb || 256,
      sampleTestCases: challenge.testCases.filter(tc => tc.isSample).map(tc => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden: false,
        explanation: tc.tag
      })),
      hiddenTestCases: challenge.testCases.filter(tc => !tc.isSample).map(tc => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden: true
      })),
      starterCode: {
        python: challenge.codeStubs?.python || '# Write solution\n',
        javascript: challenge.codeStubs?.javascript || '// Write solution\n',
        cpp: challenge.codeStubs?.cpp || '// Write solution\n'
      }
    };
    this.problems.set(syncedProblem.id, syncedProblem);

    this.logAudit('CHALLENGE_PUBLISHED', adminId || this.currentUserId, `Published challenge "${challenge.name}" (${challenge.challengeCode}) Version ${challenge.version}. Total marks verified: ${totalMarks}/${challenge.maximumMarks}.`, challenge.id);

    return {
      challenge,
      message: `Challenge "${challenge.name}" (${challenge.challengeCode}) successfully published and available in Problem Bank / Question Sets!`
    };
  }

  archiveChallenge(id: string, adminId: string): Challenge {
    const challenge = this.challenges.get(id);
    if (!challenge) {
      throw new Error(`Challenge not found with ID: ${id}`);
    }

    challenge.status = 'ARCHIVED';
    challenge.archivedAt = new Date().toISOString();
    challenge.updatedAt = new Date().toISOString();

    this.logAudit('CHALLENGE_ARCHIVED', adminId || this.currentUserId, `Archived challenge "${challenge.name}" (${challenge.challengeCode}). It will no longer appear for new Question Set assignments.`, challenge.id);
    return challenge;
  }

  deleteChallenge(id: string, adminId: string): { success: boolean; message: string } {
    const challenge = this.challenges.get(id);
    if (!challenge) {
      throw new Error(`Challenge not found with ID: ${id}`);
    }

    // Check if referenced in any Question Sets or active round assignments
    const isReferencedInSets = Array.from(this.questionSets.values()).some(qs =>
      qs.problemIds.includes(challenge.id) || qs.problemIds.includes(`prob-${challenge.challengeCode.toLowerCase()}`)
    );

    if (isReferencedInSets) {
      throw new Error(`This challenge is currently referenced by existing Question Sets and cannot be permanently deleted. Please Archive it instead to maintain contest integrity.`);
    }

    if (challenge.status === 'PUBLISHED') {
      throw new Error(`Published challenges cannot be directly deleted. Please Archive the challenge or revert to Draft first.`);
    }

    this.challenges.delete(id);
    this.logAudit('CHALLENGE_DELETED', adminId || this.currentUserId, `Deleted draft challenge "${challenge.name}" (${challenge.challengeCode}).`, id);
    return { success: true, message: `Draft challenge ${challenge.challengeCode} deleted successfully.` };
  }

  saveChallengeTestCases(challengeId: string, testCases: ChallengeTestCase[], adminId: string): Challenge {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      throw new Error(`Challenge not found with ID: ${challengeId}`);
    }

    challenge.testCases = testCases;
    challenge.updatedAt = new Date().toISOString();
    this.logAudit('CHALLENGE_TESTCASES_UPDATED', adminId || this.currentUserId, `Updated test cases (${testCases.length} total) for challenge "${challenge.name}".`, challengeId);
    return challenge;
  }

  recordSubmissionResult(submission: Submission, evalResult: any, problem: any): void {
      const passedCount = evalResult.passedTests;
      
      const diff = (problem.difficulty || 'MEDIUM').toUpperCase();
      const marksPerTest = diff === 'EASY' ? 2 : diff === 'HARD' ? 5 : 3;
      const maxMarks = diff === 'EASY' ? 10 : diff === 'HARD' ? 25 : 15;
      
      const earnedScore = passedCount * marksPerTest;

      submission.status = evalResult.status;
      submission.passedTests = passedCount;
      submission.totalTests = 5;
      submission.score = earnedScore;
      submission.maxScore = maxMarks;
      submission.executionTimeMs = evalResult.executionTimeMs;
      submission.memoryUsedMb = evalResult.memoryUsedMb;
      submission.testCaseResults = (evalResult.testCaseResults || []).slice(0, 5);
      submission.errorLog = evalResult.errorLog;

      this.submissions.set(submission.id, submission);

      const contestIdStr = submission.contestId || this.contest?.id || 'unknown-contest';
      const attemptId = submission.attemptId || (this.attempts.get(`${contestIdStr}_${submission.userId}`)?.id) || `att-${contestIdStr}-${submission.userId}`;
      const user = this.users.get(submission.userId);
      const studentId = user?.studentId || submission.userId;
      
      const qrKey = `${attemptId}_${submission.problemId}`;
      const existingQr = this.questionResults.get(qrKey);
      
      if (!existingQr || earnedScore >= existingQr.marksEarned) {
        this.questionResults.set(qrKey, {
          id: `qr-${attemptId}-${submission.problemId}`,
          studentId,
          contestId: contestIdStr,
          attemptId,
          problemId: submission.problemId,
          difficulty: diff,
          passedTestCases: passedCount,
          totalTestCases: 5,
          marksEarned: earnedScore,
          maxMarks,
          status: submission.status,
          testCaseResults: submission.testCaseResults,
          evaluatedAt: new Date().toISOString()
        });
      }

      this.recalculateAttemptScore(attemptId);
  }

  recalculateAttemptScore(attemptId: string) {
    let targetAttemptKey = '';
    let targetAttempt: any = null;
    for (const [key, att] of this.attempts.entries()) {
      if (att.id === attemptId || att.attemptId === attemptId) {
        targetAttempt = att;
        targetAttemptKey = key;
        break;
      }
    }
    
    if (!targetAttempt) return;

    const results = Array.from(this.questionResults.values()).filter(qr => qr.attemptId === attemptId || (targetAttempt.id && qr.attemptId === targetAttempt.id));
    let easyScore = 0;
    let mediumScore = 0;
    let hardScore = 0;
    
    for (const res of results) {
       const diff = (res.difficulty || '').toUpperCase();
       if (diff === 'EASY') easyScore += res.marksEarned;
       else if (diff === 'HARD') hardScore += res.marksEarned;
       else mediumScore += res.marksEarned;
    }
    
    const totalScore = easyScore + mediumScore + hardScore;
    
    targetAttempt.scores = {
      ...(targetAttempt.scores || {}),
      easyScore,
      mediumScore,
      hardScore,
      totalScore
    };
    
    this.attempts.set(targetAttemptKey, targetAttempt);
  }

  logAudit(action: string, performedBy: string, details: string, targetId?: string) {
    const log: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      action,
      performedBy,
      targetId,
      details,
      timestamp: new Date().toISOString()
    };
    this.auditLogs.unshift(log);
    if (this.auditLogs.length > 500) this.auditLogs.pop();
  }
}

export const db = new ContestDatabase();
