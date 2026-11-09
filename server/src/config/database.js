import mongoose from 'mongoose';
let pendingConnection;

export async function connectDatabase(uri = process.env.MONGODB_URI) {
  if (!uri) throw new Error('MONGODB_URI is required');
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!pendingConnection) {
    pendingConnection = mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 10000, bufferCommands: false })
      .finally(() => { pendingConnection = undefined; });
  }
  await pendingConnection;
  return mongoose.connection;
}
