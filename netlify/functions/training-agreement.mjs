import { getSql, json, clientMeta } from '../lib/db.mjs';
import { TERMS_VERSION } from '../lib/terms.mjs';
import { buildAgreementPdf } from '../lib/pdf.mjs';
import { sendEmail, notifyRecipients } from '../lib/email.mjs';

const EMAIL_RE = /.+@.+\..+/;
const MAX_SIG_BYTES = 2_000_000;

export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const sql = getSql();
  if (!sql) return json({ error: 'database not configured' }, 503);

  const { token } = context.params;
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const signerName = String(body.signer_name || '').trim();
  const signerTitle = String(body.signer_title || '').trim();
  const signerEmail = String(body.signer_email || '').trim();
  const sigType = body.sig_type === 'type' ? 'type' : 'draw';
  const sigData = String(body.sig_data || '');

  if (signerName.length < 2 || signerTitle.length < 2 || !EMAIL_RE.test(signerEmail)) {
    return json({ error: 'signer name, title, and a valid email are required' }, 400);
  }
  if (!sigData || sigData.length > MAX_SIG_BYTES) {
    return json({ error: 'missing or oversized signature' }, 400);
  }
  if (sigType === 'draw' && !sigData.startsWith('data:image/png;base64,')) {
    return json({ error: 'drawn signature must be a PNG data URL' }, 400);
  }
  if (body.terms_version !== TERMS_VERSION) {
    return json({ error: 'terms version mismatch, reload the page to get the current agreement' }, 409);
  }

  const [training] = await sql`select * from trainings where token = ${token}`;
  if (!training) return json({ error: 'training not found' }, 404);

  const { ip, userAgent } = clientMeta(req, context);

  const [agreement] = await sql`
    insert into agreements
      (training_id, signer_name, signer_title, signer_email, sig_type, sig_data, ip, user_agent, terms_version)
    values
      (${training.id}, ${signerName}, ${signerTitle}, ${signerEmail}, ${sigType}, ${sigData}, ${ip}, ${userAgent}, ${TERMS_VERSION})
    returning id, signed_at`;
  await sql`update trainings set status = 'agreement_signed' where id = ${training.id}`;

  /* PDF + emails are best effort: the signature record above is the legal
     artifact and must not be rolled back if mail delivery hiccups. */
  let emailed = false;
  try {
    const signedAt = new Date(agreement.signed_at).toISOString();
    const pdfBytes = await buildAgreementPdf({
      training,
      signer: { name: signerName, title: signerTitle, email: signerEmail },
      sigType,
      sigData,
      signedAt,
      ip,
      userAgent,
      termsVersion: TERMS_VERSION,
    });
    const dateLabel = training.training_date
      ? String(training.training_date).slice(0, 10)
      : 'your scheduled date';
    emailed = await sendEmail({
      to: signerEmail,
      subject: `Your executed Roof MRI Training Agreement (${training.company})`,
      text:
        `Hi ${signerName},\n\n` +
        `Your Roof MRI Training Agreement for ${training.company} is executed. ` +
        `A PDF copy is attached for your records.\n\n` +
        `Training date: ${dateLabel}\nTrainer: ${training.trainer || 'ReDry'}\n\n` +
        `Next step: add your crew on the training page so each person can sign ` +
        `their field waiver before training day. Field rule: no signed waiver, no roof.\n\n` +
        `Roof MRI / ReDry LLC`,
      attachments: [{
        filename: `Roof-MRI-Training-Agreement-${token}.pdf`,
        content: pdfBytes,
      }],
    });
    await sendEmail({
      to: notifyRecipients(),
      subject: `Agreement signed: ${training.company} (${dateLabel})`,
      text:
        `${signerName} (${signerTitle}, ${signerEmail}) executed the Training Agreement ` +
        `for ${training.company}.\n\nSigned at: ${signedAt}\nTerms version: ${TERMS_VERSION}\n` +
        `IP: ${ip || 'unavailable'}\nToken: ${token}`,
    });
  } catch (err) {
    console.error('agreement PDF/email failed', err);
  }

  return json({
    ok: true,
    signed_at: agreement.signed_at,
    terms_version: TERMS_VERSION,
    emailed,
  });
};

export const config = { path: '/api/training/:token/agreement' };
