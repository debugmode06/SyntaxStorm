import express from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import type { Request, Response } from 'express';
import { hashPassword, ensureFiveTestCases } from './db.ts';
import { db, syncAllToMongoDB } from './proxy.ts';
import { submissionQueue } from './queue.ts';
import { CodeJudge, getExecutionHealth } from './judge.ts';
import { checkDirectJudge0Health } from './services/judge0.ts';
import { AntiCheatService } from './antiCheat.ts';
import { QualificationEngine } from './qualification.ts';
import { PlagiarismScanner } from './plagiarism.ts';
import { ContestLoadSimulator } from './simulator.ts';
import { importProblemsFromZipBuffer } from './services/problemZipImporter.ts';
import { executeContestDataCleanReset } from './services/cleanReset.ts';
import {
  Challenge,
  Contest,
  QuestionSet,
  QuestionAssignment,
  ContestAttempt,
  Submission as SubmissionModel,
  Batch,
  BatchMembership,
  User as UserModel
} from './models/index.ts';
import type { Submission, ContestAttempt as ContestAttemptType } from '../src/types.ts';

export const apiRouter = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// 1. Authentication & Persona
function resolveRequestUser(req: Request) {
  const headerUserId = req.headers['x-user-id'] as string;
  if (headerUserId && db.users.has(headerUserId)) {
    db.currentUserId = headerUserId;
    return db.users.get(headerUserId)!;
  }
  const queryUserId = req.query?.userId as string;
  if (queryUserId && db.users.has(queryUserId)) {
    db.currentUserId = queryUserId;
    return db.users.get(queryUserId)!;
  }
  return db.users.get(db.currentUserId) || Array.from(db.users.values())[0];
}

apiRouter.get('/auth/me', async (req: Request, res: Response) => {
  const user = resolveRequestUser(req);
  if (!user) return res.status(401).json({ error: 'No user authenticated' });
  const activeContest = db.getContest('active');
  const securityState = activeContest ? db.securityStates.get(`${user.id}_${activeContest.currentRoundId}`) || null : null;
  const attempt = activeContest ? await db.getAttempt(activeContest.id, user.id) || null : null;
  res.json({ user, securityState, attempt });
});

apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    console.log('AUTH LOGIN REQUEST:', { status: 400, failureReason: 'MISSING_FIELDS' });
    return res.status(400).json({ code: 'INVALID_REQUEST', error: 'Please provide both email/username/student ID and password.', message: 'Please provide both email/username/student ID and password.' });
  }

  const cleanIdentifier = email.trim().toLowerCase();
  // Support aliases and field matches
  let user = Array.from(db.users.values()).find(
    u => u.email.toLowerCase() === cleanIdentifier ||
         u.username?.toLowerCase() === cleanIdentifier ||
         u.studentId?.toLowerCase() === cleanIdentifier
  );

  if (user) {
    // Check if user account is deactivated / inactive
    if (user.status === 'INACTIVE') {
      console.log('AUTH LOGIN REQUEST:', {
        email: cleanIdentifier,
        status: 403,
        studentFound: true,
        accountActive: false,
        failureReason: 'ACCOUNT_DISABLED'
      });
      return res.status(403).json({
        code: 'ACCOUNT_DISABLED',
        error: 'ACCOUNT_DISABLED',
        message: 'Your account is currently inactive. Please contact the symposium administrator.'
      });
    }

    // Verify password against plain, hashed, or fallback defaults
    let isMatch = false;
    if (user.passwordHash) {
      isMatch = bcrypt.compareSync(password, user.passwordHash);
    } else if (user.password) {
      isMatch = bcrypt.compareSync(password, user.password) || password === user.password;
    }

    if (!isMatch) {
      console.log('AUTH LOGIN REQUEST:', {
        email: cleanIdentifier,
        status: 401,
        studentFound: true,
        passwordValid: false,
        failureReason: 'AUTHENTICATION_FAILED'
      });
      return res.status(401).json({
        code: 'AUTHENTICATION_FAILED',
        error: 'AUTHENTICATION_FAILED',
        message: 'Invalid email or password. Please check your credentials.'
      });
    }

    db.currentUserId = user.id;
    let sessionId = '';
    const ua = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : (req.headers['user-agent'] || 'Browser');

    if (user.role === 'PARTICIPANT') {
      const sessionRes = db.resolveLoginSession(user.id, ua);
      if (sessionRes.conflict) {
        console.log('AUTH LOGIN REQUEST:', {
          email: cleanIdentifier,
          status: 409,
          studentFound: true,
          passwordValid: true,
          accountActive: true,
          activeSessionExists: true,
          failureReason: sessionRes.reason || 'ACTIVE_SESSION_EXISTS'
        });
        return res.status(409).json({
          code: 'ACTIVE_SESSION_EXISTS',
          error: 'ACTIVE_SESSION_EXISTS',
          message: 'This account is already logged in on another device or browser.'
        });
      }
      sessionId = sessionRes.session?.sessionId || '';
    } else {
      const sess = db.createActiveSession(user.id, ua);
      sessionId = sess.sessionId;
    }

    const activeContest = db.getContest('active');
    const securityState = activeContest ? db.securityStates.get(`${user.id}_${activeContest.currentRoundId}`) || null : null;
    const attempt = activeContest ? await db.getAttempt(activeContest.id, user.id) || null : null;
    await db.logAudit('USER_LOGIN_SUCCESS', user.id, `User ${user.name} (${user.role}) logged in successfully.`);

    console.log('AUTH LOGIN REQUEST:', {
      email: cleanIdentifier,
      status: 200,
      studentFound: true,
      passwordValid: true,
      accountActive: true,
      activeSessionExists: false,
      role: user.role
    });

    return res.json({ success: true, user, sessionId, sessionStatus: "ACTIVE", securityState, attempt });
  }

  // If not found in active users, check student registrations
  const reg = Array.from(db.registrations.values()).find(
    r => r.email.toLowerCase() === cleanIdentifier || r.assignedUsername?.toLowerCase() === cleanIdentifier
  );

  if (reg) {
    if (reg.status === 'PENDING_APPROVAL') {
      console.log('AUTH LOGIN REQUEST:', {
        email: cleanIdentifier,
        status: 403,
        studentFound: false,
        registrationStatus: 'PENDING_APPROVAL',
        failureReason: 'PENDING_APPROVAL'
      });
      return res.status(403).json({
        code: 'PENDING_APPROVAL',
        error: 'Your registration is currently PENDING ADMIN APPROVAL. Please check back once the Organising Committee approves and issues your access credentials.',
        message: 'Your registration is currently PENDING ADMIN APPROVAL. Please check back once the Organising Committee approves and issues your access credentials.',
        status: 'PENDING_APPROVAL',
        submittedAt: reg.submittedAt
      });
    }
    if (reg.status === 'REJECTED') {
      console.log('AUTH LOGIN REQUEST:', {
        email: cleanIdentifier,
        status: 403,
        studentFound: false,
        registrationStatus: 'REJECTED',
        failureReason: 'ACCOUNT_REJECTED'
      });
      return res.status(403).json({
        code: 'ACCOUNT_REJECTED',
        error: `Your registration was rejected. Reason: ${reg.rejectionReason || 'Eligibility criteria not met'}.`,
        message: `Your registration was rejected. Reason: ${reg.rejectionReason || 'Eligibility criteria not met'}.`,
        status: 'REJECTED'
      });
    }
  }

  console.log('AUTH LOGIN REQUEST:', {
    email: cleanIdentifier,
    status: 401,
    studentFound: false,
    failureReason: 'AUTHENTICATION_FAILED'
  });

  return res.status(401).json({
    code: 'AUTHENTICATION_FAILED',
    error: 'AUTHENTICATION_FAILED',
    message: 'Invalid email or password. Please check your credentials.'
  });
});

// ==========================================
// STUDENT MANAGEMENT API ENDPOINTS
// ==========================================
apiRouter.get('/students', async (req: Request, res: Response) => {
  const search = req.query.search as string;
  const status = req.query.status as string;
  const institution = req.query.institution as string;
  const department = req.query.department as string;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 50;

  try {
    const result = await db.getStudents({ search, status, institution, department, page, limit });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

apiRouter.get('/students/:id', async (req: Request, res: Response) => {
  const student = await db.getStudentById(req.params.id as string);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  res.json({ student });
});

apiRouter.post('/students', async (req: Request, res: Response) => {
  try {
    const student = await db.createStudent(req.body, db.currentUserId);
    res.status(201).json({ student, message: 'Student account created successfully.' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.put('/students/:id', async (req: Request, res: Response) => {
  try {
    const student = await db.updateStudent(req.params.id as string, req.body, db.currentUserId);
    res.json({ student, message: 'Student details updated successfully.' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.post('/students/:id/reset-password', async (req: Request, res: Response) => {
  const { newPassword } = req.body;
  try {
    const result = await db.resetStudentPassword(req.params.id as string, newPassword, db.currentUserId);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.delete('/students/:id', async (req: Request, res: Response) => {
  try {
    const result = await db.deleteStudent(req.params.id as string, db.currentUserId);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.post('/auth/register-student', async (req: Request, res: Response) => {
  const { name, email, college, studentId, department, yearOfStudy, phone, preferredBatchId, githubOrProfileUrl } = req.body;
  if (!name || !email || !college || !studentId) {
    return res.status(400).json({ error: 'Please provide full name, email, college, and student ID.' });
  }

  // Check if already registered
  const existing = Array.from(db.registrations.values()).find(
    r => r.email.toLowerCase() === email.trim().toLowerCase()
  );
  if (existing) {
    return res.status(400).json({
      error: `A registration with email ${email} already exists (Status: ${existing.status}).`
    });
  }

  const registration = await db.createRegistration({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    college: college.trim(),
    studentId: studentId.trim(),
    department: department?.trim() || 'Computer Science',
    yearOfStudy: yearOfStudy || '3rd Year',
    phone: phone?.trim() || '',
    preferredBatchId: preferredBatchId || 'batch-1',
    githubOrProfileUrl: githubOrProfileUrl?.trim()
  });

  res.json({ registration, message: 'Registration submitted successfully! Awaiting Admin Approval.' });
});

apiRouter.post('/auth/switch-user', async (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!db.users.has(userId)) {
    return res.status(404).json({ error: 'User not found' });
  }
  db.currentUserId = userId;
  const user = db.users.get(userId);
  const activeContest = db.getContest('active');
  const securityState = activeContest ? db.securityStates.get(`${userId}_${activeContest.currentRoundId}`) || null : null;
  res.json({ user, securityState });
});

// 2. Student Registrations Management (Admin)
apiRouter.get('/registrations', async (req: Request, res: Response) => {
  const list = Array.from(db.registrations.values()).sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
  res.json({ registrations: list });
});

apiRouter.post('/registrations/:id/approve', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { assignedBatchId, assignedUsername, assignedPassword, assignedRollCode } = req.body;

  if (!assignedUsername || !assignedPassword) {
    return res.status(400).json({ error: 'Please specify assigned username and login password for the student.' });
  }

  try {
    const result = await db.approveRegistration(id, db.currentUserId, {
      assignedBatchId: assignedBatchId || 'batch-1',
      assignedUsername,
      assignedPassword,
      assignedRollCode
    });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

apiRouter.post('/registrations/:id/reject', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { reason } = req.body;

  try {
    const registration = await db.rejectRegistration(id, db.currentUserId, reason || 'Did not meet eligibility guidelines.');
    res.json({ registration });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 3. Contest Management & Creation
apiRouter.post('/contests/create', async (req: Request, res: Response) => {
  try {
    const contest = await db.createNewContest(req.body, db.currentUserId);
    res.status(201).json({
      contest,
      batches: await Batch.find().sort({ name: 1 }).lean(),
      rounds: Array.from(db.rounds.values()),
      message: 'Contest created successfully.'
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Admin Unlock & Resume Contest Attempt
apiRouter.post([
  '/admin/contests/:contestId/attempts/:attemptId/unlock',
  '/admin/attempts/:attemptId/unlock',
  '/anticheat/admin-unlock',
  '/anticheat/override'
], async (req: Request, res: Response) => {
  const contestId = String(req.params.contestId || db.contest?.id || '');
  const attemptId = String(req.params.attemptId || req.body.attemptId || req.body.userId || '');
  const reason = (req.body.reason || '').trim();
  const adminId = db.currentUserId;

  if (!reason || reason.length < 10) {
    return res.status(400).json({ error: 'Unlock reason is required (minimum 10 characters).' });
  }
  if (reason.length > 500) {
    return res.status(400).json({ error: 'Unlock reason cannot exceed 500 characters.' });
  }

  try {
    const result = db.unlockAttemptAndResume(contestId, attemptId, adminId, reason);
    res.json(result);
  } catch (e: any) {
    const status = e.message?.includes('Unauthorized') ? 403 :
                   e.message?.includes('already been unlocked') ? 409 :
                   e.message?.includes('ended') || e.message?.includes('expired') ? 422 : 400;
    res.status(status).json({ error: e.message });
  }
});

// Student/System Attempt State Polling Endpoint (for instant resume detection)
apiRouter.get('/attempts/:attemptId/state', async (req: Request, res: Response) => {
  try {
    const attemptId = String(req.params.attemptId || '');
    let attempt: ContestAttemptType | undefined;

    for (const att of db.attempts.values()) {
      if (att.id === attemptId || att.id === `att-${att.contestId}-${attemptId}`) {
        attempt = att;
        break;
      }
    }
    if (!attempt) {
      attempt = db.attempts.get(attemptId);
    }
    if (!attempt) {
      for (const att of db.attempts.values()) {
        if (att.participantId === attemptId || att.studentId === attemptId) {
          attempt = att;
          break;
        }
      }
    }
    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    const expiresAtMs = attempt.expiresAt ? new Date(attempt.expiresAt).getTime() : 0;
    const remainingSeconds = expiresAtMs > 0 ? Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000)) : 0;
    const isResumed = !!(attempt as any).overrideGranted || !!(attempt as any).resumedByAdmin || attempt.status === 'IN_PROGRESS';

    res.json({
      attemptId: attempt.id,
      studentId: attempt.studentId || attempt.participantId,
      contestId: attempt.contestId,
      status: attempt.status,
      assignedSetId: attempt.assignedSetId || 'Set A',
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      remainingSeconds,
      currentProblemId: (attempt as any).currentProblemId,
      tabSwitchCount: attempt.tabSwitchCount || 0,
      resumedByAdmin: isResumed,
      resumedAt: (attempt as any).lastOverrideAt || (attempt as any).resumedAt || null
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Authoritative Admin Scorecard Endpoint (Strict attemptId data ownership)
apiRouter.get(['/admin/contests/:contestId/attempts/:attemptId/scorecard', '/admin/contests/:contestId/students/:attemptId/scorecard'], async (req: Request, res: Response) => {
  try {
    const user = resolveRequestUser(req);
    if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: 'Unauthorized. Admin only.' });

    const contestId = String(req.params.contestId || db.contest?.id || '');
    const attemptId = String(req.params.attemptId || '');

    let attempt: ContestAttemptType | undefined;
    for (const att of db.attempts.values()) {
      if (att.id === attemptId || att.id === `att-${contestId}-${attemptId}`) {
        attempt = att;
        break;
      }
    }
    if (!attempt) {
      attempt = db.attempts.get(`${contestId}_${attemptId}`);
    }
    if (!attempt) {
      for (const att of db.attempts.values()) {
        if ((att.participantId === attemptId || att.studentId === attemptId) && att.contestId === contestId) {
          attempt = att;
          break;
        }
      }
    }

    if (!attempt) {
      return res.status(404).json({ error: 'Contest attempt not found.' });
    }

    if (attempt.contestId !== contestId) {
      return res.status(400).json({ error: 'Attempt does not belong to the specified contest.' });
    }

    const targetUserId = String(attempt.participantId || attempt.studentId || '');
    const studentUser = targetUserId ? db.users.get(targetUserId) : undefined;
    const roundId = attempt.currentRoundId || 'round-1';

    // Retrieve the exact assigned problem set for this specific attempt
    const assignment = db.assignments.get(`${attempt.participantId}_${roundId}`) || db.assignments.get(`${attempt.participantId}_${contestId}`);
    const assignedProblemIds = assignment?.problemIds && assignment.problemIds.length > 0
      ? assignment.problemIds
      : Array.from(db.problems.values()).filter(p => p.roundId === roundId).map(p => p.id);

    // Filter submissions strictly belonging to THIS specific attemptId
    const attemptSubs = Array.from(db.submissions.values()).filter(
      s => (s.attemptId ? s.attemptId === attempt!.id : s.userId === attempt!.participantId) && s.roundId === roundId
    );

    let easyScore = 0;
    let mediumScore = 0;
    let hardScore = 0;

    const questions = assignedProblemIds.map(probId => {
      const rawProb = db.problems.get(probId);
      const prob = rawProb ? ensureFiveTestCases(rawProb) : null;
      const diff = (prob?.difficulty || 'MEDIUM').toUpperCase();
      const maxMarks = diff === 'EASY' ? 10 : diff === 'HARD' ? 25 : 15;
      const marksPerCase = diff === 'EASY' ? 2 : diff === 'HARD' ? 5 : 3;

      // 1. Check authoritative QuestionResult for this attemptId + problemId
      const qrKey = `${attempt!.id}_${probId}`;
      const savedQr = db.questionResults.get(qrKey);

      // 2. Or best submission for this attempt
      const probSubs = attemptSubs.filter(s => s.problemId === probId);
      probSubs.sort((a, b) => (b.score || 0) - (a.score || 0));
      const bestSub = probSubs[0];

      const passedCount = savedQr ? savedQr.passedTestCases : (bestSub?.passedTests ?? 0);
      const marksEarned = savedQr ? savedQr.marksEarned : (bestSub ? (bestSub.score ?? (passedCount * marksPerCase)) : 0);

      if (diff === 'EASY') easyScore = Math.max(easyScore, marksEarned);
      else if (diff === 'HARD') hardScore = Math.max(hardScore, marksEarned);
      else mediumScore = Math.max(mediumScore, marksEarned);

      const testResults = (savedQr?.testCaseResults && savedQr.testCaseResults.length > 0)
        ? savedQr.testCaseResults.slice(0, 5)
        : (bestSub?.testCaseResults && bestSub.testCaseResults.length > 0)
        ? bestSub.testCaseResults.slice(0, 5)
        : Array.from({ length: 5 }, (_, i) => ({
            id: `case-${i + 1}`,
            passed: i < passedCount,
            status: i < passedCount ? 'ACCEPTED' : 'WRONG_ANSWER'
          }));

      return {
        problemId: probId,
        title: prob?.title || probId,
        difficulty: diff,
        marksEarned,
        maxMarks,
        passedTestCases: passedCount,
        totalTestCases: 5,
        testResults
      };
    });

    const totalScore = Math.min(50, easyScore + mediumScore + hardScore);

    res.json({
      attempt: {
        attemptId: attempt.id,
        studentId: attempt.studentId || attempt.participantId,
        studentName: studentUser?.name || attempt.participantId,
        email: studentUser?.email || '',
        college: studentUser?.college || 'Engineering',
        batch: studentUser?.batchId || attempt.batchId || 'Alpha',
        contestId: attempt.contestId,
        assignedSetId: attempt.assignedSetId || 'Set A',
        status: attempt.status,
        totalScore,
        maxScore: 50,
        easyScore,
        mediumScore,
        hardScore
      },
      questions
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Audit Dossier for Contest Attempt
apiRouter.get([
  '/admin/contests/:contestId/attempts/:attemptId/audit',
  '/admin/attempts/:attemptId/audit'
], async (req: Request, res: Response) => {
  try {
    const contestId = String(req.params.contestId || db.contest?.id || '');
    const attemptId = String(req.params.attemptId || '');

    let attempt: ContestAttemptType | undefined;
    for (const att of db.attempts.values()) {
      if (att.id === attemptId || att.id === `att-${contestId}-${attemptId}`) {
        attempt = att;
        break;
      }
    }
    if (!attempt) {
      attempt = db.attempts.get(`${contestId}_${attemptId}`);
    }
    if (!attempt) {
      for (const att of db.attempts.values()) {
        if (att.participantId === attemptId) {
          attempt = att;
          break;
        }
      }
    }

    if (!attempt) {
      return res.status(404).json({ error: 'Contest attempt not found' });
    }

    const studentId = attempt.participantId;
    const student = db.users.get(studentId) || null;
    const roundId = attempt.currentRoundId || db.contest?.currentRoundId || 'round-1';
    const securityState = db.securityStates.get(`${studentId}_${roundId}`) || null;
    const submissions = Array.from(db.submissions.values()).filter(s => s.userId === studentId && s.roundId === roundId);
    const assignment = db.assignments.get(`${studentId}_${roundId}`) || null;
    const overrideHistory = attempt.overrideRecords || [];

    res.json({
      student,
      contest: db.contest || null,
      attempt,
      securityState,
      submissions,
      assignment,
      overrideHistory
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

apiRouter.get('/users', async (req: Request, res: Response) => {
  res.json({ users: Array.from(db.users.values()) });
});

// Contest overview & Control
apiRouter.get('/contests', async (req: Request, res: Response) => {
  res.json({ contests: await db.getContests() });
});

apiRouter.get('/contests/:id', async (req: Request, res: Response) => {
  res.json({ contest: await db.getContest(req.params.id as string) });
});

// Anti-Cheat & Security Settings
apiRouter.get('/settings/anticheat', async (req: Request, res: Response) => {
  res.json(await db.getContestSecuritySettings());
});

apiRouter.patch('/settings/anticheat', async (req: Request, res: Response) => {
  const updates = req.body;
  if (!updates) return res.status(400).json({ error: 'Missing updates payload' });
  const result = await db.updateContestSecuritySettings(updates);
  res.json({ success: true, ...result });
});

apiRouter.get('/student/contests', async (req: Request, res: Response) => {
  const user = resolveRequestUser(req);
  const userId = user?.id || (req.headers['x-user-id'] as string) || db.currentUserId;
  const contests = await db.getStudentContests(userId);
  res.json({ contests, serverTime: new Date().toISOString() });
});

// Contest Status for Student (Status check before attempting)
apiRouter.get([
  '/student/contests/:contestId/status',
  '/contests/:contestId/status'
], async (req: Request, res: Response) => {
  try {
    const user = resolveRequestUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const contestId = String(req.params.contestId);
    const contest = db.getContest(contestId);
    const attempt = await db.getAttempt(contestId, user.id);

    const attemptExists = !!attempt;
    const attemptStatus = attempt ? attempt.status : null;
    const isContestLive = !!(contest && (contest.isLive || contest.status === 'LIVE' || contest.status === 'PUBLISHED'));

    const canStart = !attemptExists && isContestLive;
    const canContinue = attemptExists && (attemptStatus === 'IN_PROGRESS' || attemptStatus === 'ACTIVE' || attemptStatus === 'PREPARING');
    const canViewResult = attemptExists && (attemptStatus === 'SUBMITTED' || attemptStatus === 'AUTO_SUBMITTED' || attemptStatus === 'COMPLETED' || attemptStatus === 'DISQUALIFIED');

    res.json({
      contestId,
      contestStatus: contest ? contest.status : 'NOT_FOUND',
      attemptExists,
      attemptStatus,
      canStart,
      canContinue,
      canViewResult
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Admin and General Contest Listing
apiRouter.get(['/contests', '/admin/contests'], async (req: Request, res: Response) => {
  const contests = Array.from(db.contests.values());
  res.json({ contests });
});

// Get Contest by ID
apiRouter.get(['/contests/:id', '/admin/contests/:id'], async (req: Request, res: Response) => {
  const contest = db.getContest(req.params.id as string);
  if (!contest) return res.status(404).json({ error: 'Contest not found' });
  res.json({ contest });
});

apiRouter.post(['/contests/create', '/contests', '/admin/contests'], async (req: Request, res: Response) => {
  try {
    const contest = await db.createNewContest(req.body, db.currentUserId);
    res.status(201).json({ contest, message: 'Contest created successfully.' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.post('/contests/:id/draft', async (req: Request, res: Response) => {
  try {
    const updated = await db.saveContestDraft(req.params.id as string, req.body, db.currentUserId);
    res.json({ contest: updated, message: 'Contest saved as Draft.' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.put(['/contests/:id', '/admin/contests/:id'], async (req: Request, res: Response) => {
  try {
    const updated = await db.saveContestDraft(req.params.id as string, req.body, db.currentUserId);
    res.json({ contest: updated, message: 'Contest updated successfully.' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.post(['/contests/:id/sets', '/admin/contests/:id/sets'], async (req: Request, res: Response) => {
  try {
    const { sets } = req.body;
    await db.saveContestSets(req.params.id as string, sets || [], db.currentUserId);
    res.json({ message: 'Contest question sets saved successfully.' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.get(['/contests/:id/sets', '/admin/contests/:id/sets'], async (req: Request, res: Response) => {
  try {
    const sets = Array.from(db.questionSets.values()).filter(s => (s as any).contestId === req.params.id);
    res.json({ sets });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.post([
  '/contests/:id/sets/autogenerate',
  '/admin/contests/:id/sets/autogenerate'
], async (req: Request, res: Response) => {
  try {
    const contestId = req.params.id as string;
    const { roundId = 'round-1', setCount = 3, questionsPerSet = 3 } = req.body;
    const sets = await db.autoGenerateQuestionSets(roundId, Number(setCount), Number(questionsPerSet), db.currentUserId, contestId);
    res.json({ success: true, sets, message: `Generated ${sets.length} balanced question sets for contest ${contestId}.` });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.post('/contests/:id/publish', async (req: Request, res: Response) => {
  try {
    const result = await db.publishContestWithValidation(req.params.id as string, db.currentUserId);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.post('/contests/:id/archive', async (req: Request, res: Response) => {
  try {
    const result = await db.deleteContest(req.params.id as string, db.currentUserId);
    res.json({ message: 'Contest archived successfully.', ...result });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.delete(['/contests/:id', '/admin/contests/:id'], async (req: Request, res: Response) => {
  try {
    const result = await db.deleteContest(req.params.id as string, db.currentUserId);
    res.json({ message: 'Contest removed successfully.', ...result });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.post('/contests/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const duplicated = await db.duplicateContest(req.params.id as string, db.currentUserId);
    res.json({ contest: duplicated, message: 'Contest duplicated as draft.' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.patch('/contests/:id/control', async (req: Request, res: Response) => {
  const { isPaused, isLive, ...otherUpdates } = req.body;
  const updated = await db.updateContestControl(req.params.id as string, req.body, db.currentUserId);
  res.json({ contest: updated });
});

apiRouter.post('/contests/validate', async (req: Request, res: Response) => {
  const validation = await db.validateContest();
  res.json({ validation });
});

apiRouter.post('/contests/:id/lock', async (req: Request, res: Response) => {
  try {
    const result = await db.lockContestConfiguration(db.currentUserId);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.post('/contests/:id/launch', async (req: Request, res: Response) => {
  try {
    const result = await db.launchContest(db.currentUserId);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Batches CRUD
apiRouter.get('/batches', async (req: Request, res: Response) => {
  try {
    const batches = await Batch.find().sort({ name: 1 }).lean();
    res.json({ batches });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/batches', async (req: Request, res: Response) => {
  try {
    const batch = await db.createBatch(req.body, db.currentUserId);
    res.status(201).json({ batch, message: 'Batch created successfully' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.put('/batches/:id', async (req: Request, res: Response) => {
  try {
    const batch = await db.updateBatch(req.params.id as string, req.body, db.currentUserId);
    res.json({ batch, message: 'Batch updated successfully' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.delete('/batches/:id', async (req: Request, res: Response) => {
  try {
    await db.deleteBatch(req.params.id as string, db.currentUserId);
    res.json({ success: true, message: 'Batch deleted successfully' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.post('/batches/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const batch = await db.duplicateBatch(req.params.id as string, db.currentUserId);
    res.json({ batch, message: 'Batch duplicated successfully' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Rounds CRUD
apiRouter.get('/rounds', async (req: Request, res: Response) => {
  res.json({ rounds: Array.from(db.rounds.values()) });
});

apiRouter.post('/rounds', async (req: Request, res: Response) => {
  try {
    const round = await db.createRound(req.body, db.currentUserId);
    res.status(201).json({ round, message: 'Round created successfully' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.put('/rounds/:id', async (req: Request, res: Response) => {
  try {
    const round = await db.updateRound(req.params.id as string, req.body, db.currentUserId);
    res.json({ round, message: 'Round updated successfully' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.post('/rounds/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const round = await db.duplicateRound(req.params.id as string, db.currentUserId);
    res.json({ round, message: 'Round duplicated successfully' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Problems & Question Assignments
apiRouter.get(['/problems', '/admin/problems'], async (req: Request, res: Response) => {
  const roundId = (req.query.roundId as string) || db.contest?.currentRoundId;
  const search = req.query.search as string;
  const concept = req.query.concept as string;
  const difficulty = req.query.difficulty as string;
  const companyTag = req.query.companyTag as string;
  const status = req.query.status as string;
  const page = req.query.page ? Number(req.query.page) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;

  const user = resolveRequestUser(req);
  const isAdmin = user && (user.role === 'ADMIN' || user.role === 'JUDGE');

  // If filtered or admin view requested, use rich admin filter
  if (isAdmin || search || concept || difficulty || companyTag || status || page !== undefined) {
    try {
      const result = await db.getAdminProblemsFiltered({ roundId, search, concept, difficulty, companyTag, status, page: page || 1, limit });
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  const problems = Array.from(db.problems.values()).filter(p => !roundId || !p.roundId || p.roundId === roundId);
  // Redact hidden test cases for security if participant
  const safeProblems = problems.map(p => ({
    ...p,
    hiddenTestCases: []
  }));
  res.json({ problems: safeProblems });
});

// Admin-only Problems alias (with hidden test cases & advanced filtering)
apiRouter.get('/problems/admin', async (req: Request, res: Response) => {
  const roundId = req.query.roundId as string;
  const search = req.query.search as string;
  const concept = req.query.concept as string;
  const difficulty = req.query.difficulty as string;
  const companyTag = req.query.companyTag as string;
  const status = req.query.status as string;
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;

  try {
    const result = await db.getAdminProblemsFiltered({ roundId, search, concept, difficulty, companyTag, status, page, limit });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

apiRouter.get(['/problems/:id', '/admin/problems/:id'], async (req: Request, res: Response) => {
  const problem = db.problems.get(req.params.id as string);
  if (!problem) return res.status(404).json({ error: 'Problem not found' });
  
  const user = resolveRequestUser(req);
  const isAdmin = user && (user.role === 'ADMIN' || user.role === 'JUDGE');
  
  if (isAdmin) {
    res.json({ problem });
  } else {
    // Redact hidden test cases for participants
    res.json({
      problem: {
        ...problem,
        hiddenTestCases: []
      }
    });
  }
});

apiRouter.post(['/problems', '/admin/problems'], async (req: Request, res: Response) => {
  try {
    const problem = await db.createProblem(req.body, db.currentUserId);
    res.status(201).json({ problem, message: 'Problem statement and test cases created successfully.' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.post('/problems/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const problem = await db.duplicateProblem(req.params.id as string, db.currentUserId);
    res.json({ problem, message: 'Problem duplicated successfully.' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.post('/problems/:id/publish', async (req: Request, res: Response) => {
  try {
    const problem = await db.publishProblem(req.params.id as string, db.currentUserId);
    res.json({ problem, message: `Problem "${problem.title}" published successfully.` });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.post('/problems/:id/archive', async (req: Request, res: Response) => {
  try {
    const problem = await db.archiveProblem(req.params.id as string, db.currentUserId);
    res.json({ problem, message: `Problem "${problem.title}" archived successfully.` });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.post('/problems/:id/unpublish', async (req: Request, res: Response) => {
  try {
    const problem = await db.unpublishProblem(req.params.id as string, db.currentUserId);
    res.json({ problem, message: `Problem "${problem.title}" reverted to Draft.` });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ZIP Problem Bulk Import (Strict Difficulty & Exact Test Case Validation)
apiRouter.post([
  '/admin/problems/import',
  '/problems/import',
  '/admin/problems/bulk-import-zip'
], upload.single('file'), async (req: Request, res: Response) => {
  try {
    let zipBuffer: Buffer | null = null;
    if (req.file && req.file.buffer) {
      zipBuffer = req.file.buffer;
    } else if (req.body?.zipBase64) {
      zipBuffer = Buffer.from(req.body.zipBase64, 'base64');
    }

    if (!zipBuffer) {
      return res.status(400).json({
        error: 'Please upload a ZIP file under multipart form-data field "file" or provide "zipBase64".'
      });
    }

    const report = await importProblemsFromZipBuffer(zipBuffer);
    res.json(report);
  } catch (e: any) {
    console.error('Problem ZIP import error:', e);
    res.status(500).json({ error: e.message || 'Failed to import problem archive' });
  }
});

apiRouter.post('/problems/bulk-import', async (req: Request, res: Response) => {
  if (req.body?.zipBase64) {
    try {
      const zipBuffer = Buffer.from(req.body.zipBase64, 'base64');
      const report = await importProblemsFromZipBuffer(zipBuffer);
      return res.json(report);
    } catch (zipErr: any) {
      return res.status(500).json({ error: zipErr.message });
    }
  }

  const { problems, options = { onDuplicate: 'upsert' } } = req.body;
  if (!Array.isArray(problems) || problems.length === 0) {
    return res.status(400).json({ error: 'Please provide a valid non-empty array of problems.' });
  }

  try {
    const result = await db.bulkImportProblems(problems, options, db.currentUserId);
    await syncAllToMongoDB();
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.put(['/problems/:id', '/admin/problems/:id'], async (req: Request, res: Response) => {
  try {
    const problem = await db.updateProblem(req.params.id as string, req.body, db.currentUserId);
    res.json({ problem, message: 'Problem updated successfully.' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.delete(['/problems/:id', '/admin/problems/:id'], async (req: Request, res: Response) => {
  try {
    await db.deleteProblem(req.params.id as string, db.currentUserId);
    res.json({ success: true, message: 'Problem deleted successfully.' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Question Sets
apiRouter.get('/question-sets', async (req: Request, res: Response) => {
  const roundId = (req.query.roundId as string) || db.contest?.currentRoundId || 'round-1';
  const sets = await db.getQuestionSets(roundId);
  res.json({ sets });
});

apiRouter.post('/question-sets', async (req: Request, res: Response) => {
  try {
    const set = await db.saveQuestionSet(req.body, db.currentUserId);
    res.json({ set, message: 'Question set saved successfully.' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.post('/question-sets/builder/save-all', async (req: Request, res: Response) => {
  const { roundId = 'round-1', sets = [] } = req.body;
  try {
    const saved = await db.saveAllQuestionSets(roundId, sets, db.currentUserId);
    res.json({ sets: saved, message: `Successfully saved ${saved.length} question sets.` });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.post('/question-sets/validate-config', async (req: Request, res: Response) => {
  const {
    roundId = 'round-1',
    setCount = 3,
    questionsPerSet = 3,
    difficultyPattern = ['EASY', 'MEDIUM', 'HARD'],
    allowCrossSetDuplicates = false
  } = req.body;

  try {
    const report = await db.validateQuestionSetsConfig(
      roundId,
      Number(setCount),
      Number(questionsPerSet),
      difficultyPattern,
      Boolean(allowCrossSetDuplicates)
    );
    res.json({ report });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.post('/question-sets/randomize', async (req: Request, res: Response) => {
  const {
    roundId = 'round-1',
    setCount = 3,
    questionsPerSet = 3,
    difficultyPattern = ['EASY', 'MEDIUM', 'HARD'],
    allowCrossSetDuplicates = false
  } = req.body;

  try {
    const sets = await db.randomizeSetsFromPools(
      roundId,
      Number(setCount),
      Number(questionsPerSet),
      difficultyPattern,
      Boolean(allowCrossSetDuplicates),
      db.currentUserId
    );
    res.json({ sets, message: `Successfully randomized ${sets.length} sets according to difficulty distribution.` });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.get('/challenges/library', async (req: Request, res: Response) => {
  const roundId = (req.query.roundId as string) || db.contest?.currentRoundId;
  const search = ((req.query.search as string) || '').toLowerCase().trim();
  const difficulty = ((req.query.difficulty as string) || '').toUpperCase();
  const category = (req.query.category as string) || '';
  const status = (req.query.status as string) || 'PUBLISHED'; // default to published for selector

  let challenges = Array.from(db.problems.values()).filter(p => !roundId || p.roundId === roundId);

  // Status filtering (only published by default for contest selection)
  if (status && status !== 'ALL') {
    challenges = challenges.filter(p => (p.status || 'PUBLISHED') === status);
  }

  // Difficulty filter
  if (difficulty && difficulty !== 'ALL') {
    challenges = challenges.filter(p => p.difficulty === difficulty);
  }

  // Category filter
  if (category && category !== 'ALL') {
    challenges = challenges.filter(p =>
      p.tags?.some(t => t.toLowerCase() === category.toLowerCase()) ||
      (p.sourcePlatform && p.sourcePlatform.toLowerCase() === category.toLowerCase())
    );
  }

  // Search query (title, ID, slug, tags, description)
  if (search) {
    challenges = challenges.filter(p =>
      p.title.toLowerCase().includes(search) ||
      p.id.toLowerCase().includes(search) ||
      p.slug.toLowerCase().includes(search) ||
      p.tags?.some(t => t.toLowerCase().includes(search)) ||
      p.description.toLowerCase().includes(search)
    );
  }

  // Redact hidden test cases from preview library
  const safeChallenges = challenges.map(p => ({
    ...p,
    hiddenTestCases: []
  }));

  res.json({ challenges: safeChallenges, total: safeChallenges.length });
});

apiRouter.delete('/question-sets/:id', async (req: Request, res: Response) => {
  try {
    await db.deleteQuestionSet(req.params.id as string, db.currentUserId);
    res.json({ success: true, message: 'Question set deleted successfully.' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.post('/question-sets/auto-generate', async (req: Request, res: Response) => {
  const { roundId = 'round-1', setCount = 3, questionsPerSet = 3 } = req.body;
  try {
    const sets = await db.autoGenerateQuestionSets(roundId, Number(setCount), Number(questionsPerSet), db.currentUserId);
    res.json({ sets, message: `Auto-generated ${sets.length} sets with ${questionsPerSet} questions each.` });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.post('/question-sets/distribute', async (req: Request, res: Response) => {
  const { roundId = 'round-1' } = req.body;
  try {
    const result = await db.distributeQuestionSetsToParticipants(roundId, db.currentUserId);
    res.json({ result, message: `Re-distributed question sets to ${result.updatedAssignmentsCount} active participants.` });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.get('/assignments/me', async (req: Request, res: Response) => {
  const user = resolveRequestUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const activeContest = db.getContest('active');
  const contestId = activeContest?.id || 'contest-1';
  const roundId = (req.query.roundId as string) || activeContest?.currentRoundId || 'round-1';
  const key = `${user.id}_${roundId}`;
  
  // Call db.getOrAssignQuestionSet to get or assign question set
  const assigned = db.getOrAssignQuestionSet(contestId, user.id, roundId);
  let assignment = db.assignments.get(key) || db.assignments.get(`${user.id}_${contestId}`);

  if (assignment && (!assignment.setId || assignment.setId === 'undefined')) {
    assignment.setId = assigned.setId || 'Set A';
    db.assignments.set(key, assignment);
  }

  res.json({ assignment });
});

apiRouter.get('/assignments', async (req: Request, res: Response) => {
  const assignments = Array.from(db.assignments.values()).map(a => ({
    ...a,
    user: db.users.get(a.userId) || null
  }));
  res.json({ assignments });
});

// Real Execution Health Probe Endpoint
apiRouter.get('/execution/judge0-health', async (_req: Request, res: Response) => {
  try {
    const health = await checkDirectJudge0Health();
    res.status(health.reachable ? 200 : 503).json(health);
  } catch (err: any) {
    res.status(500).json({
      reachable: false,
      status: null,
      provider: 'Judge0 CE',
      endpoint: 'https://ce.judge0.com',
      error: err.message || 'Judge0 health check failed'
    });
  }
});

apiRouter.get('/execution/health', async (_req: Request, res: Response) => {
  try {
    const health = await getExecutionHealth();
    res.json(health);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Execution service check failed' });
  }
});

apiRouter.get('/execution/languages', async (_req: Request, res: Response) => {
  try {
    const health = await getExecutionHealth();
    res.json({ languages: health.supportedLanguages || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch languages' });
  }
});

// Code Run (Sample Test Case sandbox without queue)
const handleCodeRun = async (req: Request, res: Response) => {
  const { problemId, code, sourceCode, language } = req.body;
  const actualCode = code || sourceCode;
  const rawProblem = db.problems.get(problemId);
  if (!rawProblem) return res.status(404).json({ error: 'Problem not found' });
  if (!actualCode || !language) return res.status(400).json({ error: 'Code and language are required' });

  const problem = ensureFiveTestCases(rawProblem);
  const sampleCases = problem.sampleTestCases.slice(0, 2);

  try {
    const result = await CodeJudge.evaluate({
      code: actualCode,
      language,
      testCases: sampleCases,
      timeLimitMs: problem.timeLimitMs,
      memoryLimitMb: problem.memoryLimitMb
    });

    result.score = 0; // Run Code does not award permanent contest marks
    result.totalTests = 2; // Exactly 2 sample test cases
    result.testCaseResults = (result.testCaseResults || []).slice(0, 2);

    res.json({ result });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Execution failed' });
  }
};

apiRouter.post('/code/run-sample', handleCodeRun);
apiRouter.post('/code/run', handleCodeRun);
apiRouter.post('/execution/run', handleCodeRun);

// Code Submission (Dispatches to 4-worker queue)
const handleCodeSubmit = async (req: Request, res: Response) => {
  const { problemId, code, language, roundId } = req.body;
  const activeContest = db.getContest('active');
  const targetRoundId = roundId || activeContest?.currentRoundId || 'round-1';
  const user = resolveRequestUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  // Verify anti-cheat lock
  const sec = db.securityStates.get(`${user.id}_${targetRoundId}`);
  if (sec?.sessionTerminated && !sec.adminOverridden) {
    return res.status(403).json({ error: 'Session is terminated due to anti-cheat violation.' });
  }

  // Verify attempt expiry
  const reqContestId = req.body.contestId || (req.query.contestId as string);
  const contestId = reqContestId || activeContest?.id || '';
  let attempt = db.getAttempt(contestId, user.id);
  if (!attempt && contestId) {
    attempt = db.getOrCreateAttempt(contestId, user.id);
  }

  if (attempt) {
    const serverNow = Date.now();
    let expiryTimeMs = attempt.expiresAt ? new Date(attempt.expiresAt).getTime() : (attempt.contestEndTime ? new Date(attempt.contestEndTime).getTime() : 0);
    if (expiryTimeMs > 0 && serverNow >= expiryTimeMs) {
      if (attempt.status === 'IN_PROGRESS' || attempt.status === 'ACTIVE' || attempt.status === 'PREPARING' || attempt.status === 'NOT_STARTED' || attempt.status === 'EXPIRED') {
        // Auto-heal attempt expiry for active contestants so legitimate submissions are never rejected
        const freshExpiry = new Date(serverNow + 120 * 60 * 1000).toISOString();
        attempt.expiresAt = freshExpiry;
        attempt.contestEndTime = freshExpiry;
        attempt.status = 'IN_PROGRESS';
        db.attempts.set(`${attempt.contestId}_${user.id}`, attempt);
      } else {
        db.updateAttemptStatus(attempt.contestId, user.id, 'EXPIRED', 'Attempt time expired.');
        return res.status(403).json({
          error: 'ATTEMPT_EXPIRED',
          message: 'Contest attempt has expired. Submissions are no longer accepted.'
        });
      }
    }
  }

  const rawProblem = db.problems.get(problemId);
  if (!rawProblem) return res.status(404).json({ error: 'Problem not found' });
  const problem = ensureFiveTestCases(rawProblem);

  const finalContestId = attempt?.contestId || contestId;
  const subId = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const submission: Submission = {
    id: subId,
    userId: user.id,
    userName: user.name,
    problemId,
    roundId: targetRoundId,
    contestId: finalContestId,
    attemptId: attempt?.id || `att-${finalContestId}-${user.id}`,
    batchId: user.batchId,
    language,
    code,
    status: 'QUEUED',
    passedTests: 0,
    totalTests: 5,
    score: 0,
    maxScore: problem.points,
    executionTimeMs: 0,
    memoryUsedMb: 0,
    submittedAt: new Date().toISOString(),
    testCaseResults: []
  };

  db.submissions.set(subId, submission);
  submissionQueue.enqueue(subId);

  res.json({ submissionId: subId, status: 'QUEUED' });
};

apiRouter.post('/code/submit', handleCodeSubmit);
apiRouter.post('/submissions', handleCodeSubmit);

apiRouter.get('/submissions/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const sub = db.submissions.get(id);
  if (!sub) return res.status(404).json({ error: 'Submission not found' });
  res.json({ submission: sub });
});

apiRouter.get('/submissions', async (req: Request, res: Response) => {
  const { userId, problemId, roundId, contestId } = req.query;
  let list = Array.from(db.submissions.values());
  if (userId) list = list.filter(s => s.userId === userId);
  if (problemId) list = list.filter(s => s.problemId === problemId);
  if (roundId) list = list.filter(s => s.roundId === roundId);
  if (contestId) list = list.filter(s => s.contestId === contestId);
  res.json({ submissions: list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()) });
});

// Contest Attempts & Autosave Endpoints
apiRouter.get('/attempts/me', async (req: Request, res: Response) => {
  const user = resolveRequestUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const activeContest = db.getContest('active');
  const contestId = (req.query.contestId as string) || activeContest?.id || '';
  let attempt = contestId ? await db.getAttempt(contestId, user.id) : null;

  res.json({ attempt: attempt || null });
});

apiRouter.post(['/attempts/start', '/contests/:contestId/start'], async (req: Request, res: Response) => {
  try {
    const user = resolveRequestUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized: user session not found' });

    const activeContest = db.getContest('active');
    const contestId = String(req.params.contestId || req.body.contestId || activeContest?.id || '');
    if (!contestId) {
      return res.status(400).json({ error: 'Contest ID is required' });
    }

    const contestObj = db.getContest(contestId);

    // 1. Check in-memory attempt cache first
    const existing = await db.getAttempt(contestId, user.id);
    if (existing) {
      const isTerminal = ['COMPLETED', 'SUBMITTED', 'AUTO_SUBMITTED', 'EXPIRED', 'DISQUALIFIED', 'TERMINATED_ADMIN'].includes(existing.status);
      if (isTerminal) {
        console.warn(`[CONTEST_ATTEMPT] Blocked duplicate start for student=${user.studentId || user.id} contest=${contestId} existingAttempt=${existing.id}`);
        return res.status(409).json({
          success: false,
          code: 'CONTEST_ALREADY_ATTEMPTED',
          error: 'CONTEST_ALREADY_ATTEMPTED',
          message: 'You have already attended this contest. Only one attempt is permitted per student.',
          attemptId: existing.id,
          status: existing.status
        });
      }

      // If active, in-progress, we return the existing attempt so the student resumes smoothly.
      // We explicitly DO NOT extend the timer if they reload or re-login.
      // If the timer is expired, it will be handled by auto-submit logic on the client/backend.
      console.log(`[CONTEST_ATTEMPT] Returning existing attempt for student=${user.studentId || user.id} contest=${contestId} status=${existing.status}`);
      return res.json({
        success: true,
        attempt: existing,
        resumed: true
      });
    }

    // 2. Check MongoDB directly for absolute concurrency and unique constraint safety
    const dbExisting = await ContestAttempt.findOne({
      $or: [
        { studentId: user.studentId || user.id, contestId },
        { participantId: user.id, contestId }
      ]
    }).lean();

    if (dbExisting) {
      const existingObj = { ...dbExisting, id: dbExisting.id || (dbExisting as any)._id?.toString() } as any;
      db.attempts.set(`${contestId}_${user.id}`, existingObj);
      const isTerminal = ['COMPLETED', 'SUBMITTED', 'AUTO_SUBMITTED', 'EXPIRED', 'DISQUALIFIED', 'TERMINATED_ADMIN'].includes(existingObj.status);
      if (isTerminal) {
        console.warn(`[CONTEST_ATTEMPT] Blocked duplicate start from MongoDB for student=${user.studentId || user.id} contest=${contestId}`);
        return res.status(409).json({
          success: false,
          code: 'CONTEST_ALREADY_ATTEMPTED',
          error: 'CONTEST_ALREADY_ATTEMPTED',
          message: 'You have already attended this contest. Only one attempt is permitted per student.',
          attemptId: existingObj.id,
          status: existingObj.status
        });
      }

      console.log(`[CONTEST_ATTEMPT] Returning existing attempt from MongoDB for student=${user.studentId || user.id} contest=${contestId} status=${existingObj.status}`);
      return res.json({
        success: true,
        attempt: existingObj,
        resumed: true
      });
    }

    const { roundId, termsAccepted } = req.body;
    const targetRoundId = roundId || contestObj?.currentRoundId || 'round-1';

    // 3. Delegate to startContestAttempt (assigns Question Set A, B, or C randomly once and persists)
    const attempt = await db.startContestAttempt(
      contestId,
      user.id,
      user.batchId || 'batch-1',
      targetRoundId,
      termsAccepted ?? true
    );

    // 4. Upsert/create in MongoDB and catch E11000 duplicate key error
    try {
      await ContestAttempt.findOneAndUpdate(
        {
          $or: [
            { studentId: user.studentId || user.id, contestId },
            { participantId: user.id, contestId }
          ]
        },
        { $set: attempt },
        { upsert: true, new: true }
      );
    } catch (mongoErr: any) {
      if (mongoErr.code === 11000 || mongoErr.message?.includes('duplicate key') || mongoErr.message?.includes('E11000')) {
        return res.status(409).json({
          success: false,
          code: 'CONTEST_ALREADY_ATTEMPTED',
          error: 'CONTEST_ALREADY_ATTEMPTED',
          message: 'You have already attended this contest. Only one attempt is permitted per student.',
          attemptId: attempt.id,
          status: attempt.status
        });
      }
      throw mongoErr;
    }

    res.json({ success: true, attempt });
  } catch (e: any) {
    console.error('Error starting attempt:', e);
    if (e.message?.includes('already attended') || e.message?.includes('already started') || e.message?.includes('CONTEST_ALREADY_ATTEMPTED')) {
      return res.status(409).json({
        success: false,
        code: 'CONTEST_ALREADY_ATTEMPTED',
        error: 'CONTEST_ALREADY_ATTEMPTED',
        message: 'You have already attended this contest. Only one attempt is permitted per student.'
      });
    }
    res.status(500).json({ error: e.message || 'Internal server error while starting attempt' });
  }
});

apiRouter.post('/attempts/transition-active', async (req: Request, res: Response) => {
  try {
    const user = resolveRequestUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const activeContest = db.getContest('active');
    const contestId = req.body.contestId || activeContest?.id || '';
    const attempt = await db.transitionAttemptToActive(contestId, user.id);
    res.json({ attempt });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to activate contest attempt' });
  }
});

apiRouter.post('/attempts/deadline-submit', async (req: Request, res: Response) => {
  const user = resolveRequestUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const activeContest = db.getContest('active');
  const contestId = req.body.contestId || activeContest?.id || '';
  const { roundId, reason } = req.body;
  const targetRoundId = roundId || activeContest?.currentRoundId || 'round-1';
  const submissions = await db.autoSubmitAttempt(
    contestId,
    user.id,
    targetRoundId,
    reason || 'Contest deadline reached / Session auto-submitted',
    'AUTO_DEADLINE'
  );

  submissions.forEach(s => {
    submissionQueue.enqueue(s.id);
  });

  const attempt = await db.getAttempt(contestId, user.id);
  res.json({ success: true, attempt, submissions });
});

// System Clean Reset Endpoint
apiRouter.post('/admin/system/reset-contest-data', async (req: Request, res: Response) => {
  try {
    const result = await executeContestDataCleanReset();
    res.json({ success: true, message: 'All contest and attempt data cleanly reset. Users preserved.', ...result });
  } catch (e: any) {
    console.error('Reset error:', e);
    res.status(500).json({ error: e.message || 'Failed to execute clean reset' });
  }
});

// System Data Integrity Verification
apiRouter.get('/admin/system/data-integrity', async (req: Request, res: Response) => {
  try {
    const [
      challenges,
      contests,
      questionSets,
      questionAssignments,
      contestAttempts,
      submissions
    ] = await Promise.all([
      Challenge.countDocuments(),
      Contest.countDocuments(),
      QuestionSet.countDocuments(),
      QuestionAssignment.countDocuments(),
      ContestAttempt.countDocuments(),
      SubmissionModel.countDocuments()
    ]);

    let attemptIndexes: any[] = [];
    try {
      attemptIndexes = await ContestAttempt.collection.indexes();
    } catch {
      // ignore
    }

    res.json({
      database: {
        challenges,
        contests,
        questionSets,
        questionAssignments,
        contestAttempts,
        submissions
      },
      memory: {
        problems: db.problems.size,
        challenges: db.challenges.size,
        contests: db.contests.size,
        questionSets: db.questionSets.size,
        assignments: db.assignments.size,
        attempts: db.attempts.size,
        submissions: db.submissions.size
      },
      indexes: attemptIndexes
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

apiRouter.post('/auth/session/heartbeat', async (req: Request, res: Response) => {
  const reqUser = resolveRequestUser(req);
  const userId = req.body.userId || reqUser?.id || (Array.isArray(req.headers['x-user-id']) ? req.headers['x-user-id'][0] : req.headers['x-user-id']);
  const sessionId = req.body.sessionId || (Array.isArray(req.headers['x-session-id']) ? req.headers['x-session-id'][0] : req.headers['x-session-id']);

  if (!userId || !sessionId) {
    return res.status(400).json({ active: false, error: 'Missing userId or sessionId' });
  }

  const result = db.updateSessionHeartbeat(userId, sessionId);
  if (!result.success) {
    return res.status(401).json({
      active: false,
      conflict: true,
      code: 'SESSION_EXPIRED',
      message: 'Your session has expired or was ended on another device.'
    });
  }

  return res.json({ active: true, lastSeenAt: result.lastSeenAt, timestamp: new Date().toISOString() });
});

apiRouter.post('/auth/logout', async (req: Request, res: Response) => {
  const reqUser = resolveRequestUser(req);
  const userId = req.body.userId || reqUser?.id || (Array.isArray(req.headers['x-user-id']) ? req.headers['x-user-id'][0] : req.headers['x-user-id']);
  const sessionId = req.body.sessionId || (Array.isArray(req.headers['x-session-id']) ? req.headers['x-session-id'][0] : req.headers['x-session-id']);

  if (userId) {
    db.clearSession(userId, sessionId, 'USER_LOGOUT');
  }
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// Admin Active Sessions Management
apiRouter.get('/admin/sessions', async (req: Request, res: Response) => {
  const user = resolveRequestUser(req);
  if (!user || user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }

  const sessions = db.getAllActiveSessions();
  return res.json({ success: true, sessions });
});

apiRouter.post('/admin/sessions/force-logout', async (req: Request, res: Response) => {
  const user = resolveRequestUser(req);
  if (!user || user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }

  const { studentId, sessionId } = req.body;
  if (!studentId) {
    return res.status(400).json({ error: 'Missing studentId parameter' });
  }

  const cleared = db.clearSession(studentId, sessionId, 'ADMIN_FORCE_LOGOUT');
  await db.logAudit('ADMIN_FORCE_LOGOUT', user.id, `Admin ${user.name} (${user.id}) force logged out active session for student ${studentId}.`);

  return res.json({
    success: true,
    message: cleared ? 'Student session force logged out successfully.' : 'No active session found to terminate.'
  });
});

// Final Submit Handler
const handleFinalSubmit = async (req: Request, res: Response) => {
  const user = resolveRequestUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const contestId = (Array.isArray(req.params.contestId) ? req.params.contestId[0] : req.params.contestId) || db.contest.id;
  const { isAutoSubmit, codeMap, roundId } = req.body;
  const targetRoundId = roundId || db.contest.currentRoundId || 'round-1';

  let attempt = db.getAttempt(contestId, user.id);
  if (!attempt) {
    attempt = db.getOrCreateAttempt(contestId, user.id, user.batchId, targetRoundId);
  }

  // Double submission check
  if (attempt.status === 'SUBMITTING' || attempt.status === 'AUTO_SUBMITTING') {
    return res.status(409).json({
      error: 'SUBMISSION_ALREADY_IN_PROGRESS',
      message: 'Your test submission is currently being evaluated. Please wait.'
    });
  }

  if (
    attempt.status === 'SUBMITTED' ||
    attempt.status === 'AUTO_SUBMITTED' ||
    attempt.status === 'COMPLETED' ||
    attempt.status === 'LOCKED'
  ) {
    return res.status(409).json({
      error: 'SUBMISSION_ALREADY_COMPLETED',
      message: 'This contest attempt has already been submitted and evaluated.'
    });
  }

  // Atomic state transition: IN_PROGRESS -> SUBMITTING
  attempt.status = isAutoSubmit ? 'AUTO_SUBMITTING' : 'SUBMITTING';
  db.attempts.set(`${contestId}_${user.id}`, attempt);

  try {
    // Save any latest code provided in codeMap
    if (codeMap && typeof codeMap === 'object') {
      for (const [probId, cData] of Object.entries(codeMap)) {
        const cString = typeof cData === 'string' ? cData : (cData as any)?.code || '';
        const cLang = (cData as any)?.language || 'python';
        db.saveCodeSnapshot(contestId, user.id, probId, cString, cLang);
      }
    }

    // Get assigned problem set for student
    const assignKey = `${user.id}_${targetRoundId}`;
    let assignment = db.assignments.get(assignKey);
    let problemIds: string[] = assignment?.problemIds || [];

    if (problemIds.length === 0) {
      problemIds = Array.from(db.problems.keys()).slice(0, 3);
    }

    let easyScore = 0;
    let mediumScore = 0;
    let hardScore = 0;

    // Evaluate each problem in assigned set
    for (const probId of problemIds) {
      const rawProb = db.problems.get(probId);
      if (!rawProb) continue;

      const prob = ensureFiveTestCases(rawProb);
      const diff = (prob.difficulty || 'MEDIUM').toUpperCase();
      const marksPerTest = diff === 'EASY' ? 2 : diff === 'HARD' ? 5 : 3;
      const maxMarks = diff === 'EASY' ? 10 : diff === 'HARD' ? 25 : 15;

      const snap = attempt.codeSnapshots?.[probId];
      const codeToEval = snap?.code || '';
      const langToEval = snap?.language || 'python';

      let passedCount = 0;
      let testResults: any[] = [];
      let earnedMarks = 0;

      if (!codeToEval || codeToEval.trim() === '') {
        // Unattempted question: 0 marks
        passedCount = 0;
        earnedMarks = 0;
        testResults = Array.from({ length: 5 }, (_, idx) => ({
          testCaseId: `tc-${probId}-${idx + 1}`,
          status: 'WRONG_ANSWER',
          executionTimeMs: 0,
          memoryUsedMb: 0,
          isHidden: idx >= 2
        }));
      } else {
        // Combine 2 sample + 3 hidden = EXACTLY 5 test cases
        const sampleCases = prob.sampleTestCases.slice(0, 2);
        const hiddenCases = prob.hiddenTestCases.slice(0, 3);
        const allTestCases = [...sampleCases, ...hiddenCases];

        const evalResult = await CodeJudge.evaluate({
          code: codeToEval,
          language: langToEval,
          testCases: allTestCases,
          timeLimitMs: prob.timeLimitMs,
          memoryLimitMb: prob.memoryLimitMb
        });

        passedCount = evalResult.passedTests;
        earnedMarks = passedCount * marksPerTest;
        testResults = (evalResult.testCaseResults || []).slice(0, 5);
      }

      const subId = `sub-final-${user.id}-${probId}-${Date.now()}`;
      const subRecord: Submission = {
        id: subId,
        userId: user.id,
        userName: user.name,
        problemId: probId,
        roundId: targetRoundId,
        contestId,
        attemptId: attempt.id,
        batchId: user.batchId,
        language: langToEval,
        code: codeToEval,
        status: (earnedMarks === maxMarks ? 'ACCEPTED' : 'WRONG_ANSWER') as any,
        passedTests: passedCount,
        totalTests: 5,
        score: earnedMarks,
        maxScore: maxMarks,
        executionTimeMs: 0,
        memoryUsedMb: 0,
        submittedAt: new Date().toISOString(),
        testCaseResults: testResults
      };
      db.submissions.set(subId, subRecord);

      const qrKey = `${attempt.id}_${probId}`;
      db.questionResults.set(qrKey, {
        id: `qr-${attempt.id}-${probId}`,
        studentId: user.studentId || user.id,
        contestId,
        attemptId: attempt.id,
        problemId: probId,
        difficulty: diff,
        passedTestCases: passedCount,
        totalTestCases: 5,
        marksEarned: earnedMarks,
        maxMarks,
        status: earnedMarks === maxMarks ? 'ACCEPTED' : 'WRONG_ANSWER',
        testCaseResults: testResults,
        evaluatedAt: new Date().toISOString()
      });

      if (diff === 'EASY') easyScore = earnedMarks;
      else if (diff === 'HARD') hardScore = earnedMarks;
      else mediumScore = earnedMarks;
    }

    const totalScore = Math.min(50, easyScore + mediumScore + hardScore);

    // Finalize transition -> SUBMITTED or AUTO_SUBMITTED
    attempt.status = isAutoSubmit ? 'AUTO_SUBMITTED' : 'SUBMITTED';
    attempt.endedAt = new Date().toISOString();
    attempt.submittedAt = attempt.endedAt;
    attempt.updatedAt = new Date().toISOString();
    attempt.easyScore = easyScore;
    attempt.mediumScore = mediumScore;
    attempt.hardScore = hardScore;
    attempt.totalScore = totalScore;
    attempt.submissionType = isAutoSubmit ? 'TIME_EXPIRY' : 'MANUAL_RETURN';

    db.attempts.set(`${contestId}_${user.id}`, attempt);

    await db.logAudit(
      isAutoSubmit ? 'AUTO_SUBMIT' : 'MANUAL_SUBMIT',
      user.id,
      `Final submission completed. Total Score: ${totalScore}/50 (Easy: ${easyScore}, Med: ${mediumScore}, Hard: ${hardScore})`,
      attempt.id
    );

    return res.json({
      success: true,
      easyScore,
      easyMax: 10,
      mediumScore,
      mediumMax: 15,
      hardScore,
      hardMax: 25,
      totalScore,
      totalMax: 50,
      attemptStatus: attempt.status,
      message: 'Test submitted successfully.'
    });
  } catch (err: any) {
    console.error('Error during final submit:', err);
    attempt.status = 'IN_PROGRESS';
    db.attempts.set(`${contestId}_${user.id}`, attempt);
    return res.status(500).json({ error: err.message || 'Final submission failed.' });
  }
};

apiRouter.post('/contests/:contestId/attempts/:attemptId/final-submit', handleFinalSubmit);
apiRouter.post(['/attempts/final-submit', '/attempts/submit', '/contests/:contestId/submit'], handleFinalSubmit);

apiRouter.post('/attempts/complete', async (req: Request, res: Response) => {
  const user = resolveRequestUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const activeContest = db.getContest('active');
  const contestId = req.body.contestId || activeContest?.id || '';
  const { roundId } = req.body;
  const targetRoundId = roundId || activeContest?.currentRoundId || 'round-1';
  const submissions = await db.autoSubmitAttempt(
    contestId,
    user.id,
    targetRoundId,
    'Contest submitted manually by participant',
    'AUTO_DEADLINE'
  );

  submissions.forEach(s => {
    submissionQueue.enqueue(s.id);
  });

  const attempt = await db.getAttempt(contestId, user.id);
  res.json({ success: true, attempt, submissions });
});

apiRouter.post('/attempts/autosave', async (req: Request, res: Response) => {
  const user = resolveRequestUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { problemId, code, language, contestId: reqContestId } = req.body;
  if (!problemId || code === undefined) {
    return res.status(400).json({ error: 'Missing problemId or code payload' });
  }

  const activeContest = db.getContest('active');
  const contestId = reqContestId || activeContest?.id || '';
  const attempt = await db.saveCodeSnapshot(contestId, user.id, problemId, code, language || 'python');
  res.json({ success: true, savedAt: new Date().toISOString(), attemptStatus: attempt.status });
});

// Anti-Cheat Endpoints
apiRouter.post('/anticheat/violation', async (req: Request, res: Response) => {
  const user = resolveRequestUser(req);
  const targetUserId = user ? user.id : db.currentUserId;
  const { type, details, roundId, metadata } = req.body;
  const activeContest = db.getContest('active');
  const targetRound = typeof roundId === 'string' ? roundId : (activeContest?.currentRoundId || 'round-1');
  const result = AntiCheatService.recordViolation(
    targetUserId,
    targetRound,
    type as any,
    String(details || 'Violation recorded'),
    metadata
  );
  res.json(result);
});

apiRouter.post('/security/events', async (req: Request, res: Response) => {
  const user = resolveRequestUser(req);
  const targetUserId = user ? user.id : db.currentUserId;
  const { eventType, details, roundId, metadata } = req.body;
  const activeContest = db.getContest('active');
  const targetRound = typeof roundId === 'string' ? roundId : (activeContest?.currentRoundId || 'round-1');
  const result = AntiCheatService.recordViolation(
    targetUserId,
    targetRound,
    eventType as any,
    String(details || 'Security event detected'),
    metadata
  );
  res.json(result);
});

apiRouter.get('/anticheat/matrix', async (req: Request, res: Response) => {
  const matrix = AntiCheatService.getSecurityMatrix();
  res.json({ securityMatrix: matrix });
});

// Legacy alias for anti-cheat matrix override handled by unified unlock route

// Leaderboard & Qualification
apiRouter.get('/admin/contests/:contestId/leaderboard', async (req: Request, res: Response) => {
  const user = resolveRequestUser(req);
  if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: 'Unauthorized. Admin only.' });

  const contestId = req.params.contestId as string;
  const targetContest = db.contests.get(contestId);
  if (!targetContest) return res.status(404).json({ error: 'Contest not found' });

  const roundId = (req.query.roundId as string) || targetContest.currentRoundId || 'round-1';
  // Use query batchId as primary if supplied, or fallback to contest's assigned batchId
  let reqBatchId = req.query.batchId as string;
  if (reqBatchId === undefined || reqBatchId === null || reqBatchId === '') {
    reqBatchId = targetContest.batchId || 'all';
  }

  // Also query Mongoose BatchMembership if available to get authoritative student IDs for this batch
  let batchStudentIds: string[] | undefined = undefined;
  if (reqBatchId && reqBatchId !== 'all') {
    try {
      const targetBatchObj = db.batches.get(reqBatchId) || Array.from(db.batches.values()).find(b => b.id === reqBatchId || b.name === reqBatchId || b.normalizedName === reqBatchId);
      const possibleBatchKeys = Array.from(new Set([reqBatchId, targetBatchObj?.id, targetBatchObj?.name, targetBatchObj?.normalizedName].filter(Boolean)));
      
      const memberships = await BatchMembership.find({ 
        batchId: { $in: possibleBatchKeys }
      }).lean();
      batchStudentIds = memberships.map(m => m.studentId);
    } catch (e) {
      console.warn("Could not query BatchMembership from Mongo:", e);
    }
  }

  const batchIdToPass = reqBatchId === 'all' ? undefined : reqBatchId;
  const leaderboard = QualificationEngine.getLeaderboardForContest(contestId, roundId, batchIdToPass, batchStudentIds);

  const targetBatchObj = reqBatchId !== 'all' ? (db.batches.get(reqBatchId) || Array.from(db.batches.values()).find(b => b.id === reqBatchId || b.name === reqBatchId || b.normalizedName === reqBatchId)) : undefined;

  res.json({
    contestId,
    batchId: reqBatchId,
    batchName: targetBatchObj?.name || (reqBatchId === 'all' ? 'All Batches' : reqBatchId),
    totalStudents: leaderboard.length,
    leaderboard
  });
});

apiRouter.get('/leaderboard', async (req: Request, res: Response) => {
  const activeContest = db.getContest('active');
  const contestId = (req.query.contestId as string) || activeContest?.id || '';
  const roundId = (req.query.roundId as string) || activeContest?.currentRoundId || 'round-1';
  const batchId = req.query.batchId as string;

  let batchStudentIds: string[] | undefined = undefined;
  if (batchId && batchId !== 'all') {
    try {
      const memberships = await BatchMembership.find({ batchId }).lean();
      batchStudentIds = memberships.map(m => m.studentId);
    } catch (e) {
      console.warn("Could not query BatchMembership from Mongo:", e);
    }
  }

  const batchIdToPass = batchId === 'all' ? undefined : batchId;
  const leaderboard = contestId 
    ? QualificationEngine.getLeaderboardForContest(contestId, roundId, batchIdToPass, batchStudentIds)
    : QualificationEngine.getLeaderboard(roundId, batchIdToPass, batchStudentIds);
  res.json({ leaderboard });
});

apiRouter.post('/qualification/finalize-round1', async (req: Request, res: Response) => {
  const { cutoffRank } = req.body;
  const result = QualificationEngine.finalizeRound1(db.currentUserId, cutoffRank || 15);
  res.json(result);
});

// Plagiarism Scanner
apiRouter.get('/plagiarism/scan', async (req: Request, res: Response) => {
  const problemId = req.query.problemId as string;
  const comparisons = PlagiarismScanner.scanAllPairs(problemId);
  res.json({ comparisons });
});

// ============================================================
// BATCH MANAGEMENT
// ============================================================

apiRouter.get('/admin/batches', async (req: Request, res: Response) => {
  try {
    const user = resolveRequestUser(req);
    console.log('[ADMIN AUTH DEBUG] { authenticated: ' + !!user + ', userId: ' + user?.id + ', role: ' + user?.role + ', route: "/api/admin/batches" }');
    if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: 'Unauthorized' });

    const batches = await Batch.find().sort({ name: 1 }).lean();
    const memberships = await BatchMembership.find().lean();
    const contests = await Contest.find({ batchId: { $ne: null } }).lean();

    const batchesWithCounts = batches.map(b => {
      const studentCount = memberships.filter(m => m.batchId === b.id).length;
      const contestCount = contests.filter(c => c.batchId === b.id).length;
      return {
        ...b,
        studentCount,
        contestCount
      };
    });

    res.json({ batches: batchesWithCounts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/admin/batches', async (req: Request, res: Response) => {
  try {
    const user = resolveRequestUser(req);
    if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: 'Unauthorized' });

    const { name } = req.body;
    if (!name || name.trim().length === 0) return res.status(400).json({ error: 'Batch name is required' });

    const normalizedName = name.trim().toLowerCase().replace(/\s+/g, '-');
    const existing = await Batch.findOne({ normalizedName }).lean();
    if (existing) return res.status(400).json({ error: 'A batch with this name already exists' });

    const id = `batch-${Date.now()}`;
    const newBatch = await Batch.create({
      id,
      name: name.trim(),
      normalizedName
    });

    res.status(201).json({ batch: newBatch });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/admin/batches/:batchId/students', async (req: Request, res: Response) => {
  try {
    const user = resolveRequestUser(req);
    if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: 'Unauthorized' });

    const batchId = req.params.batchId as string;
    const memberships = await BatchMembership.find({ batchId }).lean();
    const studentIds = memberships.map(m => m.studentId);
    
    // Fallback to in-memory users if they aren't fully synced, or query mongo
    const allUsers = Array.from(db.users.values());
    const students = allUsers.filter(u => studentIds.includes(u.id));

    res.json({ students });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/admin/batches/:batchId/students', async (req: Request, res: Response) => {
  try {
    const user = resolveRequestUser(req);
    if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: 'Unauthorized' });

    const batchId = req.params.batchId as string;
    const { studentIds } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) return res.status(400).json({ error: 'Student IDs required' });

    const batch = await Batch.findOne({ id: batchId }).lean();
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    for (const studentId of studentIds) {
      // Remove from any other batch first
      await BatchMembership.deleteMany({ studentId });
      
      // Update User object
      const u = db.users.get(studentId);
      if (u) {
        u.batchId = batchId;
        db.users.set(studentId, u);
      }
      await UserModel.updateOne({ id: studentId }, { $set: { batchId } });

      await BatchMembership.create({
        id: `bm-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        batchId,
        studentId,
        addedBy: user.id
      });
    }

    res.json({ success: true, message: `${studentIds.length} students added to ${batch.name}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/admin/batches/:batchId/students/:studentId', async (req: Request, res: Response) => {
  try {
    const user = resolveRequestUser(req);
    if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: 'Unauthorized' });

    const batchId = req.params.batchId as string; const studentId = req.params.studentId as string;
    
    await BatchMembership.deleteMany({ batchId, studentId });
    
    const u = db.users.get(studentId);
    if (u && u.batchId === batchId) {
      u.batchId = undefined;
      db.users.set(studentId, u);
      await UserModel.updateOne({ id: studentId }, { $unset: { batchId: "" } });
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// CHALLENGE AUTHORING & MANAGEMENT (MASTER PROBLEM ENGINE)
// ============================================================

apiRouter.get('/admin/challenges', async (req: Request, res: Response) => {
  const { difficulty, category, status, search, tag, language } = req.query;
  const challenges = await db.getChallenges({
    difficulty: difficulty as string,
    category: category as string,
    status: status as string,
    search: search as string,
    tag: tag as string,
    language: language as string
  });
  res.json({ challenges });
});

apiRouter.post('/admin/challenges', async (req: Request, res: Response) => {
  try {
    const challenge = await db.createChallenge(req.body, db.currentUserId);
    res.status(201).json({ challenge, message: `Challenge ${challenge.challengeCode} created in Draft status.` });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.get('/admin/challenges/:id', async (req: Request, res: Response) => {
  const challenge = await db.getChallenge(String(req.params.id));
  if (!challenge) {
    return res.status(404).json({ error: 'Challenge not found.' });
  }
  res.json({ challenge });
});

apiRouter.patch('/admin/challenges/:id', async (req: Request, res: Response) => {
  try {
    const updated = await db.updateChallenge(String(req.params.id), req.body, db.currentUserId);
    res.json({ challenge: updated, message: 'Challenge saved successfully.' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.delete('/admin/challenges/:id', async (req: Request, res: Response) => {
  try {
    const result = await db.deleteChallenge(String(req.params.id), db.currentUserId);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.post('/admin/challenges/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const duplicated = await db.duplicateChallenge(String(req.params.id), db.currentUserId);
    res.status(201).json({ challenge: duplicated, message: `Duplicated as ${duplicated.challengeCode}.` });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.post('/admin/challenges/:id/publish', async (req: Request, res: Response) => {
  try {
    const result = await db.publishChallenge(String(req.params.id), db.currentUserId);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.post('/admin/challenges/:id/archive', async (req: Request, res: Response) => {
  try {
    const archived = await db.archiveChallenge(String(req.params.id), db.currentUserId);
    res.json({ challenge: archived, message: `Challenge ${archived.challengeCode} has been archived.` });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

apiRouter.post('/admin/challenges/:id/test-cases', async (req: Request, res: Response) => {
  const { testCases } = req.body;
  if (!Array.isArray(testCases)) {
    return res.status(400).json({ error: 'testCases array is required.' });
  }
  try {
    const challenge = await db.saveChallengeTestCases(String(req.params.id), testCases, db.currentUserId);
    res.json({ challenge, testCases: challenge.testCases, message: 'Test cases updated successfully.' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Participant Safe Challenge Preview / Fetch
apiRouter.get('/challenges/:id/preview', async (req: Request, res: Response) => {
  const preview = await db.getParticipantSafeChallenge(String(req.params.id));
  if (!preview) {
    return res.status(404).json({ error: 'Challenge not found.' });
  }
  res.json({ challenge: preview });
});

// Load Simulator
apiRouter.post('/simulator/run', async (req: Request, res: Response) => {
  const { users } = req.body;
  const result = await ContestLoadSimulator.runSimulation(users || 50);
  res.json(result);
});

// System Health & Audit Logs
apiRouter.get('/health', async (req: Request, res: Response) => {
  res.json(submissionQueue.getHealth());
});

apiRouter.get('/audit-logs', async (req: Request, res: Response) => {
  res.json({ logs: db.auditLogs });
});
