import { db } from './server/db';
console.log("Subs:", Array.from(db.submissions.values()).filter(s => s.userId === 'user8' || s.userName === 'user8').map(s => ({id: s.id, userId: s.userId, problemId: s.problemId, score: s.score})));
