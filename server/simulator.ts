import { db } from './db.ts';
import { submissionQueue } from './queue.ts';
import { AntiCheatService } from './antiCheat.ts';
import type { Submission } from '../src/types.ts';

export class ContestLoadSimulator {
  /**
   * Dispatches concurrent load: 50 simulated submissions and randomized anti-cheat telemetry
   */
  static async runSimulation(concurrentUsers: number = 50): Promise<{
    submissionsGenerated: number;
    antiCheatEventsTriggered: number;
    queuedCount: number;
  }> {
    const participants = Array.from(db.users.values()).filter(u => u.role === 'PARTICIPANT').slice(0, concurrentUsers);
    let subsCount = 0;
    let antiCheatCount = 0;

    const roundId = db.contest.currentRoundId || 'round-1';

    for (let i = 0; i < participants.length; i++) {
      const user = participants[i];
      const assign = db.assignments.get(`${user.id}_${roundId}`);
      const problemId = assign?.problemIds?.[0] || 'prob-r1-1';
      const problem = db.problems.get(problemId);

      // Generate a realistic submission
      const subId = `sub-sim-${Date.now()}-${i}`;
      const code = problem?.starterCode?.python || `def solve(): return 42`;

      const submission: Submission = {
        id: subId,
        userId: user.id,
        userName: user.name,
        problemId,
        roundId,
        batchId: user.batchId,
        language: 'python',
        code,
        status: 'QUEUED',
        passedTests: 0,
        totalTests: 0,
        score: 0,
        maxScore: problem?.points || 100,
        executionTimeMs: 0,
        memoryUsedMb: 0,
        submittedAt: new Date().toISOString(),
        testCaseResults: []
      };

      db.submissions.set(subId, submission);
      submissionQueue.enqueue(subId);
      subsCount++;

      // Trigger occasional security events for 15% of participants
      if (Math.random() < 0.18) {
        AntiCheatService.recordViolation(
          user.id,
          roundId,
          Math.random() > 0.5 ? 'TAB_SWITCH' : 'WINDOW_BLUR',
          'Automated load simulation focus perturbation'
        );
        antiCheatCount++;
      }
    }

    db.logAudit(
      'LOAD_SIMULATOR_FIRED',
      'usr-admin-1',
      `Triggered stress test with ${subsCount} concurrent submissions and ${antiCheatCount} anti-cheat perturbations.`
    );

    return {
      submissionsGenerated: subsCount,
      antiCheatEventsTriggered: antiCheatCount,
      queuedCount: subsCount
    };
  }
}
