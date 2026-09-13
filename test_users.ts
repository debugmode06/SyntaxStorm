import { db } from './server/db';
const users = Array.from(db.users.values()).filter(u => u.role === 'PARTICIPANT');
console.log(users.map(u => ({ id: u.id, name: u.name, batch: u.batchId })));
