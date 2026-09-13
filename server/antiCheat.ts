import type { ParticipantSecurityState, AntiCheatViolation, SecurityEventType, ContestAttempt } from '../src/types.ts';
import { db } from './db.ts';
import { submissionQueue } from './queue.ts';

// Track last event timestamp per participant for debouncing
const lastTabSwitchTimestamps = new Map<string, number>();

export class AntiCheatService {
  static recordViolation(
    userId: string,
    roundId: string,
    type: SecurityEventType,
    details: string,
    metadata?: Record<string, any>,
    contestId?: string
  ): {
    eventAccepted?: boolean;
    tabSwitchCount?: number;
    maxTabSwitches?: number;
    attemptStatus?: string;
    securityState: ParticipantSecurityState;
    attempt: ContestAttempt;
    isTerminated: boolean;
    autoSubmitted: boolean;
    submissions?: any[];
    warningMessage?: string;
  } {
    const activeContestId = contestId || db.getContest('active')?.id || db.contest?.id || 'default-contest';
    const key = `${userId}_${activeContestId}_${roundId}`;
    let state = db.securityStates.get(key) || db.securityStates.get(`${userId}_${roundId}`);

    if (!state) {
      state = {
        userId,
        roundId,
        tabSwitchCount: 0,
        maxAllowedSwitches: db.contest.settings.maxTabSwitches || 3,
        isFlagged: false,
        sessionTerminated: false,
        violations: [],
        riskScore: 0
      };
      db.securityStates.set(key, state);
    }

    const attempt = db.getOrCreateAttempt(activeContestId, userId, undefined, roundId);
    const user = db.users.get(userId);
    const userName = user?.name || userId;
    const now = Date.now();

    // Debounce rapid successive tab switch triggers (1500ms window)
    // ONLY actual TAB_SWITCH events reduce tab count (opening browser extensions or window blur is allowed)
    const isTabSwitchType = type === 'TAB_SWITCH';
    let isCountedSwitch = false;

    if (isTabSwitchType) {
      const lastTime = lastTabSwitchTimestamps.get(key) || 0;
      if (now - lastTime > 1500) {
        lastTabSwitchTimestamps.set(key, now);
        state.tabSwitchCount += 1;
        attempt.tabSwitchCount = state.tabSwitchCount;
        isCountedSwitch = true;
      }
    }

    let severity: AntiCheatViolation['severity'] = 'LOW';
    if (isTabSwitchType) {
      severity = state.tabSwitchCount === 1 ? 'LOW' : state.tabSwitchCount === 2 ? 'MEDIUM' : 'CRITICAL';
    } else if (type === 'DEVTOOLS_OPEN' || type.includes('PASTE')) {
      severity = 'MEDIUM';
    }

    const violation: AntiCheatViolation = {
      id: `viol-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      userId,
      roundId,
      attemptId: attempt.id,
      timestamp: new Date().toISOString(),
      type,
      details,
      severity,
      metadata
    };

    state.violations.push(violation);

    // Calculate dynamic risk score (0-100)
    let score = state.tabSwitchCount * 30;
    state.violations.forEach(v => {
      if (v.type.includes('PASTE')) score += 15;
      if (v.type === 'DEVTOOLS_OPEN') score += 25;
      if (v.type === 'FULLSCREEN_EXIT') score += 10;
      if (v.type === 'MULTIPLE_SESSION_DETECTED') score += 50;
    });
    state.riskScore = Math.min(100, score);
    state.isFlagged = state.riskScore >= 50;

    let autoSubmitted = false;
    let isTerminated = false;
    let warningMessage: string | undefined;
    let generatedSubmissions: any[] = [];

    // Check if max tab switches reached
    if (state.tabSwitchCount >= state.maxAllowedSwitches && !state.sessionTerminated) {
      const lockCode = 'TAB_SWITCH_LIMIT_EXCEEDED';
      const lockText = 'Maximum allowed tab switches exceeded.';
      const lockedTime = new Date().toISOString();

      state.sessionTerminated = true;
      state.lockReasonCode = lockCode;
      state.lockReasonText = lockText;
      state.lockedAt = lockedTime;
      state.lockedBy = 'SYSTEM';
      isTerminated = true;

      const termReason = `Exceeded allowable tab switch limit (${state.tabSwitchCount}/${state.maxAllowedSwitches} violations recorded). Session automatically locked.`;
      state.terminationReason = termReason;

      attempt.status = 'TERMINATED_SECURITY';
      attempt.lockReasonCode = lockCode;
      attempt.lockReasonText = lockText;
      attempt.lockedAt = lockedTime;
      attempt.lockedBy = 'SYSTEM';
      attempt.terminationReason = termReason;

      // Auto-submit all work and lock out attempt
      generatedSubmissions = db.autoSubmitAttempt(activeContestId, userId, roundId, termReason, 'AUTO_SECURITY');
      autoSubmitted = true;
      generatedSubmissions.forEach(sub => {
        submissionQueue.enqueue(sub.id);
      });

      db.logAudit(
        'ANTI_CHEAT_TERMINATION',
        'SYSTEM_GUARDIAN',
        `Automated session termination enforced for ${userName} (${userId}) due to 3 tab switches. Solutions automatically snapshot & submitted.`,
        userId
      );

      warningMessage = `CRITICAL VIOLATION: You have reached the maximum allowed tab switches (${state.tabSwitchCount}/${state.maxAllowedSwitches}). Your exam session has been terminated and your saved code was automatically submitted.`;
    } else if (isCountedSwitch) {
      const remaining = state.maxAllowedSwitches - state.tabSwitchCount;
      warningMessage = `SECURITY WARNING (${state.tabSwitchCount}/${state.maxAllowedSwitches}): Tab switch or focus loss detected. You have ${remaining} warning${remaining === 1 ? '' : 's'} remaining before your exam is automatically terminated and submitted.`;

      db.logAudit(
        'SECURITY_VIOLATION',
        userId,
        `${userName} triggered ${type}: ${details} (Tab switches: ${state.tabSwitchCount}/${state.maxAllowedSwitches})`,
        userId
      );
    } else {
      db.logAudit(
        'SECURITY_VIOLATION',
        userId,
        `${userName} triggered ${type}: ${details}`,
        userId
      );
    }

    state.attemptStatus = attempt.status;

    return {
      eventAccepted: true,
      tabSwitchCount: state.tabSwitchCount,
      maxTabSwitches: state.maxAllowedSwitches,
      attemptStatus: attempt.status,
      securityState: state,
      attempt,
      isTerminated: state.sessionTerminated,
      autoSubmitted,
      submissions: generatedSubmissions,
      warningMessage
    };
  }

  static adminOverride(userId: string, roundId: string, adminId: string, reason: string, contestId?: string): ParticipantSecurityState {
    const activeContestId = contestId || db.getContest('active')?.id || db.contest?.id || 'default-contest';
    const res = db.unlockAttemptAndResume(activeContestId, userId, adminId, reason);
    return res.securityState;
  }

  static getSecurityMatrix(contestId?: string) {
    const activeContestId = contestId || db.getContest('active')?.id || db.contest?.id || 'default-contest';
    return Array.from(db.securityStates.values()).map(state => {
      const user = db.users.get(state.userId);
      const attempt = db.getAttempt(activeContestId, state.userId);
      return {
        ...state,
        user: user || null,
        attempt: attempt || null
      };
    });
  }
}

