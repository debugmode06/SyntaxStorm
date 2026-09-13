import fs from 'fs';

// 1. Fix mongo.ts
let mongoContent = fs.readFileSync('server/mongo.ts', 'utf-8');
mongoContent = mongoContent.replace(/process\.exit\(1\);/g, "throw new Error('MongoDB configuration missing or connection failed');");
fs.writeFileSync('server/mongo.ts', mongoContent);

// 2. Fix server.ts to not exit
let serverContent = fs.readFileSync('server.ts', 'utf-8');
serverContent = serverContent.replace(/process\.exit\(1\);/g, "console.warn('Continuing with purely in-memory transient data.');");
fs.writeFileSync('server.ts', serverContent);

console.log("Fixed server.ts and mongo.ts");
