const http = require('http');
http.get('http://localhost:3000/api/users', { headers: { 'x-user-id': 'usr-admin-1' } }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    let users = JSON.parse(data).users;
    let batch1 = users.filter(u => u.batchId === 'batch-1789211239812');
    console.log("Batch 1 users:", batch1.length);
    console.log(batch1.map(u => u.name));
  });
});
