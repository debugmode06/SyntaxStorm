const fs = require('fs');
const JSZip = require('jszip');

async function createTestZip() {
  const zip = new JSZip();
  
  // Problem 1
  zip.file('P001/problem.md', `
# Two Sum
## Problem Title
Two Sum
## Difficulty
Easy
## Concepts
Array, Hash Map
## Tags
Google, Amazon
## Problem Description
Desc
## Input Format
In
## Output Format
Out
## Constraints
Con
## Sample Input
\`\`\`
1 2 3
\`\`\`
## Sample Output
\`\`\`
4 5 6
\`\`\`
`);
  zip.file('P001/metadata.txt', 'problem_id: P001');
  zip.file('P001/testcases/input/input01.txt', '1');
  zip.file('P001/testcases/output/output01.txt', '2');
  zip.file('P001/testcases/input/input02.txt', '3');
  zip.file('P001/testcases/output/output02.txt', '4');

  // Problem 2 (missing output)
  zip.file('P002/problem.md', `
# Three Sum
## Difficulty
Medium
## Input Format
In
## Output Format
Out
## Constraints
Con
## Sample Input
in
## Sample Output
out
`);
  zip.file('P002/testcases/input/input01.txt', '1');
  zip.file('P002/testcases/input/input02.txt', '3');
  zip.file('P002/testcases/output/output01.txt', '2');

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync('test.zip', content);
}

createTestZip().catch(console.error);
