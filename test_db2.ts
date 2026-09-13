import { db } from './server/db';
console.log("Subs:", Array.from(db.submissions.values()).filter(s => s.userId === 'usr-std-1789189701866-y0r3').map(s => ({id: s.id, userId: s.userId, problemId: s.problemId, score: s.score})));
