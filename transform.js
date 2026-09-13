import fs from 'fs';
let apiContent = fs.readFileSync('server/api.ts', 'utf-8');

// We want to transform db.method(...) into (await db.method(...))
// We'll use a simple regex approach first, or just replace known methods.
const methods = [
  'getContests', 'getContest', 'createNewContest', 'updateContest', 'saveContestDraft',
  'duplicateContest', 'publishContest', 'deleteContest', 'getUsers', 'getUser',
  'getUserByEmail', 'createUser', 'updateUser', 'deleteUser', 'saveContestSets',
  'getProblems', 'getProblem', 'createProblem', 'updateProblem', 'deleteProblem',
  // we will extract all methods from db.ts
];

const dbContent = fs.readFileSync('server/db.ts', 'utf-8');
const methodRegex = /^\s+([a-zA-Z0-9_]+)\(/gm;
let match;
const allMethods = new Set();
while ((match = methodRegex.exec(dbContent)) !== null) {
  allMethods.add(match[1]);
}

// Convert api.ts route handlers to async
apiContent = apiContent.replace(/apiRouter\.(get|post|put|patch|delete)\('([^']+)',\s*\(req(: [^,]+)?, res(: [^)]+)?\)\s*=>\s*{/g, "apiRouter.$1('$2', async (req$3, res$4) => {");

// Replace db.method(...) with await db.method(...)
allMethods.forEach(method => {
  const regex = new RegExp(`db\\.${method}\\(`, 'g');
  apiContent = apiContent.replace(regex, `await db.${method}(`);
});

fs.writeFileSync('server/api_async.ts', apiContent);
console.log("Transformed api.ts -> api_async.ts");
