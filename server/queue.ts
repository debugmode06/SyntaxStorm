import type { Submission, SystemHealth } from '../src/types.ts';
import { db, ensureFiveTestCases } from './db.ts';
import { CodeJudge } from './judge.ts';

export interface QueueJob {
  submissionId: string;
  enqueuedAt: number;
}

class SubmissionQueue {
  private queue: QueueJob[] = [];
  private totalWorkers: number = 4;
  private activeWorkers: number = 0;
  private completedJobs: number = 0;
  private failedJobs: number = 0;
  private totalExecutionTimeMs: number = 0;
  private startTime: number = Date.now();

  constructor() {
    // Background worker dispatcher tick
    setInterval(() => this.processNext(), 150);
  }

  enqueue(submissionId: string) {
    this.queue.push({
      submissionId,
      enqueuedAt: Date.now()
    });
  }

  private async processNext() {
    if (this.activeWorkers >= this.totalWorkers || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    if (!job) return;

    const submission = db.submissions.get(job.submissionId);
    if (!submission) return;

    this.activeWorkers++;
    submission.status = 'RUNNING';

    try {
      const rawProblem = db.problems.get(submission.problemId);
      if (!rawProblem) throw new Error('Problem not found');
      const problem = ensureFiveTestCases(rawProblem);

      // Combine 2 sample + 3 hidden = EXACTLY 5 test cases
      const sampleCases = problem.sampleTestCases.slice(0, 2);
      const hiddenCases = problem.hiddenTestCases.slice(0, 3);
      const allTestCases = [...sampleCases, ...hiddenCases];

      const evalResult = await CodeJudge.evaluate({
        code: submission.code,
        language: submission.language,
        testCases: allTestCases,
        timeLimitMs: problem.timeLimitMs,
        memoryLimitMb: problem.memoryLimitMb
      });

      db.recordSubmissionResult(submission, evalResult, problem);

      this.completedJobs++;
      this.totalExecutionTimeMs += evalResult.executionTimeMs;

      db.logAudit(
        'SUBMISSION_EVALUATED',
        submission.userId,
        `Submission ${submission.id} on ${problem.title}: ${submission.status} (${submission.score}/${problem.points} pts)`
      );
    } catch (err: any) {
      submission.status = 'RUNTIME_ERROR';
      submission.errorLog = err.message || 'Judge Worker Internal Error';
      this.failedJobs++;
    } finally {
      this.activeWorkers--;
    }
  }

  getHealth(): SystemHealth {
    const memory = process.memoryUsage();
    return {
      status: this.queue.length > 20 ? 'DEGRADED' : 'HEALTHY',
      activeWorkers: this.activeWorkers,
      totalWorkers: this.totalWorkers,
      queuedJobs: this.queue.length,
      completedJobs: this.completedJobs,
      failedJobs: this.failedJobs,
      avgExecutionTimeMs: this.completedJobs > 0 ? Math.round(this.totalExecutionTimeMs / this.completedJobs) : 45,
      memoryUsageMb: Math.round(memory.heapUsed / 1024 / 1024),
      uptimeSeconds: Math.round((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString()
    };
  }
}

export const submissionQueue = new SubmissionQueue();
