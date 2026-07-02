/* SendGrid mail helper, same pattern as the re-dry.com intake function.
   Env:
     SENDGRID_API_KEY  required to actually send (skipped with a warning
                       when unset, so deploy previews never hard-fail)
     EMAIL_FROM        sender address, default adam@re-dry.com
     NOTIFY_EMAILS     comma-separated internal recipients (Adam/Regina),
                       default adam@re-dry.com */

const FROM_NAME = 'Roof MRI';

export function notifyRecipients() {
  return (process.env.NOTIFY_EMAILS || 'adam@re-dry.com')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);
}

/**
 * @param {object} opts
 * @param {string|string[]} opts.to
 * @param {string} opts.subject
 * @param {string} opts.text
 * @param {string} [opts.html]
 * @param {{filename:string, content:Uint8Array|Buffer, type?:string}[]} [opts.attachments]
 * @returns {Promise<boolean>} true if handed to SendGrid
 */
export async function sendEmail({ to, subject, text, html, attachments }) {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) {
    console.warn('sendEmail skipped (SENDGRID_API_KEY not set):', subject);
    return false;
  }
  const recipients = (Array.isArray(to) ? to : [to]).map(email => ({ email }));
  const body = {
    personalizations: [{ to: recipients }],
    from: { email: process.env.EMAIL_FROM || 'adam@re-dry.com', name: FROM_NAME },
    subject,
    content: [
      { type: 'text/plain', value: text },
      ...(html ? [{ type: 'text/html', value: html }] : []),
    ],
  };
  if (attachments && attachments.length) {
    body.attachments = attachments.map(a => ({
      content: Buffer.from(a.content).toString('base64'),
      filename: a.filename,
      type: a.type || 'application/pdf',
      disposition: 'attachment',
    }));
  }
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error('SendGrid error', res.status, await res.text());
    return false;
  }
  return true;
}
