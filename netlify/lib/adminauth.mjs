import { createClerkClient } from '@clerk/backend';

/* Clerk-gated admin access for Regina/Adam.
   Env:
     CLERK_SECRET_KEY      required for auth to work
     CLERK_PUBLISHABLE_KEY required (also served to the admin page)
     ADMIN_EMAIL_DOMAINS   comma-separated allowed email domains,
                           default "re-dry.com" (ReDry Google accounts)
   The frontend sends the Clerk session token as Authorization: Bearer. */

let clerk = null;

export function getClerk() {
  if (clerk) return clerk;
  const secretKey = process.env.CLERK_SECRET_KEY;
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;
  if (!secretKey || !publishableKey) return null;
  clerk = createClerkClient({ secretKey, publishableKey });
  return clerk;
}

function authorizedParties() {
  const parties = new Set(['http://localhost:8888', 'http://localhost:8123']);
  for (const v of [process.env.SITE_BASE_URL, process.env.URL, process.env.DEPLOY_PRIME_URL]) {
    if (v) parties.add(v.replace(/\/$/, ''));
  }
  return [...parties];
}

/**
 * Authenticates the request and enforces the ReDry email domain.
 * @returns {Promise<{ok: true, email: string, userId: string} |
 *                    {ok: false, status: number, error: string}>}
 */
export async function requireAdmin(req) {
  const client = getClerk();
  if (!client) {
    return { ok: false, status: 503, error: 'admin auth is not configured (set CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY)' };
  }
  let state;
  try {
    state = await client.authenticateRequest(req, { authorizedParties: authorizedParties() });
  } catch (err) {
    console.error('clerk authenticateRequest failed', err);
    return { ok: false, status: 401, error: 'could not verify your session, sign in again' };
  }
  if (!state.isSignedIn) {
    return { ok: false, status: 401, error: 'sign in required' };
  }
  const auth = state.toAuth();
  let email = '';
  try {
    const user = await client.users.getUser(auth.userId);
    email = user.primaryEmailAddress?.emailAddress
      || user.emailAddresses?.[0]?.emailAddress
      || '';
  } catch (err) {
    console.error('clerk getUser failed', err);
    return { ok: false, status: 401, error: 'could not load your account, sign in again' };
  }
  const domains = (process.env.ADMIN_EMAIL_DOMAINS || 're-dry.com')
    .split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
  const allowed = domains.some(d => email.toLowerCase().endsWith('@' + d));
  if (!allowed) {
    return { ok: false, status: 403, error: `this console is for ReDry accounts only (signed in as ${email})` };
  }
  return { ok: true, email, userId: auth.userId };
}
