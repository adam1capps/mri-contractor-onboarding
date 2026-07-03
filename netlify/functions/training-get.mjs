import { getSql, json } from '../lib/db.mjs';

/* Public hydration data for the training page. Returns only what the page
   renders; no signature records or participant emails. */
export default async (req, context) => {
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);
  const sql = getSql();
  if (!sql) return json({ error: 'database not configured' }, 503);

  const { token } = context.params;
  const [t] = await sql`
    select t.token, t.company, t.training_date, t.meet_location, t.trainer,
           t.package, t.format, t.status,
           exists(select 1 from agreements a where a.training_id = t.id) as agreement_signed
    from trainings t where t.token = ${token}`;
  if (!t) return json({ error: 'training not found' }, 404);
  return json(t);
};

export const config = { path: '/api/training/:token' };
