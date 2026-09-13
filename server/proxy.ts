import { db as originalDb } from './db.ts';
import {
  User,
  Contest,
  Challenge,
  QuestionSet,
  QuestionAssignment,
  StudentRegistration,
  Submission,
  ContestAttempt,
  QuestionResult,
  StudentSessionModel,
  Batch,
  BatchMembership
} from './models/index.ts';
import { connectMongoDB } from './mongo.ts';
import { seedOrRepairChallenges } from './services/seedChallenges.ts';
import bcrypt from 'bcryptjs';

let isMongoConnected = false;

const sanitizeDoc = (doc: any) => {
  if (!doc || typeof doc !== 'object') return doc;
  const copy = { ...doc };
  delete copy._id;
  return copy;
};

export const syncAllToMongoDB = async () => {
  if (!isMongoConnected) return;

  try {
    // 1. Sync Users
    const users = Array.from(originalDb.users.values()).map(u => ({ ...u, id: u.id || (u as any)._id?.toString() }));
    const userIds = users.map(u => u.id).filter(Boolean);
    await User.deleteMany({ id: { $nin: userIds } });
    for (const userDoc of users) {
      if (userDoc.id) {
        await User.updateOne({ id: userDoc.id }, { $set: sanitizeDoc(userDoc) }, { upsert: true });
      }
    }

    // 2. Sync Contests
    const contests = Array.from(originalDb.contests.values());
    const contestIds = contests.map(c => c.id).filter(Boolean);
    if (contestIds.length === 0) {
      await Contest.deleteMany({});
    } else {
      await Contest.deleteMany({ id: { $nin: contestIds } });
      for (const contestDoc of contests) {
        if (contestDoc.id) {
          await Contest.updateOne({ id: contestDoc.id }, { $set: sanitizeDoc(contestDoc) }, { upsert: true });
        }
      }
    }

    // 3. Sync Challenges/Problems
    const problems = Array.from(originalDb.problems.values());
    const problemIds = problems.map(p => p.id).filter(Boolean);
    if (problemIds.length === 0) {
      await Challenge.deleteMany({});
    } else {
      await Challenge.deleteMany({ id: { $nin: problemIds } });
      const ops = problems.map(probDoc => ({
        updateOne: {
          filter: { id: probDoc.id },
          update: { $set: sanitizeDoc(probDoc) },
          upsert: true
        }
      }));
      await Challenge.bulkWrite(ops);
    }

    // 4. Sync QuestionSets
    const qsetKeys = Array.from(originalDb.questionSets.keys());
    if (qsetKeys.length === 0) {
      await QuestionSet.deleteMany({});
    } else {
      await QuestionSet.deleteMany({ id: { $nin: qsetKeys } });
      let qIdx = 0;
      for (const [key, qset] of originalDb.questionSets.entries()) {
        let setName = (qset as any).setId || (qset as any).name;
        if (!setName || setName === 'undefined') {
          setName = `Set ${String.fromCharCode(65 + (qIdx % 26))}`;
        }
        qIdx++;
        await QuestionSet.updateOne(
          { id: key },
          { $set: sanitizeDoc({ ...qset, id: key, setId: setName, name: setName }) },
          { upsert: true }
        );
      }
    }

    // 5. Sync QuestionAssignments
    const assignKeys = Array.from(originalDb.assignments.keys());
    if (assignKeys.length === 0) {
      await QuestionAssignment.deleteMany({});
    } else {
      await QuestionAssignment.deleteMany({ id: { $nin: assignKeys } });
      let aIdx = 0;
      for (const [key, assign] of originalDb.assignments.entries()) {
        let setName = (assign as any).setId || (assign as any).name || (assign as any).setName;
        if (!setName || setName === 'undefined') {
          setName = `Set ${String.fromCharCode(65 + (aIdx % 3))}`;
        }
        aIdx++;
        await QuestionAssignment.updateOne(
          { id: key },
          { $set: sanitizeDoc({ ...assign, id: key, setId: setName }) },
          { upsert: true }
        );
      }
    }

    // 6. Sync StudentRegistrations
    const regKeys = Array.from(originalDb.registrations.keys());
    if (regKeys.length === 0) {
      await StudentRegistration.deleteMany({});
    } else {
      await StudentRegistration.deleteMany({ id: { $nin: regKeys } });
      for (const [key, reg] of originalDb.registrations.entries()) {
        await StudentRegistration.updateOne({ id: key }, { $set: sanitizeDoc({ ...reg, id: key }) }, { upsert: true });
      }
    }

    // 7. Sync Submissions
    const submissions = Array.from(originalDb.submissions.values());
    const subIds = submissions.map(s => s.id).filter(Boolean);
    if (subIds.length === 0) {
      await Submission.deleteMany({});
    } else {
      await Submission.deleteMany({ id: { $nin: subIds } });
      for (const subDoc of submissions) {
        if (subDoc.id) {
          await Submission.updateOne({ id: subDoc.id }, { $set: sanitizeDoc(subDoc) }, { upsert: true });
        }
      }
    }

    // 8. Sync ContestAttempts
    const attemptsList = Array.from(originalDb.attempts.values());
    const uniqueAttemptsMap = new Map<string, any>();
    attemptsList.forEach(a => {
      if (a && a.id) uniqueAttemptsMap.set(a.id, a);
    });
    const attIds = Array.from(uniqueAttemptsMap.keys());
    if (attIds.length === 0) {
      await ContestAttempt.deleteMany({});
    } else {
      await ContestAttempt.deleteMany({ id: { $nin: attIds } });
      for (const attDoc of uniqueAttemptsMap.values()) {
        await ContestAttempt.updateOne({ id: attDoc.id }, { $set: sanitizeDoc(attDoc) }, { upsert: true });
      }
    }

    // 9. Sync QuestionResults
    const qResults = Array.from(originalDb.questionResults.values());
    const qrIds = qResults.map(qr => qr.id).filter(Boolean);
    if (qrIds.length === 0) {
      await QuestionResult.deleteMany({});
    } else {
      await QuestionResult.deleteMany({ id: { $nin: qrIds } });
      for (const qrDoc of qResults) {
        if (qrDoc.id) {
          await QuestionResult.updateOne({ id: qrDoc.id }, { $set: sanitizeDoc(qrDoc) }, { upsert: true });
        }
      }
    }

    // 10. Sync Active Sessions
    if (originalDb.activeSessions.size === 0) {
      await StudentSessionModel.deleteMany({});
    } else {
      for (const [userId, sess] of originalDb.activeSessions.entries()) {
        if (sess && sess.sessionId) {
          await StudentSessionModel.updateOne({ sessionId: sess.sessionId }, { $set: sanitizeDoc(sess) }, { upsert: true });
        }
      }
    }

    // 11. Sync Batches
    const batchesArr = Array.from(originalDb.batches.values());
    const batchIds = batchesArr.map(b => b.id).filter(Boolean);
    if (batchIds.length === 0) {
      await Batch.deleteMany({});
    } else {
      await Batch.deleteMany({ id: { $nin: batchIds } });
      for (const bDoc of batchesArr) {
        if (bDoc.id) {
          await Batch.updateOne({ id: bDoc.id }, { $set: sanitizeDoc(bDoc) }, { upsert: true });
        }
      }
    }

    console.log('✅ Synchronized all data maps to MongoDB successfully.');
  } catch (err: any) {
    console.error('❌ Failed to sync to MongoDB:', err.message);
  }
};

let syncTimeout: NodeJS.Timeout | null = null;
export const scheduleSync = () => {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    syncAllToMongoDB();
  }, 100);
};

export const initializeDB = async () => {
  try {
    await connectMongoDB();
    isMongoConnected = true;
  } catch (err: any) {
    console.warn("MongoDB connection skipped or failed. Running in-memory.", err.message);
  }

  if (isMongoConnected) {
    try {
      const [users, contests, challenges, qsets, assignments, registrations, submissions, attempts, questionResults, sessions, dbBatches, dbMemberships] = await Promise.all([
        User.find().lean(),
        Contest.find().lean(),
        Challenge.find().lean(),
        QuestionSet.find().lean(),
        QuestionAssignment.find().lean(),
        StudentRegistration.find().lean(),
        Submission.find().lean(),
        ContestAttempt.find().lean(),
        QuestionResult.find().lean(),
        StudentSessionModel.find().lean(),
        Batch.find().lean(),
        BatchMembership.find().lean()
      ]);

      originalDb.users.clear();
      users.forEach((u: any) => {
        const id = u.id || u._id?.toString();
        if (id) originalDb.users.set(id, { ...u, id });
      });

      originalDb.batches.clear();
      dbBatches.forEach((b: any) => {
        const id = b.id || b._id?.toString();
        if (id) originalDb.batches.set(id, { ...b, id });
      });

      originalDb.batchMemberships.clear();
      dbMemberships.forEach((m: any) => {
        if (m.studentId && m.batchId) {
          const list = originalDb.batchMemberships.get(m.studentId) || [];
          if (!list.includes(m.batchId)) list.push(m.batchId);
          originalDb.batchMemberships.set(m.studentId, list);

          // Authoritative sync to user object in memory
          const userObj = originalDb.users.get(m.studentId);
          if (userObj) {
            userObj.batchId = m.batchId;
            originalDb.users.set(m.studentId, userObj);
          }
        }
      });

      originalDb.contests.clear();
      contests.forEach((c: any) => {
        const id = c.id || c._id?.toString();
        if (id) originalDb.contests.set(id, { ...c, id });
      });

      originalDb.problems.clear();
      challenges.forEach((c: any) => {
        const id = c.id || c._id?.toString();
        if (id) originalDb.problems.set(id, { ...c, id });
      });

      originalDb.questionSets.clear();
      qsets.forEach((q: any, idx: number) => {
        const id = q.id && q.id !== 'undefined' ? q.id : `set-r1-${idx}`;
        let setName = q.setId || q.name;
        if (!setName || setName === 'undefined') {
          setName = `Set ${String.fromCharCode(65 + (idx % 26))}`;
        }
        const cleanedSet = { ...q, id, setId: setName, name: setName };
        originalDb.questionSets.set(id, cleanedSet);
      });

      originalDb.assignments.clear();
      assignments.forEach((a: any, idx: number) => {
        const id = a.id && a.id !== 'undefined' ? a.id : `${a.userId}_${a.roundId || 'round-1'}`;
        let setName = a.setId || a.name || a.setName;
        if (!setName || setName === 'undefined') {
          setName = `Set ${String.fromCharCode(65 + (idx % 3))}`;
        }
        const cleanedAssign = { ...a, id, setId: setName };
        originalDb.assignments.set(id, cleanedAssign);
        if (a.userId && a.roundId) {
          originalDb.assignments.set(`${a.userId}_${a.roundId}`, cleanedAssign);
        }
        if (a.userId && a.contestId) {
          originalDb.assignments.set(`${a.userId}_${a.contestId}`, cleanedAssign);
        }
      });

      originalDb.registrations.clear();
      registrations.forEach((r: any) => {
        const id = r.id || r._id?.toString();
        if (id) originalDb.registrations.set(id, r);
      });

      originalDb.submissions.clear();
      submissions.forEach((s: any) => {
        const id = s.id || s._id?.toString();
        if (id) originalDb.submissions.set(id, { ...s, id });
      });

      originalDb.attempts.clear();
      attempts.forEach((a: any) => {
        const id = a.id || a._id?.toString();
        if (id) {
          const attObj = { ...a, id };
          originalDb.attempts.set(id, attObj);
          if (a.contestId) {
            if (a.participantId) originalDb.attempts.set(`${a.contestId}_${a.participantId}`, attObj);
            if (a.studentId) originalDb.attempts.set(`${a.contestId}_${a.studentId}`, attObj);
          }
        }
      });

      originalDb.questionResults.clear();
      questionResults.forEach((qr: any) => {
        const id = qr.id || qr._id?.toString();
        const key = `${qr.attemptId}_${qr.problemId}`;
        if (id) {
          originalDb.questionResults.set(key, { ...qr, id });
        }
      });

      // Backfill missing contestId on submissions using attempt relationship
      for (const [subId, sub] of originalDb.submissions.entries()) {
        if (!sub.contestId && sub.attemptId) {
          const att = originalDb.attempts.get(sub.attemptId) || Array.from(originalDb.attempts.values()).find((a: any) => a.id === sub.attemptId);
          if (att && att.contestId) {
            sub.contestId = att.contestId;
            originalDb.submissions.set(subId, sub);
          }
        }
      }

      originalDb.activeSessions.clear();
      sessions.forEach((s: any) => {
        if (s.studentId && s.active) {
          originalDb.activeSessions.set(s.studentId, {
            ...s,
            loginAt: s.loginAt ? new Date(s.loginAt).toISOString() : new Date().toISOString(),
            lastSeenAt: s.lastSeenAt ? new Date(s.lastSeenAt).toISOString() : new Date().toISOString()
          });
        }
      });

      originalDb.normalizeContestTimings();

      await seedOrRepairChallenges();

      console.log(`Loaded from MongoDB: ${users.length} users, ${contests.length} contests, ${originalDb.problems.size} problems, ${submissions.length} submissions.`);
    } catch (e: any) {
      console.error("Failed to load data from MongoDB", e.message);
    }
  } else {
    originalDb.normalizeContestTimings();
  }

  // Ensure Admin account exists (using ADMIN_EMAIL / ADMIN_PASSWORD from env or default)
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@symposium.edu';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  const existingAdmin = Array.from(originalDb.users.values()).find(
    u => u.email?.toLowerCase() === adminEmail.toLowerCase() || u.role === 'ADMIN'
  );

  if (!existingAdmin) {
    const adminId = 'usr-admin-1';
    const hash = bcrypt.hashSync(adminPassword, 10);
    originalDb.users.set(adminId, {
      id: adminId,
      email: adminEmail,
      passwordHash: hash,
      password: hash,
      role: 'ADMIN',
      name: 'System Administrator',
      status: 'ACTIVE'
    } as any);
    scheduleSync();
  }
};

export const db = new Proxy(originalDb, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    if (typeof value === 'function') {
      const isMutation = /^(create|update|save|delete|duplicate|publish|archive|unpublish|bulk|auto|start|transition|logAudit|reset|record|lock|unlock|finalize)/i.test(prop.toString());
      if (isMutation) {
        return function(...args: any[]) {
          const result = value.apply(target, args);
          if (result && typeof result.then === 'function') {
            return result.then((res: any) => {
              scheduleSync();
              return res;
            });
          }
          scheduleSync();
          return result;
        };
      }
      return value.bind(target);
    }
    return value;
  }
});
