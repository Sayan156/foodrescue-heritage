import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../src/modules/users/user.model.js';
import { loginSchema } from '../src/modules/auth/auth.schemas.js';
import { createTerminalInput } from './lib/terminal-input.js';

class SetupError extends Error {}
let setupStage = 'reading configuration';

function databaseErrorHint(error) {
  const errors = [error, error.cause, ...Array.from(error.reason?.servers?.values?.() || [], server => server.error)].filter(Boolean);
  if (errors.some(item => item.code === 18 || /authentication failed|bad auth/i.test(item.message || ''))) {
    return 'Authentication failed. Check the Atlas database username and password (not your Atlas login), and URL-encode reserved characters in the password.';
  }
  if (errors.some(item => item.code === 13)) return 'The database user lacks permission. Grant it readWrite access to the selected application database.';
  if (errors.some(item => ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ETIMEOUT'].includes(item.code) && /querySrv|queryTxt|getaddrinfo/.test(item.syscall || ''))) {
    return 'DNS lookup failed. Check the cluster hostname, your internet connection, and your DNS resolver.';
  }
  if (errors.some(item => /ServerSelection|Network/.test(item.name || ''))) {
    return 'Could not reach MongoDB. Check that the Atlas cluster is running, your current IP is allowed in Atlas Network Access, and your firewall permits the connection.';
  }
  if (error.name === 'MongoParseError') return 'Invalid MongoDB connection string. Check its format and URL-encode reserved characters in the password.';
  return 'Check the database connection and permissions. If creating the email index, check for existing duplicate emails or a conflicting index.';
}
const usage = 'Usage: node scripts/create-admin.js [--env-file .env.atlas]\nEmail, name, and a hidden password are requested interactively.';
const nameSchema = z.string().trim().min(2).max(100);
const passwordSchema = z.string().min(12, 'Use at least 12 characters.').max(128)
  .refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password exceeds bcrypt\'s 72-byte limit; use a shorter passphrase.')
  .refine(value => value.trim().length > 0, 'Password cannot contain only whitespace.');

function validate(schema, value, label) {
  const result = schema.safeParse(value);
  if (!result.success) throw new SetupError(`${label}: ${result.error.issues[0].message}`);
  return result.data;
}

function databaseUri(args) {
  if (args.length && (args.length !== 2 || args[0] !== '--env-file' || !args[1])) {
    throw new SetupError(usage);
  }
  const explicitFile = args.length === 2;
  const envFile = explicitFile ? resolve(args[1]) : fileURLToPath(new URL('../.env', import.meta.url));
  let values = {};
  try { values = dotenv.parse(readFileSync(envFile)); }
  catch (error) {
    if (explicitFile || error.code !== 'ENOENT') throw new SetupError('Could not read the selected environment file.');
  }
  // An explicitly selected Atlas file must not silently use a local shell URI.
  const uri = (explicitFile ? values.MONGODB_URI : process.env.MONGODB_URI || values.MONGODB_URI)?.trim();
  if (!uri) throw new SetupError('Set MONGODB_URI in the selected environment file.');
  const match = uri.match(/^mongodb(?:\+srv)?:\/\/[^/?#]+\/([^/?#]+)(?:[?#]|$)/);
  if (!match) throw new SetupError('MONGODB_URI must explicitly name the application database, for example /foodrescue.');
  let name;
  try { name = decodeURIComponent(match[1]); }
  catch { throw new SetupError('The database name in MONGODB_URI is invalid.'); }
  if (['admin', 'config', 'local', 'test'].includes(name.toLowerCase())) {
    throw new SetupError('Use a dedicated application database, such as foodrescue.');
  }
  return { uri, name };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') { console.log(usage); return; }
  const target = databaseUri(args);
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new SetupError('Run this script in an interactive terminal; passwords cannot be passed as arguments or piped input.');
  }
  const terminal = createTerminalInput();
  let password = '', confirmation = '';
  try {
    const email = validate(loginSchema.shape.email, await terminal.ask('Admin email: '), 'Email');
    const name = validate(nameSchema, (await terminal.ask('Admin name [FoodRescue Administrator]: ')) || 'FoodRescue Administrator', 'Name');
    setupStage = 'connecting to MongoDB';
    await mongoose.connect(target.uri, {
      serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000, maxPoolSize: 2,
      autoIndex: false, autoCreate: false,
    });
    terminal.throwIfAborted();
    if (mongoose.connection.name !== target.name) throw new SetupError('Connected database does not match the selected database.');
    console.log(`Connected host: ${mongoose.connection.host}\nDatabase: ${mongoose.connection.name}`);
    setupStage = 'checking for an existing account';
    if (await User.exists({ email })) throw new SetupError('Account already exists. No password or role was changed.');

    password = validate(passwordSchema, await terminal.ask('Admin password (hidden, at least 12 characters): ', { secret: true }), 'Password');
    confirmation = await terminal.ask('Confirm password (hidden): ', { secret: true });
    if (password !== confirmation) throw new SetupError('Passwords do not match. No account was created.');
    confirmation = '';
    const expected = `CREATE ADMIN IN ${mongoose.connection.name}`;
    const answer = await terminal.ask(`Create verified admin ${email}? Type "${expected}" to continue: `);
    if (answer !== expected) throw new SetupError('Cancelled. No account was created.');

    const passwordHash = await bcrypt.hash(password, 12);
    password = '';
    terminal.throwIfAborted();
    // Ensure uniqueness even when two setup processes run on a fresh database.
    setupStage = 'creating the unique email index';
    await User.collection.createIndex({ email: 1 }, { unique: true });
    terminal.throwIfAborted();
    setupStage = 'saving the admin account';
    await User.create({ name, email, passwordHash, role: 'admin', status: 'verified' });
    console.log('Admin created successfully. Sign in through the normal FoodRescue login page.');
  } finally {
    password = ''; confirmation = '';
    terminal.close();
    await mongoose.disconnect();
  }
}

main().catch(error => {
  // Driver errors may contain connection details; do not print raw errors/URIs.
  if (error instanceof SetupError) console.error(error.message);
  else if (error.name === 'AbortError') console.error('Admin setup interrupted. Rerunning will refuse an existing account.');
  else if (error.code === 11000) console.error('Duplicate email detected. No existing account was changed.');
  else console.error(`Admin setup failed while ${setupStage}. ${databaseErrorHint(error)}`);
  process.exitCode = error.name === 'AbortError' ? 130 : 1;
});
