import { Challenge, QuestionSet, QuestionAssignment } from '../models/index.ts';
import { db as originalDb } from '../db.ts';

export const MASTER_CHALLENGES = [
  {
    id: '01_EASY_Sum_of_Two_Numbers',
    problemId: '01_EASY_Sum_of_Two_Numbers',
    challengeCode: 'CH_01',
    title: 'Sum of Two Numbers',
    name: 'Sum of Two Numbers',
    slug: 'sum-of-two-numbers',
    description: 'Given two integers A and B, calculate and return their sum.',
    problemStatement: 'Write a program that takes two integers A and B from standard input and prints their sum to standard output.\n\nInput:\nA single line containing two space-separated integers A and B.\n\nOutput:\nPrint a single integer representing the sum of A and B.',
    inputFormat: 'A single line containing two space-separated integers A and B.',
    outputFormat: 'Print a single integer representing the sum (A + B).',
    constraints: '-10^9 <= A, B <= 10^9',
    difficulty: 'EASY',
    category: 'Basic Programming',
    concepts: ['Basic Math', 'Input/Output'],
    companyTags: ['Amazon', 'Google', 'Microsoft'],
    tags: ['Basic Math', 'Easy'],
    points: 10,
    maximumMarks: 10,
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    sampleTestCases: [
      {
        id: 'tc-sample-01_EASY_Sum_of_Two_Numbers-1',
        input: '3 5\n',
        expectedOutput: '8',
        isSample: true,
        isHidden: false,
        marks: 2,
        order: 1,
        explanation: '3 + 5 = 8'
      },
      {
        id: 'tc-sample-01_EASY_Sum_of_Two_Numbers-2',
        input: '-2 7\n',
        expectedOutput: '5',
        isSample: true,
        isHidden: false,
        marks: 2,
        order: 2,
        explanation: '-2 + 7 = 5'
      }
    ],
    hiddenTestCases: [
      {
        id: 'tc-hidden-01_EASY_Sum_of_Two_Numbers-1',
        input: '100 250\n',
        expectedOutput: '350',
        isSample: false,
        isHidden: true,
        marks: 2,
        order: 3
      },
      {
        id: 'tc-hidden-01_EASY_Sum_of_Two_Numbers-2',
        input: '-50 -40\n',
        expectedOutput: '-90',
        isSample: false,
        isHidden: true,
        marks: 2,
        order: 4
      },
      {
        id: 'tc-hidden-01_EASY_Sum_of_Two_Numbers-3',
        input: '1000000000 500000000\n',
        expectedOutput: '1500000000',
        isSample: false,
        isHidden: true,
        marks: 2,
        order: 5
      }
    ],
    languages: ['python', 'javascript', 'cpp', 'c', 'java'],
    status: 'PUBLISHED',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '02_MEDIUM_Second_Largest_Element',
    problemId: '02_MEDIUM_Second_Largest_Element',
    challengeCode: 'CH_02',
    title: 'Second Largest Element',
    name: 'Second Largest Element',
    slug: 'second-largest-element',
    description: 'Given an array of integers, find the second largest distinct element. If no second largest element exists, return -1.',
    problemStatement: 'Given an integer N followed by an array of N integers, find the second largest distinct element in the array.\n\nIf all elements are equal or N < 2, output -1.',
    inputFormat: 'The first line contains an integer N representing the number of elements.\nThe second line contains N space-separated integers.',
    outputFormat: 'Print the second largest distinct element, or -1 if none exists.',
    constraints: '1 <= N <= 10^5\n-10^9 <= A[i] <= 10^9',
    difficulty: 'MEDIUM',
    category: 'Arrays & Sorting',
    concepts: ['Arrays', 'Searching', 'Sorting'],
    companyTags: ['Amazon', 'Google', 'Adobe'],
    tags: ['Arrays', 'Medium'],
    points: 15,
    maximumMarks: 15,
    timeLimitMs: 1500,
    memoryLimitMb: 256,
    sampleTestCases: [
      {
        id: 'tc-sample-02_MEDIUM_Second_Largest_Element-1',
        input: '5\n12 35 1 10 34 1\n',
        expectedOutput: '34',
        isSample: true,
        isHidden: false,
        marks: 3,
        order: 1,
        explanation: 'Largest is 35, second largest is 34'
      },
      {
        id: 'tc-sample-02_MEDIUM_Second_Largest_Element-2',
        input: '3\n10 10 10\n',
        expectedOutput: '-1',
        isSample: true,
        isHidden: false,
        marks: 3,
        order: 2,
        explanation: 'All elements are identical, so no second largest exists'
      }
    ],
    hiddenTestCases: [
      {
        id: 'tc-hidden-02_MEDIUM_Second_Largest_Element-1',
        input: '6\n7 2 4 9 1 5\n',
        expectedOutput: '7',
        isSample: false,
        isHidden: true,
        marks: 3,
        order: 3
      },
      {
        id: 'tc-hidden-02_MEDIUM_Second_Largest_Element-2',
        input: '4\n100 50 100 25\n',
        expectedOutput: '50',
        isSample: false,
        isHidden: true,
        marks: 3,
        order: 4
      },
      {
        id: 'tc-hidden-02_MEDIUM_Second_Largest_Element-3',
        input: '2\n-5 -2\n',
        expectedOutput: '-5',
        isSample: false,
        isHidden: true,
        marks: 3,
        order: 5
      }
    ],
    languages: ['python', 'javascript', 'cpp', 'c', 'java'],
    status: 'PUBLISHED',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '03_HARD_Minimum_Number_of_Coins',
    problemId: '03_HARD_Minimum_Number_of_Coins',
    challengeCode: 'CH_03',
    title: 'Minimum Number of Coins',
    name: 'Minimum Number of Coins',
    slug: 'minimum-number-of-coins',
    description: 'Given a target amount V and a set of coin denominations, determine the minimum number of coins required to make change for V. If it is impossible, return -1.',
    problemStatement: 'Given a set of N coin denominations and a target amount V, calculate the minimum number of coins required to make change for V.\nYou have an infinite supply of each coin denomination.\nIf it is not possible to make the change, output -1.',
    inputFormat: 'The first line contains two integers N (number of denominations) and V (target amount).\nThe second line contains N space-separated integers representing the coin denominations.',
    outputFormat: 'Print the minimum number of coins needed, or -1 if the amount cannot be formed.',
    constraints: '1 <= N <= 50\n1 <= V <= 10^4\n1 <= coins[i] <= 10^4',
    difficulty: 'HARD',
    category: 'Dynamic Programming',
    concepts: ['Dynamic Programming', 'Greedy', 'Algorithms'],
    companyTags: ['Google', 'Meta', 'Amazon'],
    tags: ['DP', 'Hard'],
    points: 25,
    maximumMarks: 25,
    timeLimitMs: 2000,
    memoryLimitMb: 256,
    sampleTestCases: [
      {
        id: 'tc-sample-03_HARD_Minimum_Number_of_Coins-1',
        input: '3 11\n1 2 5\n',
        expectedOutput: '3',
        isSample: true,
        isHidden: false,
        marks: 5,
        order: 1,
        explanation: '11 = 5 + 5 + 1 (3 coins)'
      },
      {
        id: 'tc-sample-03_HARD_Minimum_Number_of_Coins-2',
        input: '1 3\n2\n',
        expectedOutput: '-1',
        isSample: true,
        isHidden: false,
        marks: 5,
        order: 2,
        explanation: 'Cannot form 3 using only denomination 2'
      }
    ],
    hiddenTestCases: [
      {
        id: 'tc-hidden-03_HARD_Minimum_Number_of_Coins-1',
        input: '4 30\n1 5 10 25\n',
        expectedOutput: '2',
        isSample: false,
        isHidden: true,
        marks: 5,
        order: 3
      },
      {
        id: 'tc-hidden-03_HARD_Minimum_Number_of_Coins-2',
        input: '3 7\n2 4 6\n',
        expectedOutput: '-1',
        isSample: false,
        isHidden: true,
        marks: 5,
        order: 4
      },
      {
        id: 'tc-hidden-03_HARD_Minimum_Number_of_Coins-3',
        input: '5 63\n1 5 10 21 25\n',
        expectedOutput: '3',
        isSample: false,
        isHidden: true,
        marks: 5,
        order: 5
      }
    ],
    languages: ['python', 'javascript', 'cpp', 'c', 'java'],
    status: 'PUBLISHED',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

/**
 * Seed or repair challenges in MongoDB and in-memory databases.
 * Removes corrupt / mismatched challenges and ensures the exact 3 master challenges exist.
 */
export async function seedOrRepairChallenges(): Promise<void> {
  try {
    try {
      await Challenge.collection.dropIndex('challengeCode_1');
    } catch {
      // index might not exist or already dropped
    }

    // Check if invalid or corrupt challenges exist (such as 01_EASY_Count_Even_Numbers)
    await Challenge.deleteMany({
      $or: [
        { id: /count_even_numbers/i },
        { title: /count even numbers/i },
        { maximumMarks: 100, difficulty: 'EASY' }, // Stale 100-mark format
        { 'testCases.7': { $exists: true } } // 8 test cases instead of 5
      ]
    });

    for (const ch of MASTER_CHALLENGES) {
      const allTCs = [...ch.sampleTestCases, ...ch.hiddenTestCases];
      const doc = {
        ...ch,
        testCases: allTCs
      };

      await Challenge.updateOne(
        { id: ch.id },
        { $set: doc },
        { upsert: true }
      );

      originalDb.problems.set(ch.id, doc as any);
      originalDb.challenges.set(ch.id, doc as any);
    }

    const masterIds = MASTER_CHALLENGES.map(c => c.id);
    await QuestionSet.updateMany({}, { $set: { problemIds: masterIds } });
    await QuestionAssignment.updateMany({}, { $set: { problemIds: masterIds } });

    for (const qs of originalDb.questionSets.values()) {
      qs.problemIds = masterIds;
    }
    for (const qa of originalDb.assignments.values()) {
      qa.problemIds = masterIds;
    }

    console.log('✅ Master challenges verified in MongoDB and Memory: 3 challenges (Easy 10, Medium 15, Hard 25 -> Total 50 marks)');
  } catch (err: any) {
    console.error('Error seeding/repairing challenges:', err.message);
  }
}
