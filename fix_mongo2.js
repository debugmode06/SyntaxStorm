import fs from 'fs';
let content = fs.readFileSync('server/mongo.ts', 'utf-8');

// Ensure it throws
content = content.replace(/if \(\!uri\) \{[\s\S]*?\}/, `if (!uri) {\n    throw new Error('MONGODB_URI environment variable is missing.');\n  }`);
fs.writeFileSync('server/mongo.ts', content);
