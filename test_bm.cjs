const http = require('http');
http.get('http://localhost:3000/api/admin/batches/batch-1789208954461/students', { headers: { 'x-user-id': 'usr-admin-1' } }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(data);
  });
});
