import { z } from 'zod';

const email = z.string().trim().toLowerCase().email().max(200);
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100), email,
  password: z.string().min(10).max(128),
  role: z.enum(['donor', 'ngo', 'volunteer']),
  organizationName: z.string().trim().max(150).optional(),
  organizationType: z.enum(['restaurant', 'hotel', 'grocery', 'caterer', 'ngo', 'other']).optional(),
}).refine(data => data.role === 'volunteer' || !!data.organizationName, {
  path: ['organizationName'], message: 'Organization name is required',
});
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().max(30).optional(),
});
