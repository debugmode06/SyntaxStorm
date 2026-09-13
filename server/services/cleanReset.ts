import {
  Challenge,
  Contest,
  QuestionSet,
  QuestionAssignment,
  ContestAttempt,
  Submission,
  StudentSessionModel,
  QuestionResult
} from '../models/index.ts';
import { connectMongoDB } from '../mongo.ts';
import { db as originalDb } from '../db.ts';
import { syncAllToMongoDB } from '../proxy.ts';
import { seedOrRepairChallenges } from './seedChallenges.ts';

export async function executeContestDataCleanReset(): Promise<{
  deleted: {
    problems: number;
    contests: number;
    questionSets: number;
    questionAssignments: number;
    contestAttempts: number;
    submissions: number;
    sessions: number;
    questionResults: number;
  };
  preserved: {
    users: number;
  };
}> {
  await connectMongoDB();

  // 1. Delete all existing contest/submission data from MongoDB
  const [
    delContests,
    delQuestionSets,
    delAssignments,
    delAttempts,
    delSubmissions,
    delSessions,
    delQuestionResults
  ] = await Promise.all([
    Contest.deleteMany({}),
    QuestionSet.deleteMany({}),
    QuestionAssignment.deleteMany({}),
    ContestAttempt.deleteMany({}),
    Submission.deleteMany({}),
    StudentSessionModel.deleteMany({}),
    QuestionResult.deleteMany({})
  ]);

  // 2. Clear in-memory contest maps in db.ts
  originalDb.contests.clear();
  originalDb.rounds.clear();
  originalDb.questionSets.clear();
  originalDb.assignments.clear();
  originalDb.attempts.clear();
  originalDb.submissions.clear();
  originalDb.questionResults.clear();
  originalDb.securityStates.clear();
  originalDb.activeSessions.clear();
  originalDb.auditLogs = [];
  originalDb.overrideRecords = [];
  originalDb.contest = null as any;

  // 3. Guarantee master challenge library is intact
  await seedOrRepairChallenges();

  // 4. Sync current clean maps to MongoDB
  await syncAllToMongoDB();

  // 3. Ensure unique index on ContestAttempt collection
  try {
    const coll = ContestAttempt.collection;
    // Drop non-unique indexes if any
    try {
      await coll.dropIndex('studentId_1_contestId_1');
    } catch {
      // index might not exist yet
    }
    try {
      await coll.dropIndex('participantId_1_contestId_1');
    } catch {
      // index might not exist yet
    }

    // Create unique compound indices
    await coll.createIndex({ studentId: 1, contestId: 1 }, { unique: true });
    await coll.createIndex({ participantId: 1, contestId: 1 }, { unique: true });
    console.log('✅ Created UNIQUE compound indexes on ContestAttempt: studentId_1_contestId_1 and participantId_1_contestId_1');
  } catch (idxErr: any) {
    console.error('⚠️ Index creation error:', idxErr.message);
  }

  const userCount = originalDb.users.size;

  const summary = {
    deleted: {
      problems: 0,
      contests: delContests.deletedCount || 0,
      questionSets: delQuestionSets.deletedCount || 0,
      questionAssignments: delAssignments.deletedCount || 0,
      contestAttempts: delAttempts.deletedCount || 0,
      submissions: delSubmissions.deletedCount || 0,
      sessions: delSessions.deletedCount || 0,
      questionResults: delQuestionResults.deletedCount || 0
    },
    preserved: {
      users: userCount
    }
  };

  console.log('🧹 Clean database reset completed successfully:', summary);
  return summary;
}
