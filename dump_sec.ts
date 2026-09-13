import { db } from './server/proxy.ts';

setTimeout(() => {
  const sec = Array.from(db.securityStates.values()).filter(s => s.participantId === 'usr-std-1789189701866-y0r3');
  console.log("Security States:", sec);
  process.exit(0);
}, 2000);
