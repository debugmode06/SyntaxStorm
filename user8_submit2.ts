async function run() {
  const userId = 'usr-std-1789189701866-y0r3'; // from db directly
  
  const contestRes = await fetch('http://localhost:3000/api/admin/contests', { headers: { 'x-user-id': 'usr-admin-1' } }).then(r => r.json());
  const contest = contestRes.contests.find((c: any) => c.status === 'LIVE' && c.batchId === 'batch-1789211239812') || contestRes.contests.find((c: any) => c.status === 'LIVE');
  console.log("Contest:", contest?.id);

  const attemptRes = await fetch('http://localhost:3000/api/attempts/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
    body: JSON.stringify({ contestId: contest?.id })
  }).then(r => r.json());
  console.log("Attempt started");

  const code = `
const fs = require('fs');
function main() {
    const input = fs.readFileSync('/dev/stdin', 'utf-8').trim().split(/\\s+/);
    if(input.length < 2) return;
    const n = parseInt(input[0]);
    let evens = 0;
    for(let i = 1; i <= n; i++) {
        if(parseInt(input[i]) % 2 === 0) evens++;
    }
    console.log(evens);
}
main();`;

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
