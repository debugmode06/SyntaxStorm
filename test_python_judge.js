async function run() {
  const codeA = `
n = int(input())
arr = list(map(int, input().split()))
count = sum(1 for x in arr if x % 2 == 0)
print(count)
`;
  const codeB = `
import sys
data = list(map(int, sys.stdin.read().split()))
n = data[0]
arr = data[1:1+n]
print(sum(x % 2 == 0 for x in arr))
`;

  const runCode = async (code) => {
    const res = await fetch('http://localhost:3000/api/code/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'usr-admin-1' },
      body: JSON.stringify({
        problemId: '01_EASY_Count_Even_Numbers',
        code,
        language: 'python',
        roundId: 'round-1',
        contestId: 'contest-1'
      })
    });
    return res.json();
  };

  const resA = await runCode(codeA);
  console.log("Test A:");
  if (resA.result && resA.result.testCaseResults) {
    resA.result.testCaseResults.forEach(r => console.log(r.status, r.actualOutput));
  } else {
    console.log(resA);
  }

  const resB = await runCode(codeB);
  console.log("Test B:");
  if (resB.result && resB.result.testCaseResults) {
    resB.result.testCaseResults.forEach(r => console.log(r.status, r.actualOutput));
  } else {
    console.log(resB);
  }
}
run();
