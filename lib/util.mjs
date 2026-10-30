import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';

export const normPhone = (raw) => {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
  if (d.length === 10) d = '7' + d;
  return /^7\d{10}$/.test(d) ? d : null;
};
export const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().replace(/\s+/g, ' ').slice(0, 60);
export const newCode = () => randomBytes(5).toString('base64url').replace(/[-_]/g, 'x').slice(0, 7).toUpperCase();
export const newToken = () => randomBytes(24).toString('base64url');

export const sign = (secret, v) => v + '.' + createHmac('sha256', secret).update(v).digest('base64url');
export const unsign = (secret, s) => {
  const i = String(s || '').lastIndexOf('.');
  if (i < 1) return null;
  const v = s.slice(0, i), mac = createHmac('sha256', secret).update(v).digest();
  let given; try { given = Buffer.from(s.slice(i + 1), 'base64url'); } catch { return null; }
  return given.length === mac.length && timingSafeEqual(given, mac) ? v : null;
};
export const safeEq = (a, b) => {
  const x = createHmac('sha256', 'k').update(String(a)).digest(), y = createHmac('sha256', 'k').update(String(b)).digest();
  return timingSafeEqual(x, y);
};
export const parseCookies = (h) => Object.fromEntries(String(h || '').split(/;\s*/).filter(Boolean).map((p) => { const i = p.indexOf('='); return [p.slice(0, i), decodeURIComponent(p.slice(i + 1))]; }));

export function makeLimiter() {
  const hits = new Map();
  return (key, max, windowMs = 3600_000) => {
    const now = Date.now(), arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) { hits.set(key, arr); return false; }
    arr.push(now); hits.set(key, arr);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    return true;
  };
}
export const csvCell = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
