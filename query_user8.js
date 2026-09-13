const http = require('http');
http.get('http://localhost:3000/api/admin/users', { headers: { 'x-user-id': 'usr-admin-1' } }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    let users = JSON.parse(data).users;
    let u8 = users.find(u => u.email.includes('user8'));
    console.log(u8);
  });
});
