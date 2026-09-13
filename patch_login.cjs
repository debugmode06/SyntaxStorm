const fs = require('fs');
let code = fs.readFileSync('server/api.ts', 'utf8');

const oldFind = `  let user = Array.from(db.users.values()).find(
    u => u.email.toLowerCase() === cleanIdentifier ||
         u.username?.toLowerCase() === cleanIdentifier ||
         u.studentId?.toLowerCase() === cleanIdentifier ||
         u.id === email ||
         (cleanIdentifier === 'admin' && u.role === 'ADMIN') ||
         (cleanIdentifier === 'student' && (u.email === 'student@symposium.edu' || u.username === 'samantha.vance'))
  );`;

const newFind = `  let user = Array.from(db.users.values()).find(
    u => u.email.toLowerCase() === cleanIdentifier ||
         u.username?.toLowerCase() === cleanIdentifier ||
         u.studentId?.toLowerCase() === cleanIdentifier
  );`;

code = code.replace(oldFind, newFind);

// Remove the admin fallback login further down if it exists
const adminFallback = `
  // Development / Demo Fallbacks
  if (!user && cleanIdentifier === 'admin' && password === 'admin') {
    user = {
      id: 'usr-admin-1',
      name: 'Chief Judge',
      email: 'admin@symposium.edu',
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };
    db.users.set(user.id, user);
    db.currentUserId = user.id;
    return res.json({ user, message: 'Welcome back, Chief Judge.' });
  }

  if (!user && cleanIdentifier === 'student' && password === 'password123') {
    user = {
      id: 'usr-student-1',
      name: 'Mohan S',
      email: 'student@symposium.edu',
      role: 'STUDENT',
      batchId: 'batch-1',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };
    db.users.set(user.id, user);
    db.currentUserId = user.id;
    return res.json({ user, message: 'Welcome back, Mohan.' });
  }
`;

code = code.replace(adminFallback, "");

fs.writeFileSync('server/api.ts', code);
