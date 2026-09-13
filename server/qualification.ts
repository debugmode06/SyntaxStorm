import type { LeaderboardEntry, Round, QuestionAssignment } from '../src/types.ts';
import { db } from './db.ts';

export class QualificationEngine {
  /**
   * Compute comprehensive leaderboard for a round
   */
  static getLeaderboardForContest(contestId: string, roundId: string = 'round-1', batchId?: string, batchStudentIds?: string[]): LeaderboardEntry[] {
    const participants = Array.from(db.users.values()).filter(u => u.role !== 'ADMIN');
    
    let validBatchIds: string[] = [];
    if (batchId && batchId !== 'all') {
      validBatchIds.push(batchId);
      const targetBatch = Array.from(db.batches.values()).find(b => b.id === batchId || b.normalizedName === batchId || b.name === batchId);
      if (targetBatch) {
        if (targetBatch.id) validBatchIds.push(targetBatch.id);
        if (targetBatch.normalizedName) validBatchIds.push(targetBatch.normalizedName);
        if (targetBatch.name) validBatchIds.push(targetBatch.name);
      }
    }
    
    const filtered = (batchId && batchId !== 'all')
      ? participants.filter(p => 
          (p.batchId && validBatchIds.includes(p.batchId)) ||
          (batchStudentIds && (batchStudentIds.includes(p.id) || (p.studentId && batchStudentIds.includes(p.studentId))))
        )
      : participants;

    const entries: LeaderboardEntry[] = filtered.map(user => {
      // Get assigned set
      const assignment = db.assignments.get(`${user.id}_${roundId}`);
      const assignedSetId = assignment?.setId || 'Set A';

      // Get attempt status strictly for THIS contest
      const attempt = db.attempts.get(`${contestId}_${user.id}`) || 
        Array.from(db.attempts.values()).find(a => a.contestId === contestId && (a.participantId === user.id || a.studentId === user.studentId || a.studentId === user.id));
      
      const attemptStatus = attempt?.status || 'NOT_STARTED';

      // Find all submissions by this user for this round strictly in THIS contest
      let userSubs: any[] = Array.from(db.submissions.values()).filter(s => {
        const subObj = s as any;
        const matchesUser = (s.userId === user.id || subObj.studentId === user.id || subObj.studentId === user.studentId);
        if (!matchesUser) return false;
        if (roundId && s.roundId && s.roundId !== roundId) return false;

        if (s.contestId) return s.contestId === contestId;
        if (attempt && s.attemptId) return s.attemptId === attempt.id;

        return false;
      });

      // Best submission per problem
      const probMap = new Map<string, {
        problemId: string;
        title: string;
        score: number;
        maxScore: number;
        difficulty: string;
        solvedAt?: string;
        attempts: number;
        passedTests: number;
        totalTests: number;
        submittedAt?: string;
        testCaseResults?: any[];
      }>();

      userSubs.forEach(sub => {
        const prob = db.problems.get(sub.problemId);
        const diff = (prob?.difficulty || 'MEDIUM').toUpperCase();
        const maxScore = diff === 'EASY' ? 10 : diff === 'HARD' ? 25 : 15;
        const marksPerTest = diff === 'EASY' ? 2 : diff === 'HARD' ? 5 : 3;

        const passedTests = sub.passedTests ?? 0;
        const score = passedTests * marksPerTest;

        const existing = probMap.get(sub.problemId) || {
          problemId: sub.problemId,
          title: prob?.title || sub.problemId,
          score: 0,
          maxScore,
          difficulty: diff,
          attempts: 0,
          passedTests: 0,
          totalTests: 5,
          submittedAt: undefined as string | undefined,
          solvedAt: undefined as string | undefined,
          testCaseResults: []
        };

        existing.attempts += 1;
        if (score >= existing.score) {
          existing.score = score;
          existing.passedTests = passedTests;
          existing.totalTests = 5;
          existing.submittedAt = sub.submittedAt;
          existing.testCaseResults = sub.testCaseResults || [];
          if (sub.status === 'ACCEPTED' || score === maxScore) {
            existing.solvedAt = sub.submittedAt;
          }
        }
        probMap.set(sub.problemId, existing);
      });

      // Augment with authoritative QuestionResult store strictly for THIS contest
      for (const qr of db.questionResults.values()) {
        const matchesUser = (qr.studentId === user.id || qr.studentId === user.studentId);
        const matchesAttempt = attempt && (qr.attemptId === attempt.id);
        const matchesContest = qr.contestId === contestId && matchesUser;

        if (matchesContest || matchesAttempt) {
            const prob = db.problems.get(qr.problemId);
            const diff = (qr.difficulty || prob?.difficulty || 'MEDIUM').toUpperCase();
            const existing = probMap.get(qr.problemId) || {
              problemId: qr.problemId,
              title: prob?.title || qr.problemId,
              score: 0,
              maxScore: qr.maxMarks || (diff === 'EASY' ? 10 : diff === 'HARD' ? 25 : 15),
              difficulty: diff,
              attempts: 1,
              passedTests: 0,
              totalTests: 5,
              submittedAt: undefined as string | undefined,
              solvedAt: undefined as string | undefined,
              testCaseResults: []
            };
            if (qr.marksEarned >= existing.score) {
              existing.score = qr.marksEarned;
              existing.passedTests = qr.passedTestCases;
              existing.testCaseResults = qr.testCaseResults || [];
              if (qr.marksEarned === existing.maxScore || qr.status === 'ACCEPTED') {
                existing.solvedAt = qr.evaluatedAt;
              }
            }
            probMap.set(qr.problemId, existing);
          }
        }

      let easyScore = 0;
      let mediumScore = 0;
      let hardScore = 0;
      let latestSubAt = '';

      const problemsSolved = Array.from(probMap.values()).map(data => {
        if (data.difficulty === 'EASY') easyScore = Math.max(easyScore, data.score);
        else if (data.difficulty === 'HARD') hardScore = Math.max(hardScore, data.score);
        else mediumScore = Math.max(mediumScore, data.score);

        if (data.submittedAt && (!latestSubAt || new Date(data.submittedAt).getTime() > new Date(latestSubAt).getTime())) {
          latestSubAt = data.submittedAt;
        }

        return data;
      });

      const totalScore = easyScore + mediumScore + hardScore; // Out of 50
      const solvedCount = problemsSolved.filter(p => p.score >= p.maxScore).length;

      let penaltyMinutes = 0;
      problemsSolved.forEach(p => {
        if (p.solvedAt) {
          penaltyMinutes += 15 + (p.attempts - 1) * 10;
        }
      });

      const secState = db.securityStates.get(`${user.id}_${roundId}`);
      const isDisqualified = !!secState?.sessionTerminated && !secState?.adminOverridden;

      let securityStatus = 'CLEAR';
      if (secState?.sessionTerminated && !secState?.adminOverridden) {
        securityStatus = 'TERMINATED';
      } else if (secState?.isFlagged || (secState?.tabSwitchCount || 0) > 0 || (secState?.riskScore || 0) > 30) {
        securityStatus = 'WARNING';
      }

      // Resolve Batch Name
      const batchObj = Array.from(db.batches.values()).find(
        b => b.id === user.batchId || b.name === user.batchId || b.normalizedName === user.batchId
      ) || (batchId && batchId !== 'all' ? Array.from(db.batches.values()).find(b => b.id === batchId || b.normalizedName === batchId || b.name === batchId) : undefined);

      const resolvedBatchName = batchObj?.name || (user.batchId && user.batchId !== 'Unassigned' ? user.batchId : 'Unassigned');
      const resolvedBatchId = user.batchId || batchObj?.id || 'Unassigned';

      return {
        contestId,
        attemptId: attempt?.id || `att-${contestId}-${user.id}`,
        rank: 0,
        userId: user.id,
        participantId: user.id,
        name: user.name || 'Unknown',
        studentName: user.name || 'Unknown',
        participantName: user.name || 'Unknown',
        email: user.email || '',
        studentId: user.studentId || user.id,
        college: user.college || 'N/A',
        batch: resolvedBatchName,
        batchId: resolvedBatchId,
        batchName: resolvedBatchName,
        assignedSetId,
        problemsSolved: problemsSolved.map(p => ({
          problemId: p.problemId,
          title: p.title,
          difficulty: p.difficulty,
          score: p.score,
          maxScore: p.maxScore,
          passedTests: p.passedTests,
          totalTests: p.totalTests,
          attempts: p.attempts,
          testCaseResults: p.testCaseResults
        })),
        easyScore,
        easyMax: 10,
        mediumScore,
        mediumMax: 15,
        hardScore,
        hardMax: 25,
        totalScore,
        totalMax: 50,
        solvedCount,
        penaltyMinutes,
        attemptStatus,
        securityStatus,
        securityRiskScore: secState?.riskScore || 0,
        isDisqualified,
        submittedAt: latestSubAt
      };
    });

    entries.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (a.penaltyMinutes !== b.penaltyMinutes) return a.penaltyMinutes - b.penaltyMinutes;
      if (a.submittedAt && b.submittedAt) return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
      return (a.name || '').localeCompare(b.name || '');
    });

    entries.forEach((e, idx) => {
      e.rank = idx + 1;
    });

    const validatedEntries = entries.filter(entry => {
      if ((entry as any).contestId && (entry as any).contestId !== contestId) {
        console.error(`[CRITICAL DATA INTEGRITY ERROR] Leaderboard entry contestId mismatch for user ${entry.studentId}. Got: ${(entry as any).contestId}, Expected: ${contestId}`);
        return false;
      }
      return true;
    });

    return validatedEntries;
  }

  static getLeaderboard(roundId: string = 'round-1', batchId?: string, batchStudentIds?: string[]): LeaderboardEntry[] {
    const activeContest = db.getContest('active') || db.contest;
    const contestId = activeContest?.id || 'contest-1';
    return this.getLeaderboardForContest(contestId, roundId, batchId, batchStudentIds);
  }

  /**
   * Finalize Round 1, promote top candidates to Round 2, and assign Round 2 question sets
   */
  static finalizeRound1(adminId: string, cutoffRank: number = 15): {
    qualifiedCount: number;
    qualifiedParticipants: LeaderboardEntry[];
    round2: Round;
  } {
    const round1 = db.rounds.get('round-1');
    const round2 = db.rounds.get('round-2');
    if (!round1 || !round2) throw new Error('Contest rounds not initialized');

    // 1. Mark Round 1 as locked & finalized
    round1.status = 'FINALIZED';
    round1.isLocked = true;
    round1.cutoffRank = cutoffRank;

    // 2. Fetch Leaderboard and select top eligible non-disqualified candidates
    const leaderboard = this.getLeaderboard('round-1');
    const qualified = leaderboard
      .filter(entry => !entry.isDisqualified)
      .slice(0, cutoffRank);

    const qualifiedIds = qualified.map(q => q.userId);
    round1.qualifiedParticipantIds = qualifiedIds;
    round2.qualifiedParticipantIds = qualifiedIds;

    // 3. Unlock and activate Round 2
    round2.status = 'ACTIVE';
    round2.isLocked = false;
    db.contest.currentRoundId = 'round-2';

    // 4. Generate and assign Round 2 Question Sets (Set D & Set E)
    const r2Sets = ['set-r2-d', 'set-r2-e'];
    qualifiedIds.forEach((userId, idx) => {
      const setKey = r2Sets[idx % r2Sets.length];
      const qSet = db.questionSets.get(setKey)!;
      const shuffled = [...qSet.problemIds];
      if (idx % 2 === 1) shuffled.reverse();

      const r2Assign: QuestionAssignment = {
        id: `assign-${userId}-r2`,
        userId,
        roundId: 'round-2',
        setId: qSet.setId,
        problemIds: shuffled,
        shuffledProblemIds: shuffled,
        isLocked: true,
        lockedAt: new Date().toISOString(),
        overridden: false,
        assignedAt: new Date().toISOString()
      };
      db.assignments.set(`${userId}_round-2`, r2Assign);

      // Initialize fresh Round 2 security monitor
      db.securityStates.set(`${userId}_round-2`, {
        userId,
        roundId: 'round-2',
        tabSwitchCount: 0,
        maxAllowedSwitches: db.contest.settings.maxTabSwitches,
        isFlagged: false,
        sessionTerminated: false,
        violations: [],
        riskScore: 0
      });
    });

    db.logAudit(
      'ROUND_1_FINALIZED',
      adminId,
      `Round 1 finalized with Cutoff Rank #${cutoffRank}. ${qualified.length} candidates promoted to Round 2 championship.`
    );

    return {
      qualifiedCount: qualified.length,
      qualifiedParticipants: qualified,
      round2
    };
  }
}
