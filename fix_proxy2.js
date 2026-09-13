import fs from 'fs';
let content = fs.readFileSync('server/proxy.ts', 'utf-8');

const newInit = `
export const initializeDB = async () => {
  try {
    await connectMongoDB();
    isMongoConnected = true;
  } catch (err) {
    console.warn("MongoDB connection skipped or failed. Running entirely in-memory.", err.message);
  }

  if (isMongoConnected) {
    try {
      // Load from MongoDB initially
      const users = await User.find().lean();
      const contests = await Contest.find().lean();
      const challenges = await Challenge.find().lean();
      const submissions = await Submission.find().lean();
      const attempts = await ContestAttempt.find().lean();

      originalDb.users.clear();
      users.forEach((u: any) => originalDb.users.set(u.id || u._id.toString(), u as any));
      
      originalDb.contests.clear();
      contests.forEach((c: any) => originalDb.contests.set(c.id, c as any));
      
      originalDb.problems.clear();
      challenges.forEach((c: any) => originalDb.problems.set(c.id, c as any));
      
      originalDb.submissions.clear();
      submissions.forEach((s: any) => originalDb.submissions.set(s.id, s as any));
      
      originalDb.attempts.clear();
      attempts.forEach((a: any) => originalDb.attempts.set(a.id, a as any));
    } catch (e) {
      console.error("Failed to load data from MongoDB", e);
    }
  }

  // Create admin if doesn't exist
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
     const existingAdmin = Array.from(originalDb.users.values()).find(u => u.email === process.env.ADMIN_EMAIL);
     if (!existingAdmin) {
       const adminId = 'usr-admin-1';
       const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);
       originalDb.users.set(adminId, {
         id: adminId,
         email: process.env.ADMIN_EMAIL,
         passwordHash: hash,
         password: hash,
         role: 'ADMIN',
         name: 'System Administrator',
         status: 'ACTIVE'
       } as any);
       scheduleSync();
     }
  } else if (!process.env.ADMIN_EMAIL && !process.env.ADMIN_PASSWORD) {
     // Default admin for preview if none provided
     const adminId = 'usr-admin-1';
     if (!originalDb.users.has(adminId)) {
       const hash = bcrypt.hashSync('admin123', 10);
       originalDb.users.set(adminId, {
         id: adminId,
         email: 'admin@symposium.edu',
         passwordHash: hash,
         password: hash,
         role: 'ADMIN',
         name: 'System Administrator (Default)',
         status: 'ACTIVE'
       } as any);
       scheduleSync();
     }
  }
};
`;

content = content.replace(/export const initializeDB = async \(\) => \{[\s\S]*?\}\n\};\n\nexport const db/, newInit + "\nexport const db");
fs.writeFileSync('server/proxy.ts', content);
console.log("Fixed proxy.ts");
