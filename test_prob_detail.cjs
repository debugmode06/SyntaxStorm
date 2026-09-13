const http = require('http');
http.get('http://localhost:3000/api/problems', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
     let probs = JSON.parse(data).problems;
     let prob = probs.find(p => p.id === '01_EASY_Count_Even_Numbers');
     console.log(JSON.stringify(prob.sampleTestCases, null, 2));
  });
});
