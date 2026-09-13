import fs from 'fs';
let content = fs.readFileSync('server/db.ts', 'utf-8');

// Replace the top-level hashPassword function
content = content.replace(/export function hashPassword[\s\S]*?digest\('hex'\);\n\}/, `import bcrypt from 'bcryptjs';\nexport function hashPassword(password: string): string {\n  return bcrypt.hashSync(password, 10);\n}`);

fs.writeFileSync('server/db.ts', content);
console.log("Fixed hashPassword in db.ts");
