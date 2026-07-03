import { getSql, json } from '../lib/db.mjs';
import { requireAdmin } from '../lib/adminauth.mjs';
import { sendEmail } from '../lib/email.mjs';

const EMAIL_RE = /.+@.+\..+/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function siteBase() {
  return (process.env.SITE_BASE_URL || process.env.URL || 'https://contractor-onboarding.netlify.app')
    .replace(/\/$/, '');
}

export default async (req) => {
  const sql = getSql();
  if (!sql) return json({ error: 'database not configured' }, 503);

  const admin = await requireAdmin(req);
  if (!admin.ok) return json({ error: admin.error }, admin.status);

  if (req.method === 'GET') {
    const rows = await sql`
      select t.token, t.company, t.contact_name, t.contact_email, t.training_date,
             t.meet_location, t.trainer, t.package, t.format, t.status, t.created_at,
             exists(select 1 from agreements a where a.training_id = t.id) as agreement_signed,
             (select count(*)::int from participants p where p.training_id = t.id) as crew,
             (select count(*)::int from participants p
                where p.training_id = t.id and p.waiver_signed_at is not null) as crew_signed
      from trainings t
      order by t.created_at desc
      limit 200`;
    return json({
      trainings: rows.map(r => ({ ...r, link: `${siteBase()}/training/${r.token}` })),
    });
  }

  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

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

  const token = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  const [row] = await sql`
    insert into trainings
      (token, company, contact_name, contact_email, training_date, meet_location, trainer, package, format)
    values
      (${token}, ${company}, ${contactName}, ${contactEmail}, ${trainingDate},
       ${meetLocation}, ${trainer}, ${pkg}, ${format})
    returning token, company, training_date, format, status, created_at`;

  const link = `${siteBase()}/training/${token}`;
  console.log(`training created by ${admin.email}: ${company} ${trainingDate} (${format}) -> ${token}`);

  /* Invite email is best effort; the training row is already stored. */
  let emailed = false;
  if (sendInvite) {
    try {
      const dateLabel = new Date(trainingDate + 'T12:00:00Z').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
      });
      const nashvilleNote = format === 'nashville'
        ? 'This training is hosted at the ReDry facility in Nashville, TN. Your page covers travel, hotels, and how the day runs.\n\n'
        : '';
      emailed = await sendEmail({
        to: contactEmail,
        subject: `Your Roof MRI Certification Training (${company})`,
        text:
          `Hi ${contactName},\n\n` +
          `${company} is booked for Roof MRI Certification Training on ${dateLabel}. ` +
          `Everything you need is on your personal training page:\n\n${link}\n\n` +
          nashvilleNote +
          `The page walks you through how to prepare, how the day runs, and the Training ` +
          `Agreement to execute before training day. Once the agreement is signed you'll add ` +
          `your crew there so each person can sign their field waiver.\n\n` +
          `Questions? Just reply to this email.\n\n` +
          `Roof MRI / ReDry LLC`,
      });
    } catch (err) {
      console.error('training invite email failed', err);
    }
  }

  return json({ ok: true, training: row, link, emailed }, 201);
};

export const config = { path: '/api/admin/trainings' };
