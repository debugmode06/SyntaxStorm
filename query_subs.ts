async function run() {
  const subs = await fetch(`http://localhost:3000/api/submissions?roundId=round-1`, { headers: { 'x-user-id': 'usr-admin-1' } }).then(r=>r.json());
  const userSubs = subs.submissions.filter((s: any) => s.userId === 'usr-std-1789189701866-y0r3' || s.userName === 'user8');
  console.log(userSubs.map((s:any) => ({ id: s.id, problem: s.problemId, score: s.score, status: s.status })));
}
run();
