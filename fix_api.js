import fs from 'fs';
let content = fs.readFileSync('server/api.ts', 'utf-8');

content = content.replace(/import \{ db, hashPassword \} from '\.\/db\.ts';/, "import { hashPassword } from './db.ts';\nimport { db } from './proxy.ts';");
content = content.replace(/\(await db\.getContest\(\)\)\.currentRoundId/g, "(await db.getContest(db.contest.id)).currentRoundId");
content = content.replace(/\(await db\.getContest\(\)\)\.id/g, "db.contest.id");
content = content.replace(/await db\.getUser\(a\.userId\)/g, "db.users.get(a.userId)");
content = content.replace(/await db\.getUsers\(\)/g, "Array.from(db.users.values())");
// Wait, my `proxy.ts` still intercepts properties!
// But if `proxy` returns a Promise for properties? No, proxy `get` returns functions as they are, but properties as they are!
// This means `db.users.get` STILL WORKS because `db.users` is a Map!
// Why did I change them to `getUsers()` in `api.ts`? 
// Because I thought I would replace the Maps with Mongoose models directly. 
// BUT if I keep the Maps in memory and just use them as caches synced to Mongoose, I don't need ANY of these changes in api.ts!!!
