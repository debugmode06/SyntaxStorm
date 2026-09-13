async function run() {
  const batchesRes = await fetch('http://localhost:3000/api/admin/batches', { headers: { 'x-user-id': 'usr-admin-1' } }).then(r => r.json());
  console.log('Batches:', batchesRes.batches.length);
  
  const contestsRes = await fetch('http://localhost:3000/api/admin/contests', { headers: { 'x-user-id': 'usr-admin-1' } }).then(r => r.json());
  console.log('Contests:', contestsRes.contests.length);
}
run();
