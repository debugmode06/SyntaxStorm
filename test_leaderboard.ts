async function run() {
  const lb = await fetch('http://localhost:3000/api/admin/contests/contest-1789197607651/leaderboard?roundId=round-1', { headers: { 'x-user-id': 'usr-admin-1' } }).then(r => r.json());
  console.log(lb.leaderboard.find((l: any) => l.userId === 'usr-std-1789189701866-y0r3'));
}
run();
