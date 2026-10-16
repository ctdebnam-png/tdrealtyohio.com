/**
 * Lead notification email, sent through the Resend API after a KV write.
 *
 * Modeled on td-environmental's functions/api/form.js. Settings, all set in the
 * Cloudflare Pages project (Production, and Preview to test on a preview):
 *
 *   RESEND_API_KEY   Secret. No key, no email: the lead is still captured and
 *                    the visitor still gets ok. The miss is logged.
 *   NOTIFY_FROM      The sender. It must be on a domain verified in Resend, or
 *                    Resend refuses the send.
 *   NOTIFY_TO        The inbox to notify. Default ctdebnam@gmail.com.
 *
 * KV stays the record. A notice that did not go is logged with console.error,
 * which shows in the Pages Functions logs, and never changes the response.
 *
 * This file lives under functions/lib/ and exports no onRequest handler, so
 * Pages does not route it.
 */

export const DEFAULT_NOTIFY_TO = 'ctdebnam@gmail.com';
const RESEND_URL = 'https://api.resend.com/emails';
const TIMEOUT_MS = 8000;

/** One line of plain text, so nothing a visitor types can break the header. */
export const oneLine = (value, max = 120) =>
  String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export const noticeSubject = (interest, name) =>
  `New website lead: ${oneLine(interest, 60) || 'general'} - ${oneLine(name, 80) || 'name not given'}`;

/**
 * Plain-text body: every non-empty field, one per line, with nested objects
 * (the form's `extra`) flattened as parent.child. Multi-line values such as the
 * message keep their line breaks, indented under the label.
 */
export const noticeText = (heading, fields) => {
  const lines = [heading, ''];
  const add = (label, value) => {
    if (value === null || value === undefined || value === '') return;
    if (typeof value === 'object' && !Array.isArray(value)) {
      for (const [k, v] of Object.entries(value)) add(`${label}.${k}`, v);
      return;
    }
    const text = String(value).replace(/\r\n?/g, '\n').trim();
    if (!text) return;
    lines.push(text.includes('\n') ? `${label}:\n  ${text.replace(/\n/g, '\n  ')}` : `${label}: ${text}`);
  };
  for (const [key, value] of Object.entries(fields)) add(key, value);
  return lines.join('\n');
};

/**
 * Sends the notice. Returns 'sent', 'not_configured', 'failed_<status>' or
 * 'threw_<name>'. Never throws.
 */
export async function sendNotice(env, { subject, text, replyTo }) {
  if (!env.RESEND_API_KEY || !env.NOTIFY_FROM) return 'not_configured';
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: env.NOTIFY_FROM,
        to: [env.NOTIFY_TO || DEFAULT_NOTIFY_TO],
        subject,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok ? 'sent' : `failed_${res.status}`;
  } catch (error) {
    return `threw_${error instanceof Error ? error.name : 'error'}`;
  }
}
