import { json } from '../lib/db.mjs';

/* Public: serves the Clerk publishable key to the admin page.
   Publishable keys are public by design; the secret key never leaves env. */
export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);
  return json({ publishableKey: process.env.CLERK_PUBLISHABLE_KEY || null });
};

export const config = { path: '/api/admin/config' };
