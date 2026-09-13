import fs from 'fs';
let apiContent = fs.readFileSync('server/api.ts', 'utf-8');

// Replace map values accesses with async getters
apiContent = apiContent.replace(/Array\.from\(db\.users\.values\(\)\)/g, "(await db.getUsers())");
apiContent = apiContent.replace(/Array\.from\(db\.registrations\.values\(\)\)/g, "(await db.getRegistrations())");
apiContent = apiContent.replace(/Array\.from\(db\.batches\.values\(\)\)/g, "(await db.getBatches())");
apiContent = apiContent.replace(/Array\.from\(db\.rounds\.values\(\)\)/g, "(await db.getRounds())");
apiContent = apiContent.replace(/Array\.from\(db\.problems\.values\(\)\)/g, "(await db.getProblems())");
apiContent = apiContent.replace(/Array\.from\(db\.questionSets\.values\(\)\)/g, "(await db.getQuestionSets())");
apiContent = apiContent.replace(/Array\.from\(db\.assignments\.values\(\)\)/g, "(await db.getAssignments())");
apiContent = apiContent.replace(/Array\.from\(db\.submissions\.values\(\)\)/g, "(await db.getSubmissions())");

// Replace map gets
apiContent = apiContent.replace(/db\.users\.get\(([^)]+)\)/g, "(await db.getUser($1))");
apiContent = apiContent.replace(/db\.securityStates\.get\(([^)]+)\)/g, "(await db.getSecurityState($1))");
apiContent = apiContent.replace(/db\.registrations\.get\(([^)]+)\)/g, "(await db.getRegistration($1))");
apiContent = apiContent.replace(/db\.assignments\.get\(([^)]+)\)/g, "(await db.getAssignment($1))");
apiContent = apiContent.replace(/db\.problems\.get\(([^)]+)\)/g, "(await db.getProblem($1))");
apiContent = apiContent.replace(/db\.submissions\.get\(([^)]+)\)/g, "(await db.getSubmission($1))");

// Replace map has
apiContent = apiContent.replace(/db\.users\.has\(([^)]+)\)/g, "(await db.hasUser($1))");

// Replace mutations
apiContent = apiContent.replace(/db\.submissions\.set\(([^,]+),\s*([^)]+)\)/g, "await db.saveSubmission($1, $2)");

fs.writeFileSync('server/api.ts', apiContent);
console.log("Transformed Map accesses to async getters");
