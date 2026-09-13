import fs from 'fs';
let content = fs.readFileSync('server/proxy.ts', 'utf-8');
content = content.replace(/this === receiver \? target : this/g, 'target');
fs.writeFileSync('server/proxy.ts', content);
