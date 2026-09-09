import { getSql, json } from '../lib/db.mjs';
import { requireAdmin } from '../lib/adminauth.mjs';
import { sendEmail } from '../lib/email.mjs';
import { randomUUID } from 'node:crypto';

const EMAIL_RE = /.+@.+\..+/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ['booked', 'agreement_signed', 'completed', 'cancelled'];

function siteBase() {
  return (process.env.SITE_BASE_URL || process.env.URL || 'https://onboarding.roof-mri.com')
    .replace(/\/$/, '');
}

function dateLabelOf(trainingDate) {
  const d = String(trainingDate || '').slice(0, 10);
  if (!DATE_RE.test(d)) return 'a date to be confirmed';
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

/* One body for both the first invite and any resend, so a contractor who lost
   the email gets the same branded explanation rather than a bare link. */
function inviteEmail(t, link) {
  const nashvilleNote = t.format === 'nashville'
    ? 'This training is hosted at the ReDry facility in Nashville, TN. Your page covers travel, hotels, and how the day runs.\n\n'
    : '';
  return {
    to: t.contact_email,
    subject: `Your Roof MRI Certification Training (${t.company})`,
    text:
      `Hi ${t.contact_name},\n\n` +
      `${t.company} is booked for Roof MRI Certification Training on ${dateLabelOf(t.training_date)}. ` +
      `Everything you need is on your personal training page:\n\n${link}\n\n` +
      nashvilleNote +
      `The page walks you through how to prepare, how the day runs, and the Training ` +
      `Agreement to execute before training day. Once the agreement is signed you'll add ` +
      `your crew there so each person can sign their field waiver.\n\n` +
      `Questions? Just reply to this email.\n\n` +
      `Roof MRI / ReDry LLC`,
  };
}

export default async (req) => {
  const sql = getSql();
  if (!sql) return json({ error: 'database not configured' }, 503);

  const admin = await requireAdmin(req);
  if (!admin.ok) return json({ error: admin.error }, admin.status);

  /* ── List ─────────────────────────────────────────────────────────── */
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    const includeCancelled = url.searchParams.get('all') === '1';
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 200);
    const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

    const rows = await sql`
      select t.token, t.company, t.contact_name, t.contact_email, t.training_date,
             t.meet_location, t.trainer, t.package, t.format, t.status, t.created_at,
             exists(select 1 from agreements a where a.training_id = t.id) as agreement_signed,
             (select signer_name from agreements a where a.training_id = t.id
               order by a.signed_at limit 1) as signer_name,
             (select signed_at from agreements a where a.training_id = t.id
               order by a.signed_at limit 1) as signed_at,
             (select count(*)::int from participants p where p.training_id = t.id) as crew,
             (select count(*)::int from participants p
                where p.training_id = t.id and p.waiver_signed_at is not null) as crew_signed,
             count(*) over() as total
      from trainings t
      where (${q} = ''
             or t.company ilike '%' || ${q} || '%'
             or t.contact_name ilike '%' || ${q} || '%'
             or t.contact_email ilike '%' || ${q} || '%'
             or t.token = ${q})
        and (${includeCancelled}::boolean or t.status <> 'cancelled')
      order by t.training_date desc nulls last, t.created_at desc
      limit ${limit} offset ${offset}`;

    return json({
      trainings: rows.map(r => ({ ...r, link: `${siteBase()}/training/${r.token}` })),
      total: rows.length ? Number(rows[0].total) : 0,
      limit,
      offset,
    });
  }

  /* ── Edit / cancel / reschedule ───────────────────────────────────── */
  if (req.method === 'PATCH') {
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'invalid JSON body' }, 400);
    }

    const token = String(body.token || '').trim();
    if (!token) return json({ error: 'token is required' }, 400);

    const has = k => Object.prototype.hasOwnProperty.call(body, k);
    const str = k => (has(k) ? String(body[k] || '').trim() : null);

    const company = str('company');
    const contactName = str('contact_name');
    const contactEmail = str('contact_email');
    const trainingDate = str('training_date');
    const meetLocation = str('meet_location');
    const trainer = str('trainer');
    const pkg = str('package');
    const format = has('format') ? (body.format === 'nashville' ? 'nashville' : 'onsite') : null;
    const status = str('status');

    if (company !== null && company.length < 2) return json({ error: 'company name is too short' }, 400);
    if (contactName !== null && contactName.length < 2) return json({ error: 'contact name is too short' }, 400);
    if (contactEmail !== null && !EMAIL_RE.test(contactEmail)) return json({ error: 'contact email is not valid' }, 400);
    if (trainingDate !== null && !DATE_RE.test(trainingDate)) return json({ error: 'training date must be YYYY-MM-DD' }, 400);
    if (status !== null && !STATUSES.includes(status)) {
      return json({ error: `status must be one of ${STATUSES.join(', ')}` }, 400);
    }

    const [row] = await sql`
      update trainings set
        company       = coalesce(${company}, company),
        contact_name  = coalesce(${contactName}, contact_name),
        contact_email = coalesce(${contactEmail}, contact_email),
        training_date = coalesce(${trainingDate}::date, training_date),
        meet_location = coalesce(${meetLocation}, meet_location),
        trainer       = coalesce(${trainer}, trainer),
        package       = coalesce(${pkg}, package),
        format        = coalesce(${format}, format),
        status        = coalesce(${status}, status)
      where token = ${token}
      returning token, company, contact_name, contact_email, training_date,
                meet_location, trainer, package, format, status, created_at`;

    if (!row) return json({ error: 'training not found' }, 404);
    console.log(`training updated by ${admin.email}: ${token} (${Object.keys(body).filter(k => k !== 'token').join(', ')})`);
    return json({ ok: true, training: { ...row, link: `${siteBase()}/training/${row.token}` } });
  }

  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  /* ── Resend the invite for an existing training ───────────────────── */
  if (body.action === 'resend') {
    const token = String(body.token || '').trim();
    if (!token) return json({ error: 'token is required' }, 400);
    const [t] = await sql`select * from trainings where token = ${token}`;
    if (!t) return json({ error: 'training not found' }, 404);

    const link = `${siteBase()}/training/${t.token}`;
    let emailed = false;
    try {
      emailed = await sendEmail(inviteEmail(t, link));
    } catch (err) {
      console.error('training invite resend failed', err);
      return json({ error: 'could not send the email, check the SendGrid key' }, 502);
    }
    console.log(`training link resent by ${admin.email}: ${t.company} -> ${t.contact_email}`);
    return json({ ok: true, emailed, link });
  }

  /* ── Create ───────────────────────────────────────────────────────── */
  const company = String(body.company || '').trim();
  const contactName = String(body.contact_name || '').trim();
  const contactEmail = String(body.contact_email || '').trim();
  const trainingDate = String(body.training_date || '').trim();
  const format = body.format === 'nashville' ? 'nashville' : 'onsite';
  const trainer = String(body.trainer || '').trim() || 'Adam Capps';
  const pkg = String(body.package || '').trim() || 'Professional';
  const meetLocation = String(body.meet_location || '').trim()
    || (format === 'nashville' ? '8:00 AM, ReDry Training Facility' : '8:00 AM, contractor\'s office');
  const sendInvite = body.send_email !== false;

  if (company.length < 2) return json({ error: 'company name is required' }, 400);
  if (contactName.length < 2) return json({ error: 'contact name is required' }, 400);
  if (!EMAIL_RE.test(contactEmail)) return json({ error: 'a valid contact email is required' }, 400);
  if (!DATE_RE.test(trainingDate)) return json({ error: 'training date must be YYYY-MM-DD' }, 400);

  /* Booking two contractors back to back is normal; booking the SAME contractor
     for the same day twice is a double submit. Refuse unless it is meant. */
  if (body.allow_duplicate !== true) {
    const [dupe] = await sql`
      select token from trainings
       where lower(contact_email) = lower(${contactEmail})
         and training_date = ${trainingDate}::date
         and status <> 'cancelled'
       limit 1`;
    if (dupe) {
      return json({
        error: `${contactEmail} already has a training on ${trainingDate}. `
             + 'Resend that link instead, or tick "create anyway" if this is a second session.',
        duplicate_token: dupe.token,
        duplicate_link: `${siteBase()}/training/${dupe.token}`,
      }, 409);
    }
  }

  const token = randomUUID().replaceAll('-', '').slice(0, 12);
  const [row] = await sql`
    insert into trainings
      (token, company, contact_name, contact_email, training_date, meet_location, trainer, package, format)
    values
      (${token}, ${company}, ${contactName}, ${contactEmail}, ${trainingDate},
       ${meetLocation}, ${trainer}, ${pkg}, ${format})
    returning token, company, contact_name, contact_email, training_date, format, status, created_at`;

  const link = `${siteBase()}/training/${token}`;
  console.log(`training created by ${admin.email}: ${company} ${trainingDate} (${format}) -> ${token}`);

  /* Invite email is best effort; the training row is already stored. */
  let emailed = false;
  if (sendInvite) {
    try {
      emailed = await sendEmail(inviteEmail(row, link));
    } catch (err) {
      console.error('training invite email failed', err);
    }
  }

  return json({ ok: true, training: row, link, emailed }, 201);
};

export const config = { path: '/api/admin/trainings' };
