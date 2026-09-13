async function run() {
  const res = await fetch('http://localhost:3000/api/admin/contests/contest-1/problems');
  const text = await res.text();
  console.log(text.slice(0, 1000));
}
run();
