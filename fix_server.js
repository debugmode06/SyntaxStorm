import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');
content = content.replace(/import \{ apiRouter \} from '\.\/server\/api\.ts';/, "import { apiRouter } from './server/api.ts';\nimport { initializeDB } from './server/proxy.ts';");
content = content.replace(/async function startServer\(\) \{/, "async function startServer() {\n  try {\n    await initializeDB();\n    console.log('Database initialized');\n  } catch (e) {\n    console.error('Failed to initialize database', e);\n    process.exit(1);\n  }\n");
fs.writeFileSync('server.ts', content);
