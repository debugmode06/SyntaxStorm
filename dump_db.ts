import { db } from './server/proxy.ts';
import fs from 'fs';

setTimeout(() => {
  const attempts = Array.from(db.attempts.values()).filter(a => a.participantId === 'usr-std-1789189701866-y0r3');
  console.log("Attempts:", attempts);
  const subs = Array.from(db.submissions.values()).filter(s => s.userId === 'usr-std-1789189701866-y0r3');
  console.log("Submissions:", subs);
  process.exit(0);
}, 2000);
