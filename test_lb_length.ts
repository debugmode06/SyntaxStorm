async function run() {
  const contestRes = await fetch('http://localhost:3000/api/admin/contests', { headers: { 'x-user-id': 'usr-admin-1' } }).then(r => r.json());
  const contest = contestRes.contests.find((c: any) => c.status === 'LIVE');
  console.log("Contest:", contest.id, "batch:", contest.batchId);
  const lb1 = await fetch(`http://localhost:3000/api/admin/contests/${contest.id}/leaderboard?roundId=round-1&batchId=batch-1789211239812`, { headers: { 'x-user-id': 'usr-admin-1' } }).then(r => r.json());
  console.log("Contest leaderboard length:", lb1.leaderboard?.length);
}
run();
