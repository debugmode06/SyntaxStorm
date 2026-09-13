async function run() {
  const attempts = await fetch('http://localhost:3000/api/attempts', {
     headers: { 'x-user-id': 'usr-admin-1' } // this route doesn't exist.
  });
}
