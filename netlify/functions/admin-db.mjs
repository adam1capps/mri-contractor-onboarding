import { getSql, json, dbEnvName, dbEnvConflict } from '../lib/db.mjs';
import { requireAdmin } from '../lib/adminauth.mjs';
import { TABLES, inspectSchema, applySchema } from '../lib/schema.mjs';

/* Database health and one-click schema setup for the admin console.

   GET  /api/admin/db  -> is a database connected, do the tables exist, how much
                          is in them
   POST /api/admin/db  -> {"action":"apply"} creates any missing tables

   Clerk-gated: this reports on the store of record for signed agreements, so it
   is never public. It deliberately reports only the NAME of the environment
   variable in use, never the connection string or host. */

async function status(sql) {
  const schema = await inspectSchema(sql);
  const out = {
    configured: true,
    connected: true,
    env_var: dbEnvName(),
    env_conflict: dbEnvConflict(),
    tables: Object.fromEntries(TABLES.map(t => [t, schema.present.includes(t)])),
    missing: schema.missing,
    drifted: schema.drifted,
    schema_applied: schema.applied,
    counts: null,
  };
  if (schema.applied) {
    const [c] = await sql`
      select (select count(*)::int from trainings)    as trainings,
             (select count(*)::int from agreements)   as agreements,
             (select count(*)::int from participants) as participants,
             (select count(*)::int from participants
                where waiver_signed_at is not null)   as waivers_signed`;
    out.counts = c;
  }
  return out;
}

export default async (req) => {
  const admin = await requireAdmin(req);
  if (!admin.ok) return json({ error: admin.error }, admin.status);

  const sql = getSql();
  if (!sql) {
    return json({
      configured: false,
      connected: false,
      env_var: null,
      schema_applied: false,
      error: 'No database is connected. Set DATABASE_URL (or NETLIFY_DATABASE_URL) '
           + 'in Netlify site configuration, then reload this page.',
    });
  }

  try {
    if (req.method === 'GET') return json(await status(sql));

    if (req.method === 'POST') {
      let body = {};
      try {
        body = await req.json();
      } catch {
        /* an empty body means "apply", the only action there is */
      }
      if (body.action && body.action !== 'apply') {
        return json({ error: 'unknown action' }, 400);
      }
      const before = await inspectSchema(sql);
      const ran = await applySchema(sql);
      const after = await status(sql);
      const failed = ran.filter(r => !r.ok);
      console.log(`schema applied by ${admin.email}: created `
        + `${before.missing.join(', ') || 'nothing (tables already present)'}`
        + (failed.length ? `; could not apply ${failed.map(f => f.name).join(', ')}` : ''));
      return json({ ...after, ran, created: before.missing, warnings: failed });
    }

    return json({ error: 'method not allowed' }, 405);
  } catch (err) {
    /* Surface enough to act on without leaking the connection string. */
    console.error('admin-db failed', err);
    return json({
      configured: true,
      connected: false,
      env_var: dbEnvName(),
      schema_applied: false,
      error: `Could not reach the database: ${err.message || 'unknown error'}`,
    }, 502);
  }
};

export const config = { path: '/api/admin/db' };
