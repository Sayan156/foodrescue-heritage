import 'dotenv/config';
import { app } from './app.js';
import { connectDatabase } from './config/database.js';

const missingRecoverySettings = ['PUBLIC_APP_URL', 'RESEND_API_KEY', 'EMAIL_FROM']
  .filter(key => !process.env[key]?.trim());
if (missingRecoverySettings.length) {
  console.warn(`Password recovery is disabled. Configure ${missingRecoverySettings.join(', ')} in the server environment. Never expose the email API key to the client.`);
}

if (!process.env.MONGODB_URI || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('Set MONGODB_URI and a JWT_SECRET of at least 32 characters');
  process.exit(1);
}

try {
  await connectDatabase();
  const port = Number(process.env.PORT) || 5000;
  app.listen(port, () => console.log(`FoodRescue API running on port ${port}`));
} catch (error) {
  console.error('Database connection failed:', error.message);
  process.exit(1);
}
