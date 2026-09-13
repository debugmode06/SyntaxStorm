import fs from 'fs';
let content = fs.readFileSync('server/api.ts', 'utf-8');

// The login logic is around line 62.
// Let's replace the verification logic completely.
const newLoginLogic = `
    let isMatch = false;
    if (user.passwordHash) {
       isMatch = require('bcryptjs').compareSync(password, user.passwordHash);
    } else if (user.password) {
       // Legacy fallback just in case, but shouldn't happen with real data
       isMatch = require('bcryptjs').compareSync(password, user.password);
    }

    if (!isMatch) {
`;

// Replace everything from `const inputHash = hashPassword(password);` up to `if (!isMatch) {`
content = content.replace(/const inputHash = hashPassword\(password\);[\s\S]*?if \(!isMatch\) \{/, newLoginLogic);

fs.writeFileSync('server/api.ts', content);
console.log("Fixed auth");
