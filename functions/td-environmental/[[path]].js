/**
 * Blocks /td-environmental/* on the public brokerage site.
 *
 * Cloudflare Pages deploys this repository root, so every committed file is
 * otherwise fetchable over HTTPS — including the TD Environmental project's
 * source and its YAML research data (a prospect call list, subcontractor
 * records, and pricing once those files are populated). None of that belongs
 * on tdrealtyohio.com.
 *
 * Pages routes a request to a matching Function before it reaches the static
 * asset server, so this catch-all shadows every path under
 * /td-environmental/ regardless of what is committed there. Note that rules in
 * _redirects are NOT applied to requests a Function serves, which is why the
 * block lives here rather than in that file.
 *
 * This is a stopgap. The project is meant to be extracted into its own
 * repository; do that before pasting real research data into it.
 */
export const onRequest = () =>
  new Response('Not found.\n', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'x-robots-tag': 'noindex, nofollow',
      'cache-control': 'no-store',
    },
  });
