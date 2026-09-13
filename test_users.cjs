const http = require('http');
http.get('http://localhost:3000/api/users', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const users = JSON.parse(data).users;
    const u1 = users.find(u => u.name === 'user1');
    console.log(u1);
  });
});
