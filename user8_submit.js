const http = require('http');

async function run() {
  
  // 1. Login
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user8@hit.edu.in', password: 'password123' })
  }).then(r => r.json());
  
  console.log("Login:", loginRes.user?.id);
  const userId = loginRes.user?.id;
  if(!userId) return;

  // 2. Fetch active contest for user8
  const contestRes = await fetch('http://localhost:3000/api/admin/contests', {
    headers: { 'x-user-id': userId }
  }).then(r => r.json());
  const contest = contestRes.contests.find(c => c.status === 'LIVE' && c.batchId === 'batch-1789211239812') || contestRes.contests.find(c => c.status === 'LIVE');
  console.log("Contest:", contest?.id);

  // 3. Submit code
  const code = `
function countEvenNumbers(arr) {
  return arr.filter(n => n % 2 === 0).length;
}
module.exports = countEvenNumbers;
`;
  const submitRes = await fetch('http://localhost:3000/api/code/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
    body: JSON.stringify({
      problemId: '01_EASY_Count_Even_Numbers',
      code: code,
      language: 'javascript',
      roundId: 'round-1',
      contestId: contest?.id
    })
  }).then(r => r.json());
  console.log("Submit:", submitRes);
}

run();
