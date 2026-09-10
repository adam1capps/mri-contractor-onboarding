/* Handler behaviour without a database or Clerk keys: the admin database
   endpoint must refuse an unauthenticated caller before it reports anything,
   and a public endpoint must answer a database problem with a clean 503 the
   page can act on rather than a bare 500 it cannot distinguish from a bug.
   Run: npm test */
const R = new URL('../netlify/', import.meta.url).href;
delete process.env.DATABASE_URL; delete process.env.NETLIFY_DATABASE_URL;
delete process.env.CLERK_SECRET_KEY; delete process.env.CLERK_PUBLISHABLE_KEY;

const req = (method, url) => new Request(url, { method });
let pass = 0, fail = 0;
const check = (name, cond, extra='') => { if (cond) { pass++; console.log('ok   ' + name); }
  else { fail++; console.error('FAIL ' + name + ' ' + extra); } };

// 1. The admin database endpoint must refuse an unauthenticated caller.
const adminDb = (await import(R + 'functions/admin-db.mjs')).default;
let res = await adminDb(req('GET', 'https://x/api/admin/db'));
let body = await res.json();
check('admin-db rejects unauthenticated GET', res.status === 401 || res.status === 503, '-> ' + res.status);
check('admin-db leaks no schema info when unauthenticated',
  body.tables === undefined && body.counts === undefined && body.env_var === undefined,
  JSON.stringify(body));

// 2. Same for POST, which is the destructive-ish one (applies DDL).
res = await adminDb(req('POST', 'https://x/api/admin/db'));
check('admin-db rejects unauthenticated POST', res.status === 401 || res.status === 503, '-> ' + res.status);

// 3. admin-trainings must not act without auth either.
const adminTr = (await import(R + 'functions/admin-trainings.mjs')).default;
res = await adminTr(req('GET', 'https://x/api/admin/trainings'));
check('admin-trainings refuses without database/auth', res.status >= 400, '-> ' + res.status);

// 4. Public endpoint with no database returns a clean, non-500 error.
const tget = (await import(R + 'functions/training-get.mjs')).default;
res = await tget(req('GET', 'https://x/api/training/abc'), { params: { token: 'abc' } });
body = await res.json();
check('training-get returns 503 not 500 with no database', res.status === 503, '-> ' + res.status);
check('training-get error is a clean message', typeof body.error === 'string', JSON.stringify(body));

// 5. publicHandler converts an unexpected throw into a 503 the page can act on.
const { publicHandler } = await import(R + 'lib/db.mjs');
const boom = publicHandler(async () => { throw new Error('relation "trainings" does not exist'); });
res = await boom(req('GET', 'https://x/'), {});
body = await res.json();
check('publicHandler turns a throw into 503', res.status === 503, '-> ' + res.status);
check('publicHandler does not echo internals to the caller',
  !JSON.stringify(body).includes('relation'), JSON.stringify(body));

console.log(`\nhandlers: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
