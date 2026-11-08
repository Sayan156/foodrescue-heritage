import 'dotenv/config';import mongoose from 'mongoose';import bcrypt from 'bcryptjs';import {User} from '../src/models/index.js';
const [email,password,name='FoodRescue Administrator']=process.argv.slice(2);
if(!email||!password||password.length<12||!process.env.MONGODB_URI){console.error('Usage: node scripts/create-admin.js admin@example.com StrongPassword123 "Name" (with .env configured)');process.exit(1);}
await mongoose.connect(process.env.MONGODB_URI);const exists=await User.exists({email:email.toLowerCase()});if(exists){console.error('Account already exists; no change made');process.exit(1);}
await User.create({name,email:email.toLowerCase(),passwordHash:await bcrypt.hash(password,12),role:'admin',status:'verified'});console.log('Admin created successfully');await mongoose.disconnect();
