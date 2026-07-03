import { getSql, json, clientMeta } from '../lib/db.mjs';
import { sendEmail } from '../lib/email.mjs';

const EMAIL_RE = /.+@.+\..+/;

function siteBase() {
  /* Set SITE_BASE_URL once connect.roof-mri.com points at this app. */
  return (process.env.SITE_BASE_URL || process.env.URL || 'https://contractor-onboarding.netlify.app')
    .replace(/\/$/, '');
}

export default async (req, context) => {
  const sql = getSql();
  if (!sql) return json({ error: 'database not configured' }, 503);

  const { token } = context.params;
  const [training] = await sql`select * from trainings where token = ${token}`;
  if (!training) return json({ error: 'training not found' }, 404);

  if (req.method === 'GET') {
    const rows = await sql`
      select name, email, waiver_token, waiver_signed_at
      from participants where training_id = ${training.id} order by id`;
    return json({
      participants: rows.map(r => ({
        name: r.name,
        email: r.email,
        waiver_token: r.waiver_token,
        signed: !!r.waiver_signed_at,
        waiver_signed_at: r.waiver_signed_at,
      })),
    });
  }

  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  /* Roster only unlocks once the company agreement is executed
     (Agreement Section 5(a) drives the waiver requirement). */
  const [agreement] = await sql`
    select id from agreements where training_id = ${training.id} limit 1`;
  if (!agreement) return json({ error: 'agreement must be signed before adding participants' }, 409);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  if (name.length < 2 || !EMAIL_RE.test(email)) {
    return json({ error: 'participant name and a valid email are required' }, 400);
  }

  const waiverToken = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  await sql`
    insert into participants (training_id, name, email, waiver_token)
    values (${training.id}, ${name}, ${email}, ${waiverToken})`;

  const link = `${siteBase()}/training/${token}/w/${waiverToken}`;
  try {
    await sendEmail({
      to: email,
      subject: `Sign your Roof MRI field waiver (${training.company})`,
      text:
        `Hi ${name},\n\n` +
        `You're on the roster for Roof MRI Certification Training with ${training.company}. ` +
        `Before we step on a roof, every participant signs a short field waiver.\n\n` +
        `Sign yours here: ${link}\n\n` +
        `Field rule on training day: no signed waiver, no roof.\n\n` +
        `Roof MRI / ReDry LLC`,
    });
  } catch (err) {
    console.error('waiver invite email failed', err);
  }

  const { ip } = clientMeta(req, context);
  console.log(`participant added by ${ip}: ${name} <${email}> for ${token}`);

  return json({
    ok: true,
    participant: { name, email, waiver_token: waiverToken, signed: false },
    link,
  });
};

export const config = { path: '/api/training/:token/participants' };
