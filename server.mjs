import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normPhone, cleanName, newCode, newToken, sign, unsign, safeEq, parseCookies, makeLimiter, csvCell } from './lib/util.mjs';
import { DEFAULT_SETTINGS } from './lib/content.mjs';
import { crmEnabled, sendLead, setupPipeline } from './lib/amocrm.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || join(ROOT, 'data');
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const CONTACT_PHONE = process.env.CONTACT_PHONE || '+77066088080';
await mkdir(DATA_DIR, { recursive: true });

const db = new DatabaseSync(join(DATA_DIR, 'app.db'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS alumni(id INTEGER PRIMARY KEY, code TEXT UNIQUE NOT NULL, token TEXT UNIQUE NOT NULL, name TEXT NOT NULL, phone TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS leads(id INTEGER PRIMARY KEY, alumni_id INTEGER NOT NULL REFERENCES alumni(id), name TEXT NOT NULL, phone TEXT NOT NULL, source TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', bonus_paid INTEGER NOT NULL DEFAULT 0, crm_status TEXT NOT NULL DEFAULT 'pending', crm_id TEXT, crm_error TEXT, created_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS leads_phone ON leads(phone);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);`);

try { db.exec("ALTER TABLE leads ADD COLUMN reward TEXT NOT NULL DEFAULT 'bonus'"); } catch {}
try { db.exec('ALTER TABLE alumni ADD COLUMN clicks INTEGER NOT NULL DEFAULT 0'); } catch {}
const getSetting = (k, d) => { const r = db.prepare('SELECT value FROM settings WHERE key=?').get(k); return r ? JSON.parse(r.value) : d; };
const setSetting = (k, v) => db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, JSON.stringify(v));
const cfg = () => ({
  unlock: { ...DEFAULT_SETTINGS.unlock, ...getSetting('unlock', {}) },
  offer: { ...DEFAULT_SETTINGS.offer, ...getSetting('offer', {}) },
  message: getSetting('message', DEFAULT_SETTINGS.message),
  thanks: getSetting('thanks', DEFAULT_SETTINGS.thanks),
  story: { ...DEFAULT_SETTINGS.story, ...getSetting('story', {}) },
  lessons: getSetting('lessons', DEFAULT_SETTINGS.lessons),
});
let secret = getSetting('secret', null);
if (!secret) { secret = randomBytes(32).toString('hex'); setSetting('secret', secret); }

const limit = makeLimiter();
const webhookKey = () => { let k = getSetting('webhook_key', null); if (!k) { k = randomBytes(16).toString('hex'); setSetting('webhook_key', k); } return k; };
const STATUSES = ['new', 'contacted', 'interested', 'awaiting_payment', 'paid', 'rejected'];
const now = () => new Date().toISOString();
const isProd = !!PUBLIC_URL.startsWith('https://');

// ---------- helpers ----------
const send = (res, code, data, headers = {}) => {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  res.writeHead(code, { 'Content-Type': typeof data === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
};
const readJson = (req) => new Promise((resolve, reject) => {
  let n = 0; const chunks = [];
  req.on('data', (c) => { n += c.length; if (n > 20_000) { reject(new Error('too big')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch { reject(new Error('bad json')); } });
  req.on('error', reject);
});
const ip = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
const sameOrigin = (req) => { const o = req.headers.origin; if (!o) return true; try { return new URL(o).host === req.headers.host; } catch { return false; } };
const cookie = (name, val, maxAge) => `${name}=${encodeURIComponent(val)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isProd ? '; Secure' : ''}`;
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const baseUrl = (req) => PUBLIC_URL || `http://${req.headers.host}`;

const alumniFrom = (req, url) => {
  const c = parseCookies(req.headers.cookie);
  const t = c.bp_token || req.headers['x-alumni-token'];
  return t ? db.prepare('SELECT * FROM alumni WHERE token=?').get(String(t)) : null;
};
const isAdmin = (req) => { const v = unsign(secret, parseCookies(req.headers.cookie).bp_admin); return !!v && Number(v) > Date.now(); };
const activeCount = (aid) => db.prepare("SELECT COUNT(*) c FROM leads WHERE alumni_id=? AND status!='rejected'").get(aid).c;

const view = (a, req) => {
  const c = cfg(), n = activeCount(a.id);
  const leads = db.prepare('SELECT id,name,phone,source,status,reward,bonus_paid,created_at FROM leads WHERE alumni_id=? ORDER BY id DESC').all(a.id)
    .map((l) => ({ ...l, phone: '+' + l.phone.slice(0, 4) + '•••' + l.phone.slice(-2) }));
  return {
    alumni: { name: a.name, code: a.code },
    link: `${baseUrl(req)}/r/${a.code}`,
    count: n,
    stats: (() => {
      const all = db.prepare('SELECT status,reward,bonus_paid FROM leads WHERE alumni_id=?').all(a.id);
      const mine = all.filter((l) => l.reward === 'bonus');
      return {
        clicks: db.prepare('SELECT clicks FROM alumni WHERE id=?').get(a.id).clicks,
        leads: all.filter((l) => l.status !== 'rejected').length,
        paid: all.filter((l) => l.status === 'paid').length,
        earned: mine.filter((l) => l.status === 'paid').length * c.offer.bonus,
        pending: mine.filter((l) => !['paid', 'rejected'].includes(l.status)).length * c.offer.bonus,
        payout: mine.filter((l) => l.bonus_paid).length * c.offer.bonus,
      };
    })(),
    unlock: c.unlock,
    template: c.message,
    offer: { bonus: c.offer.bonus, discount: c.offer.presale - c.offer.friend, discountTransfer: c.offer.presale - c.offer.transferred },
    leads,
    lessons: c.lessons.map((l) => ({ id: l.id, title: l.title, description: l.description, topics: l.body.split('\n').filter((x) => x.startsWith('## ')).map((x) => x.slice(3)), need: c.unlock['lesson' + l.id] ?? 99, unlocked: n >= (c.unlock['lesson' + l.id] ?? 99) })),
  };
};

// ---------- CRM outbox ----------
const inflight = new Set();
async function pushToCrm(leadId) {
  if (!crmEnabled() || inflight.has(leadId)) return;
  inflight.add(leadId);
  try { await pushOne(leadId); } finally { inflight.delete(leadId); }
}
async function pushOne(leadId) {
  const l = db.prepare('SELECT * FROM leads WHERE id=?').get(leadId);
  if (!l || l.crm_status === 'sent') return;
  const a = db.prepare('SELECT * FROM alumni WHERE id=?').get(l.alumni_id);
  try {
    const id = await sendLead(l, a, getSetting('crm', null), cfg().offer);
    db.prepare("UPDATE leads SET crm_status='sent', crm_id=?, crm_error=NULL WHERE id=?").run(id, leadId);
  } catch (e) {
    db.prepare("UPDATE leads SET crm_status='error', crm_error=? WHERE id=?").run(String(e.message).slice(0, 400), leadId);
  }
}

// ---------- API ----------
async function api(req, res, url) {
  const path = url.pathname, m = req.method;
  if (path === '/api/amocrm/webhook' && m === 'POST') {
    if (!safeEq(url.searchParams.get('key') || '', webhookKey())) return send(res, 403, { error: 'key' });
    const raw = await new Promise((ok) => { let n = 0; const ch = []; req.on('data', (c) => { n += c.length; if (n < 300_000) ch.push(c); }); req.on('end', () => ok(Buffer.concat(ch).toString())); req.on('error', () => ok('')); });
    const ev = new Map();
    for (const [k, v] of new URLSearchParams(raw)) { const mm = k.match(/^leads\[(?:status|update)\]\[(\d+)\]\[(id|status_id)\]$/); if (mm) ev.set(mm[1], { ...(ev.get(mm[1]) || {}), [mm[2]]: v }); }
    const map = getSetting('crm', null)?.statusMap || { 142: 'paid', 143: 'rejected' };
    let changed = 0;
    for (const { id, status_id } of ev.values()) { const st = map[status_id]; if (!id || !st) continue; changed += Number(db.prepare('UPDATE leads SET status=? WHERE crm_id=?').run(st, String(id)).changes); }
    return send(res, 200, { ok: true, changed });
  }
  if (m !== 'GET' && !sameOrigin(req)) return send(res, 403, { error: 'origin' });
  const body = m === 'POST' || m === 'PUT' ? await readJson(req).catch(() => null) : {};
  if (body === null) return send(res, 400, { error: 'Дұрыс емес сұраныс' });
  if (body.website) return send(res, 200, { ok: true }); // honeypot

  if (path === '/api/config' && m === 'GET') { const c = cfg(); return send(res, 200, { story: c.story, contact: CONTACT_PHONE, unlock: c.unlock, offer: { bonus: c.offer.bonus, discount: c.offer.presale - c.offer.friend, discountTransfer: c.offer.presale - c.offer.transferred }, lessons: c.lessons.map((l) => ({ id: l.id, title: l.title, description: l.description, topics: l.body.split('\n').filter((x) => x.startsWith('## ')).map((x) => x.slice(3)) })) }); }

  if (path === '/api/me' && m === 'GET') {
    const a = alumniFrom(req);
    return send(res, 200, a ? view(a, req) : { alumni: null });
  }

  if (path === '/api/ref' && m === 'GET') {
    const code = String(url.searchParams.get('code') || '').toUpperCase();
    const r = db.prepare('SELECT name FROM alumni WHERE code=?').get(code);
    if (r && limit('click:' + ip(req) + code, 1, 3600_000)) db.prepare('UPDATE alumni SET clicks=clicks+1 WHERE code=?').run(code);
    return send(res, 200, r ? { sender: r.name.split(' ')[0] } : { sender: null });
  }

  if (path === '/api/register' && m === 'POST') {
    if (!limit('reg:' + ip(req), 20)) return send(res, 429, { error: 'Тым көп әрекет. Кейінірек қайталаңыз.' });
    const name = cleanName(body.name), phone = normPhone(body.phone);
    if (name.length < 2) return send(res, 400, { error: 'Атыңызды жазыңыз' });
    if (!phone) return send(res, 400, { error: 'Нөмір дұрыс емес. Мысалы: +7 701 123 45 67' });
    if (!body.consent) return send(res, 400, { error: 'Келісімді белгілеңіз' });
    const ex = db.prepare('SELECT * FROM alumni WHERE phone=?').get(phone);
    if (ex) return send(res, 409, { error: 'Бұл нөмір тіркелген. Алғашқы құрылғыңыздағы сілтемені ашыңыз немесе бізге жазыңыз.' });
    let code; do code = newCode(); while (db.prepare('SELECT 1 FROM alumni WHERE code=?').get(code));
    const token = newToken();
    db.prepare('INSERT INTO alumni(code,token,name,phone,created_at) VALUES(?,?,?,?,?)').run(code, token, name, phone, now());
    const a = db.prepare('SELECT * FROM alumni WHERE token=?').get(token);
    return send(res, 200, { ...view(a, req), token }, { 'Set-Cookie': cookie('bp_token', token, 60 * 60 * 24 * 365) });
  }

  if (path === '/api/lead' && m === 'POST') {
    if (!limit('lead:' + ip(req), 60)) return send(res, 429, { error: 'Тым көп әрекет. Кейінірек қайталаңыз.' });
    const name = cleanName(body.name), phone = normPhone(body.phone);
    if (name.length < 2) return send(res, 400, { error: 'Досыңыздың атын жазыңыз' });
    if (!phone) return send(res, 400, { error: 'Нөмір дұрыс емес. Мысалы: +7 701 123 45 67' });
    if (!body.consent) return send(res, 400, { error: 'Келісімді белгілеңіз' });
    const me = alumniFrom(req);
    let owner, source;
    if (body.onBehalf) { if (!me) return send(res, 401, { error: 'Алдымен тіркеліңіз' }); owner = me; source = 'alumni'; }
    else { owner = db.prepare('SELECT * FROM alumni WHERE code=?').get(String(body.code || '').toUpperCase()); source = 'self'; if (!owner) return send(res, 400, { error: 'Шақыру сілтемесі жарамсыз' }); }
    if (phone === owner.phone) return send(res, 400, { error: 'Өз нөміріңізді қосуға болмайды' });
    if (db.prepare('SELECT 1 FROM leads WHERE phone=?').get(phone) || db.prepare('SELECT 1 FROM alumni WHERE phone=?').get(phone))
      return send(res, 409, { error: 'Бұл нөмір бұрын жіберілген. Басқа досыңызды қосыңыз 😉', duplicate: true });
    const reward = body.onBehalf && body.reward === 'transfer' ? 'transfer' : 'bonus';
    const r = db.prepare('INSERT INTO leads(alumni_id,name,phone,source,reward,created_at) VALUES(?,?,?,?,?,?)').run(owner.id, name, phone, source, reward, now());
    pushToCrm(Number(r.lastInsertRowid)); // фонда
    const out = { ok: true };
    if (body.onBehalf) {
      const sender = owner.name.split(' ')[0], link = `${baseUrl(req)}/r/${owner.code}`;
      const text = cfg().message.replaceAll('{friend}', name.split(' ')[0]).replaceAll('{sender}', sender).replaceAll('{link}', link);
      out.whatsapp = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
      Object.assign(out, view(owner, req));
    }
    return send(res, 200, out);
  }

  if (path.startsWith('/api/lesson/') && m === 'GET') {
    const a = alumniFrom(req); if (!a) return send(res, 401, { error: 'Алдымен тіркеліңіз' });
    const id = Number(path.split('/').pop()), c = cfg(), l = c.lessons.find((x) => x.id === id);
    if (!l) return send(res, 404, { error: 'Табылмады' });
    const need = c.unlock['lesson' + id] ?? 99, n = activeCount(a.id);
    if (n < need) return send(res, 403, { error: `Ашу үшін тағы ${need - n} нөмір керек` });
    return send(res, 200, { id: l.id, title: l.title, body: l.body });
  }

  // ----- admin -----
  if (path === '/api/admin/login' && m === 'POST') {
    if (!limit('adm:' + ip(req), 10, 900_000)) return send(res, 429, { error: 'Тым көп әрекет' });
    if (!ADMIN_PASSWORD || !safeEq(body.password || '', ADMIN_PASSWORD)) return send(res, 401, { error: 'Қате пароль' });
    return send(res, 200, { ok: true }, { 'Set-Cookie': cookie('bp_admin', sign(secret, String(Date.now() + 12 * 3600_000)), 12 * 3600) });
  }
  if (path.startsWith('/api/admin/')) {
    if (!isAdmin(req)) return send(res, 401, { error: 'auth' });
    if (path === '/api/admin/logout') return send(res, 200, { ok: true }, { 'Set-Cookie': cookie('bp_admin', '', 0) });
    if (path === '/api/admin/data' && m === 'GET') {
      const leads = db.prepare('SELECT l.*, a.name alumni_name, a.phone alumni_phone, a.code alumni_code FROM leads l JOIN alumni a ON a.id=l.alumni_id ORDER BY l.id DESC LIMIT 2000').all();
      const alumni = db.prepare('SELECT a.id,a.name,a.phone,a.code,a.created_at,(SELECT COUNT(*) FROM leads l WHERE l.alumni_id=a.id AND l.status!=\'rejected\') leads FROM alumni a ORDER BY a.id DESC LIMIT 2000').all();
      return send(res, 200, { leads, alumni, settings: cfg(), crm: { enabled: crmEnabled(), config: getSetting('crm', null), webhook: `${baseUrl(req)}/api/amocrm/webhook?key=${webhookKey()}` }, statuses: STATUSES });
    }
    if (path === '/api/admin/lead' && m === 'POST') {
      const id = Number(body.id);
      if (body.status) { if (!STATUSES.includes(body.status)) return send(res, 400, { error: 'status' }); db.prepare('UPDATE leads SET status=? WHERE id=?').run(body.status, id); }
      if (typeof body.bonus_paid === 'boolean') db.prepare('UPDATE leads SET bonus_paid=? WHERE id=?').run(body.bonus_paid ? 1 : 0, id);
      return send(res, 200, { ok: true });
    }
    if (path === '/api/admin/settings' && m === 'POST') {
      const u = body.unlock; 
      if (u) { const a = Math.max(0, Math.min(50, Number(u.lesson1))), b = Math.max(0, Math.min(50, Number(u.lesson2))); if (Number.isFinite(a) && Number.isFinite(b)) setSetting('unlock', { lesson1: a, lesson2: b }); }
      const o = body.offer; if (o) { const n = (v, d) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : d); const cur = cfg().offer; setSetting('offer', { presale: n(o.presale, cur.presale), friend: n(o.friend, cur.friend), transferred: n(o.transferred, cur.transferred), bonus: n(o.bonus, cur.bonus) }); }
      const st = body.story;
      if (st && typeof st === 'object') {
        const t = (v, n) => String(v ?? '').slice(0, n);
        setSetting('story', { cohorts: Math.max(0, Math.min(999, Math.round(Number(st.cohorts) || 0))), since: t(st.since, 40), tagline: t(st.tagline, 120), about: t(st.about, 600),
          community: (Array.isArray(st.community) ? st.community : []).map((x) => t(x, 160)).filter(Boolean).slice(0, 6),
          cases: (Array.isArray(st.cases) ? st.cases : []).map((c) => ({ name: t(c.name, 60), role: t(c.role, 100), result: t(c.result, 240) })).filter((c) => c.name && c.result).slice(0, 8) });
      }
      if (typeof body.thanks === 'string') setSetting('thanks', body.thanks.slice(0, 800));
      if (typeof body.message === 'string' && body.message.includes('{link}')) setSetting('message', body.message.slice(0, 1500));
      else if (typeof body.message === 'string') return send(res, 400, { error: 'Мәтінде {link} болуы керек' });
      if (Array.isArray(body.lessons)) setSetting('lessons', body.lessons.slice(0, 10).map((l, i) => ({ id: Number(l.id) || i + 1, title: String(l.title).slice(0, 120), description: String(l.description || '').slice(0, 240), body: String(l.body || '').slice(0, 20000) })));
      return send(res, 200, { ok: true, settings: cfg() });
    }
    if (path === '/api/admin/crm/setup' && m === 'POST') {
      if (!crmEnabled()) return send(res, 400, { error: 'AMO_DOMAIN және AMO_TOKEN орнатылмаған (env)' });
      try { const r = await setupPipeline(); setSetting('crm', r); return send(res, 200, { ok: true, config: r }); }
      catch (e) { return send(res, 502, { error: e.message }); }
    }
    if (path === '/api/admin/crm/retry' && m === 'POST') {
      if (!crmEnabled()) return send(res, 400, { error: 'amoCRM қосылмаған' });
      const ids = db.prepare("SELECT id FROM leads WHERE crm_status!='sent' ORDER BY id LIMIT 100").all();
      for (const r of ids) await pushToCrm(r.id);
      return send(res, 200, { ok: true, tried: ids.length });
    }
    if (path === '/api/admin/export.csv' && m === 'GET') {
      const rows = db.prepare('SELECT l.id,l.created_at,l.name,l.phone,l.status,l.source,l.reward,l.bonus_paid,l.crm_status,a.name an,a.phone ap,a.code FROM leads l JOIN alumni a ON a.id=l.alumni_id ORDER BY l.id').all();
      const csv = ['id,created,name,phone,status,source,reward,bonus_paid,crm,alumni,alumni_phone,code', ...rows.map((r) => [r.id, r.created_at, r.name, '+' + r.phone, r.status, r.source, r.reward, r.bonus_paid, r.crm_status, r.an, '+' + r.ap, r.code].map(csvCell).join(','))].join('\n');
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="leads.csv"' }); return res.end('﻿' + csv);
    }
  }
  return send(res, 404, { error: 'not found' });
}

// ---------- static ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json' };
async function page(req, res, refCode) {
  let t = await readFile(join(ROOT, 'public', 'index.html'), 'utf8');
  const base = baseUrl(req);
  let title = 'Baipket Alumni Challenge', desc = 'Йоууу! Өз адамдарымыз осында. Baipket alumni community.';
  const a = refCode ? db.prepare('SELECT name FROM alumni WHERE code=?').get(String(refCode).toUpperCase()) : null;
  if (a) { title = `${a.name.split(' ')[0]} сізге шақыру жіберді · Baipket`; desc = 'Baipket қауымдастығымен танысыңыз: 10 поток, түлектер, нақты жол. Міндет жоқ.'; }
  const og = `<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${esc(base)}/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="description" content="${esc(desc)}">`;
  t = t.replace('<!--OG-->', og).replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }); res.end(t);
}
async function serve(req, res, url) {
  const rm = url.pathname.match(/^\/r\/([A-Za-z0-9]{3,12})$/);
  if (rm) return page(req, res, rm[1]);
  if (url.pathname === '/') return page(req, res, url.searchParams.get('ref'));
  let p = url.pathname === '/' ? '/index.html' : url.pathname === '/admin' ? '/admin.html' : url.pathname;
  const file = normalize(join(ROOT, 'public', p));
  if (!file.startsWith(join(ROOT, 'public'))) return send(res, 403, 'forbidden');
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=300' });
    res.end(data);
  } catch { send(res, 404, 'Табылмады'); }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    return await serve(req, res, url);
  } catch (e) { console.error(e); if (!res.headersSent) send(res, 500, { error: 'Сервер қатесі' }); }
});
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!ADMIN_PASSWORD) console.warn('! ADMIN_PASSWORD орнатылмаған: админ панель жабық.');
  if (crmEnabled()) setInterval(async () => { for (const r of db.prepare("SELECT id FROM leads WHERE crm_status!='sent' AND created_at < ? ORDER BY id LIMIT 20").all(new Date(Date.now() - 30_000).toISOString())) await pushToCrm(r.id); }, 60_000).unref();
  server.listen(PORT, () => console.log(`http://localhost:${PORT}  crm=${crmEnabled() ? 'on' : 'off'}`));
}
export { server };
