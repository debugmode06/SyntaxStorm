async function run() {
  const codeA = `
n = int(input())
arr = list(map(int, input().split()))
count = sum(1 for x in arr if x % 2 == 0)
print(count)
`;
  const res = await fetch('http://localhost:3000/api/code/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': 'usr-admin-1' },
    body: JSON.stringify({ problemId: '01_EASY_Count_Even_Numbers', code: codeA, language: 'python', roundId: 'round-1', contestId: 'contest-1' })
  });
  const data = await res.json();
  console.log(JSON.stringify(data.result.testCaseResults, null, 2));
}
run();
