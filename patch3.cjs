const fs = require('fs');
let code = fs.readFileSync('src/components/HomePortal.tsx', 'utf8');

code = code.replace(/} else \{\s*\/\/ Fallback synthetic attempt object[\s\S]*?updatedAt: prepStart\.toISOString\(\)\n\s*\}\);\n\s*\}/g, '} else { throw new Error("No attempt returned from API"); }');
fs.writeFileSync('src/components/HomePortal.tsx', code);
