const http = require('http');
http.get('http://localhost:3000/api/admin/contests', { headers: { 'x-user-id': 'usr-admin-1' } }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(JSON.parse(data).contests.map(c => ({ id: c.id, name: c.name, status: c.status }))));
});
