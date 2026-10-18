/**
 * Sends a stored form record to Travis's Google Sheets through the "TD website
 * intake" Apps Script web app (tools/sheets-intake/Code.gs). The record is
 * already in KV when this runs, so a failure here never loses it: it is
 * logged with the record key and the Worker can replay it from KV.
 *
 *   SHEETS_WEBHOOK_URL     Plain variable: the web app's /exec URL.
 *   SHEETS_WEBHOOK_SECRET  Secret: the shared secret setup() made in the script.
 *
 * Returns 'written', 'not_configured', or 'failed_<reason>'.
 */
export const sendToSheets = async (env, payload) => {
  if (!env.SHEETS_WEBHOOK_URL || !env.SHEETS_WEBHOOK_SECRET) return 'not_configured';
  try {
    const res = await fetch(env.SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: env.SHEETS_WEBHOOK_SECRET, ...payload }),
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return `failed_${res.status}`;
    const out = await res.json().catch(() => ({}));
    return out.ok === true ? 'written' : `failed_${out.error || 'no_ok'}`;
  } catch (error) {
    return `failed_${error instanceof Error ? error.name : 'error'}`;
  }
};
