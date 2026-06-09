import crypto from 'crypto';
import * as cheerio from 'cheerio';

export async function fetchCleanText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent': 'RivalSenseDatabaseIntel/0.1' }, cache: 'no-store' });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  $('script, style, nav, footer, header, noscript, svg').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  return text.slice(0, 120000);
}

export function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}
