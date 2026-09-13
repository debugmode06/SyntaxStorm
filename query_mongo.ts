import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aistudio_db');
  const db = mongoose.connection.db;
  const subs = await db.collection('submissions').find({ userId: 'usr-std-1789189701866-y0r3' }).toArray();
  console.log("Submissions from MongoDB:", subs.length);
  process.exit(0);
}
run();
