// Poll Drafts CSV, Board CSV and Board pubhtml every INTERVAL s; log when any content hash changes.
// Purpose: observe real update latency and whether CSV vs HTML endpoints change at different times.
import { createHash } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { csvUrl, htmlUrl, GID } from './sheet.mjs';
const INTERVAL = +(process.env.INTERVAL || 30), DURATION = +(process.env.DURATION || 1800);
const h = (s) => createHash('sha1').update(s).digest('hex').slice(0, 10);
const last = {};
const t0 = Date.now();
while (Date.now() - t0 < DURATION * 1000) {
  const urls = { draftsCsv: csvUrl(GID.drafts) + `&_=${Date.now()}`, boardCsv: csvUrl(GID.board) + `&_=${Date.now()}`, boardHtml: htmlUrl(GID.board) + `&_=${Date.now()}` };
  for (const [k, u] of Object.entries(urls)) {
    try {
      const r = await fetch(u, { cache: 'no-store' }); let body = await r.text();
      if (k === 'boardHtml') body = body.slice(body.indexOf('<tbody'), body.indexOf('</tbody>')).replace(/class="s\d+"/g, (m) => m); // table only
      const hv = h(body);
      if (last[k] !== hv) { appendFileSync('freshness-log.txt', `${new Date().toISOString()} ${k} ${last[k] || '-'} -> ${hv} (status ${r.status}, date ${r.headers.get('date')})\n`); last[k] = hv; }
    } catch (e) { appendFileSync('freshness-log.txt', `${new Date().toISOString()} ${k} ERROR ${e.message}\n`); }
  }
  await new Promise((r) => setTimeout(r, INTERVAL * 1000));
}
appendFileSync('freshness-log.txt', `${new Date().toISOString()} done\n`);
