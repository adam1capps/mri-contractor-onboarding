import { getSql, json } from '../lib/db.mjs';
import { TERMS_VERSION } from '../lib/terms.mjs';

/* Public hydration data for the training page. Returns only what the page
   renders; no signature records and no participant details. */
export default async (req, context) => {
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);
  const sql = getSql();
  if (!sql) return json({ error: 'database not configured' }, 503);

  const { token } = context.params;
  try {
    const [t] = await sql`
      select t.token, t.company, t.training_date, t.meet_location, t.trainer,
             t.package, t.format, t.status,
             exists(select 1 from agreements a where a.training_id = t.id) as agreement_signed
      from trainings t where t.token = ${token}`;
    if (!t) return json({ error: 'training not found' }, 404);
    /* The page carries its own copy of the terms text and version. Sending the
       server's version lets the page notice it is serving stale terms and stop,
       instead of every signature failing the version check at submit time with
       no explanation. */
    return json({ ...t, terms_version: TERMS_VERSION });
  } catch (err) {
    console.error('training-get failed', err);
    return json({ error: 'database unavailable' }, 503);
  }
};

export const config = { path: '/api/training/:token' };
