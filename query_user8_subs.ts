async function run() {
  const lb1 = await fetch('http://localhost:3000/api/admin/contests/contest-1789197607651/leaderboard?roundId=round-1', { headers: { 'x-user-id': 'usr-admin-1' } }).then(r => r.json());
  console.log("Contest leaderboard length:", lb1.leaderboard?.length);

  const lb2 = await fetch('http://localhost:3000/api/leaderboard?roundId=round-1', { headers: { 'x-user-id': 'usr-admin-1' } }).then(r => r.json());
  console.log("Global leaderboard user8:", lb2.leaderboard?.find((l: any) => l.userId === 'usr-std-1789189701866-y0r3') != null);
}
run();
