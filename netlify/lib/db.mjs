import { neon } from '@neondatabase/serverless';

let sql = null;

/* Returns a Neon tagged-template client, or null when no database is
   configured (deploy previews without the Neon extension). Callers must
   handle null and respond 503 so the page can fall back to demo mode. */
export function getSql() {
  if (sql) return sql;
  const url = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) return null;
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
