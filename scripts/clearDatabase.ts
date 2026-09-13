import 'dotenv/config';
import { connectMongoDB } from '../server/mongo.ts';
import { executeContestDataCleanReset } from '../server/services/cleanReset.ts';
import mongoose from 'mongoose';

async function main() {
  console.log('Connecting to database...');
  await connectMongoDB();
  console.log('Executing complete clear of contests, problems, and related exam data...');
  const result = await executeContestDataCleanReset();
  console.log('Clean reset result:', JSON.stringify(result, null, 2));
  await mongoose.disconnect();
  console.log('Done.');
  process.exit(0);
}

main().catch(err => {
  console.error('Failed to clear database:', err);
  process.exit(1);
});
