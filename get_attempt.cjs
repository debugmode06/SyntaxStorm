const http = require('http');
http.get('http://localhost:3000/api/admin/contests', { headers: { 'x-user-id': 'usr-admin-1' } }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const contests = JSON.parse(data).contests;
    const batch2Contest = contests.find(c => c.batchId === 'batch-1789211239812');
    console.log("Contest:", batch2Contest);
  });
});
