import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

export const connectMongoDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is missing.');
  }

  try {
    await mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB_NAME || 'codesymposium'
    });
    console.log('Successfully connected to MongoDB');
  } catch (error) {
    console.error('Failed to connect to MongoDB', error);
    throw new Error('MongoDB configuration missing or connection failed');
  }
};
