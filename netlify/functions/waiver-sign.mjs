import { getSql, json, clientMeta } from '../lib/db.mjs';
import { sendEmail, notifyRecipients } from '../lib/email.mjs';

const MAX_SIG_BYTES = 2_000_000;

export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const sql = getSql();
  if (!sql) return json({ error: 'database not configured' }, 503);

  const { ptk } = context.params;
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const name = String(body.name || '').trim();
  const sigType = body.sig_type === 'type' ? 'type' : 'draw';
  const sigData = String(body.sig_data || '');
  if (name.length < 2) return json({ error: 'participant name is required' }, 400);
  if (!sigData || sigData.length > MAX_SIG_BYTES) {
    return json({ error: 'missing or oversized signature' }, 400);
  }
  if (sigType === 'draw' && !sigData.startsWith('data:image/png;base64,')) {
    return json({ error: 'drawn signature must be a PNG data URL' }, 400);
  }

  const [participant] = await sql`
    select p.id, p.name, p.waiver_signed_at, p.training_id,
           t.company, t.token as training_token, t.training_date
    from participants p
    join trainings t on t.id = p.training_id
    where p.waiver_token = ${ptk}`;
  if (!participant) return json({ error: 'waiver link not found' }, 404);

  if (participant.waiver_signed_at) {
    return json({ ok: true, already_signed: true, signed_at: participant.waiver_signed_at });
  }

  const { ip, userAgent } = clientMeta(req, context);
  const [updated] = await sql`
    update participants
    set waiver_sig_type = ${sigType},
        waiver_sig_data = ${sigData},
        ip = ${ip},
        user_agent = ${userAgent},
        waiver_signed_at = now(),
        name = ${name}
    where id = ${participant.id}
    returning waiver_signed_at`;

  const [{ unsigned }] = await sql`
    select count(*)::int as unsigned
    from participants
    where training_id = ${participant.training_id} and waiver_signed_at is null`;
  const allSigned = unsigned === 0;

  /* Notification is best effort; the signed waiver row is already stored. */
  if (allSigned) {
    try {
      const dateLabel = participant.training_date
        ? String(participant.training_date).slice(0, 10)
        : 'TBD';
      await sendEmail({
        to: notifyRecipients(),
        subject: `All crew waivers signed: ${participant.company} (${dateLabel})`,
        text:
          `Every participant on the ${participant.company} roster has signed their ` +
          `field waiver. The crew is cleared for the roof.\n\n` +
          `Training date: ${dateLabel}\nToken: ${participant.training_token}`,
      });
    } catch (err) {
      console.error('all-signed notification failed', err);
    }
  }

  return json({ ok: true, signed_at: updated.waiver_signed_at, all_signed: allSigned });
};

export const config = { path: '/api/waiver/:ptk/sign' };
