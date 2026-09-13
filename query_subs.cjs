const http = require('http');

http.get('http://localhost:3000/api/submissions', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const submissions = JSON.parse(data).submissions;
    const user8Subs = submissions.filter(s => s.userName === 'user8' || s.userId === 'usr-std-1789189701866-y0r3');
    console.log(JSON.stringify(user8Subs, null, 2));
  });
});
