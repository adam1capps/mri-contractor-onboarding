import { neon } from '@neondatabase/serverless';

let sql = null;

/* Which environment variable supplies the connection string. NETLIFY_DATABASE_URL
   is what the Netlify DB extension sets; DATABASE_URL is what this project has
   configured by hand. Order matters: if both are ever set and point at different
   databases, the app silently reads an empty database while the signed
   agreements sit in the other one. dbEnvConflict() makes that visible in the
   admin console instead of leaving it to be discovered by a contractor. */
export function dbEnvName() {
  if (process.env.NETLIFY_DATABASE_URL) return 'NETLIFY_DATABASE_URL';
  if (process.env.DATABASE_URL) return 'DATABASE_URL';
  return null;
}

export function dbEnvConflict() {
  const a = process.env.NETLIFY_DATABASE_URL;
  const b = process.env.DATABASE_URL;
  return Boolean(a && b && a !== b);
}

/* Returns a Neon tagged-template client, or null when no database is
   configured (deploy previews without the Neon extension). Callers must
   handle null and respond 503 so the page can fall back to demo mode. */
export function getSql() {
  if (sql) return sql;
  const url = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) return null;
  if (dbEnvConflict()) {
    console.warn('NETLIFY_DATABASE_URL and DATABASE_URL are both set and differ; '
      + 'using NETLIFY_DATABASE_URL. Unset one of them so records cannot split across two databases.');
  }
  sql = neon(url);
  return sql;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function clientMeta(req, context) {
  const ip = context?.ip
    || req.headers.get('x-nf-client-connection-ip')
    || req.headers.get('x-forwarded-for')
    || '';
  const userAgent = (req.headers.get('user-agent') || '').slice(0, 500);
  return { ip, userAgent };
}
