import { db } from './server/proxy.ts';

setTimeout(async () => {
  const userId = 'usr-std-1789189701866-y0r3';
  
  // 1. Get contest
  const contests = Array.from(db.contests.values());
  const contest = contests.find(c => c.batchId === 'batch-1789211239812') || contests.find(c => c.status === 'LIVE');
  console.log("Contest:", contest?.id);

  // 2. Submit code
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
  console.log("Submit result:", submitRes);
  process.exit(0);
}, 2000);
