import { character, ROLE_DEFS, roleIndex } from './char.js';
const $root = document.getElementById('root');
const params = new URLSearchParams(location.search);
const refM = location.pathname.match(/^\/r\/([A-Za-z0-9]+)/);
const ref = ((refM && refM[1]) || params.get('ref') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
let me = null, cfg = { contact: '', unlock: { lesson1: 2, lesson2: 2 }, offer: { bonus: 20000, discount: 50000, discountTransfer: 70000 }, lessons: [] };
const LEVELS = [[0, 'Starter'], [500, 'Hustler'], [1500, 'Closer'], [3500, 'Legend']];
const same = () => cfg.unlock.lesson1 === cfg.unlock.lesson2;
const money = (n) => Number(n).toLocaleString('ru-RU').replace(/ /g, ' ') + ' ₸';

const ICONS = {
  arrow: '<path d="M7 17 17 7M8 7h9v9"/>', gift: '<path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  check: '<path d="m5 12 5 5 9-10"/>', lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z"/>',
  play: '<path d="m8 5 11 7-11 7z"/>', shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>', spark: '<path d="M12 3l2.2 6.3L21 12l-6.8 2.7L12 21l-2.2-6.3L3 12l6.8-2.7z"/>',
};
const ic = (n, cls = 'ic') => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', cls); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = ICONS[n]; return s; };
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v); }
  for (const c of kids.flat()) { if (c == null || c === false) continue; e.append(c instanceof Node ? c : document.createTextNode(c)); }
  return e;
};
const html = (s, cls) => { const d = h('div', { class: cls || '' }); d.innerHTML = s; return d; };
const mount = (...n) => { $root.replaceChildren(...n.filter(Boolean)); observe(); tilt(); };
async function api(path, body) {
  const t = store.get('bp_token');
  const r = await fetch('/api/' + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(t ? { 'x-alumni-token': t } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || 'Қате шықты. Қайталап көріңіз.'), { data: j, status: r.status });
  return j;
}
const toast = (t) => { const e = h('div', { class: 'toast', role: 'status' }, t); document.body.append(e); setTimeout(() => e.remove(), 4500); };
const boom = () => { const b = h('div', { class: 'boom' }); const em = ['🎉', '✨', '🔥', '🎁', '⚡', '🧡']; for (let i = 0; i < 30; i++) b.append(h('b', { style: `left:${Math.random() * 100}%;animation-delay:${Math.random() * .6}s;font-size:${16 + Math.random() * 22}px` }, em[i % em.length])); document.body.append(b); setTimeout(() => b.remove(), 2600); };
const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
const ava = (i, stripes, bg = 'disc') => html(character(i, { stripes, bg }), 'ava');
const countUp = (el, to, fmt = (v) => v) => { const t0 = performance.now(), d = 700; const f = (t) => { const p = Math.min(1, (t - t0) / d); el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); };
function observe() { if (!('IntersectionObserver' in window)) return; const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .08 }); document.querySelectorAll('.rv').forEach((el) => io.observe(el)); }
function tilt() { if (!matchMedia('(hover:hover)').matches || matchMedia('(prefers-reduced-motion:reduce)').matches) return; const w = document.querySelector('.passwrap'), c = w?.querySelector('.pcard'); if (!c) return; w.addEventListener('mousemove', (e) => { const r = w.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; c.style.transform = `rotateY(${x * 6}deg) rotateX(${-y * 6}deg)`; }); w.addEventListener('mouseleave', () => (c.style.transform = '')); }

function form(fields, submitText, onSubmit, opts = {}) {
  const err = h('p', { class: 'err', role: 'alert' });
  const btn = h('button', { class: 'btn ' + (opts.cls || 'acc') + ' block', type: 'submit' }, submitText, ic('arrow'));
  const f = h('form', { novalidate: true, autocomplete: 'on' },
    h('div', { class: opts.row ? 'two' : '' }, fields.map((x) => h('div', {}, h('label', { class: 'l', for: x.id }, x.label), h('input', { id: x.id, name: x.id, type: x.type || 'text', inputmode: x.type === 'tel' ? 'tel' : null, autocomplete: x.ac || 'off', placeholder: x.ph || '', maxlength: 60, required: true })))),
    opts.extra,
    h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'consent' }), h('span', {}, opts.consent)),
    h('input', { class: 'hp', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' }), btn, err);
  if (opts.oninput) f.addEventListener('input', () => opts.oninput(f));
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = ''; btn.disabled = true;
    const d = Object.fromEntries(new FormData(f)); d.consent = f.consent.checked;
    try { await onSubmit(d, f); } catch (ex) { err.textContent = ex.message; } finally { btn.disabled = false; }
  });
  return f;
}

// ---------- shared chrome ----------
function nav(primary, friend) {
  return h('header', { class: 'nav' }, h('div', { class: 'wrap in' },
    h('a', { class: 'logo', href: '/' }, h('b', {}, 'Baipket'), h('i', {}, 'ALUMNI', h('br'), 'CHALLENGE')),
    h('nav', { class: 'links' }, ...(friend ? [['tour', 'Таныстыру'], ['cohorts', 'Ағын'], ['community', 'Қауымдастық']] : [['lessons', 'Модульдер 🎁'], ['bonus', 'Бонус 👀']]).map(([id, t]) => h('a', { href: '#' + id, onclick: (e) => { e.preventDefault(); go(id); } }, t)),
      cfg.contact ? h('a', { href: 'https://wa.me/' + cfg.contact.replace(/\D/g, ''), rel: 'noopener' }, 'Baipket') : null, primary)));
}
function footer() {
  return h('footer', {}, h('div', { class: 'wrap' }, h('div', { class: 'row' }, h('b', { style: 'font:700 26px Caveat,cursive;color:var(--ink)' }, 'Baipket'), h('span', {}, '© 2026 Baipket'), h('span', {}, h('a', { href: '/admin' }, 'Админ'))),
    h('details', {}, h('summary', {}, 'Құпиялық және келісім'), h('p', {}, 'Сіз берген аты мен телефон нөмірі тек Baipket командасымен байланысу және challenge нәтижесін есептеу үшін қолданылады. Досыңыздың нөмірін оның келісімімен ғана беріңіз: Baipket оған бір рет, ұсыныс туралы хабарласады. Деректі жою үшін WhatsApp-қа жазыңыз, біз өшіреміз.'))));
}
const marq = () => h('div', { class: 'marq', 'aria-hidden': 'true' }, h('div', {}, Array(10).fill(0).map(() => ['ӨЗ АДАМДАРЫМЫЗ ОСЫНДА', 'БІРГЕ ӨСКЕН ҚЫЗЫҚ ҚОЙ', 'СІЗГЕ ЖАҢА БОНУС', 'BAIPKET ALUMNI'].map((t) => [t, h('span', {}, '✦')])).flat(2)));
const faq = () => h('section', { class: 's wrap rv', style: 'padding-top:0' }, h('h2', { style: 'font-size:28px;margin-bottom:18px' }, 'Жиі сұрақтар'),
  [['Мен бірдеңе сатуым керек пе?', 'Жоқ. Сіз тек досыңызбен бөлісесіз. Бағдарламаны біз өзіміз түсіндіреміз.'], ['Нөмірін рұқсатсыз беруге бола ма?', 'Жоқ. Досыңыздың келісімі болуы керек. Келісім болмаса, оған жеке сілтемені жіберіңіз, нөмірін өзі қалдырады.'], ['Бонус қашан есептеледі?', 'Досыңыздың төлемі расталғанда. Біз сізге WhatsApp-қа жазамыз.'], ['Сабақтар қашан ашылады?', (cfg.unlock.lesson1 === cfg.unlock.lesson2 ? `${cfg.unlock.lesson1} дос қоссаңыз, екі модуль да ашылады.` : `${cfg.unlock.lesson1} нөмірден кейін 1-модуль, ${cfg.unlock.lesson2} нөмірден кейін 2-модуль ашылады.`)]].map(([q, a]) => h('details', {}, h('summary', {}, q), h('p', {}, a))),
  cfg.contact ? h('div', { class: 'contact' }, h('div', {}, h('b', {}, 'Бір нәрсе сұрағыңыз келсе 👋'), h('div', { class: 'sm mut' }, cfg.contact)), h('a', { class: 'btn', href: 'https://wa.me/' + cfg.contact.replace(/\D/g, ''), rel: 'noopener' }, ic('chat'), 'WhatsApp-та сөйлесейік')) : null);

// ---------- lessons ----------
const VIZ = [`<svg viewBox="0 0 220 130" width="220" height="130"><defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9a6b"/><stop offset="1" stop-color="#c63f24"/></linearGradient><linearGradient id="g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#efe3d6"/><stop offset="1" stop-color="#9c8d7e"/></linearGradient></defs><g transform="rotate(-8 60 70)"><rect x="22" y="30" width="78" height="78" rx="14" fill="url(#g1)"/><text x="61" y="82" text-anchor="middle" font-family="Inter,Arial" font-weight="800" font-size="30" fill="#fff">ОМ</text></g><text x="110" y="72" text-anchor="middle" fill="#d9c9bd" font-size="18">+</text><g transform="rotate(7 160 60)"><rect x="124" y="20" width="78" height="78" rx="14" fill="url(#g2)"/><text x="163" y="72" text-anchor="middle" font-family="Inter,Arial" font-weight="800" font-size="30" fill="#2a211c">ОП</text></g></svg>`,
`<svg viewBox="0 0 220 130" width="220" height="130"><defs><linearGradient id="g3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb28a"/><stop offset="1" stop-color="#b8472b"/></linearGradient></defs><path d="M40 20h110l-14 26H54z" fill="url(#g3)"/><path d="M58 52h74l-12 26H70z" fill="url(#g3)" opacity=".85"/><path d="M74 84h42l-9 24H83z" fill="url(#g3)" opacity=".7"/><path d="M158 94 196 40M178 40h18v18" stroke="#e8d9c8" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`];
function lessonCard(l, i, count) {
  const locked = !l.unlocked;
  return h('div', { class: 'lesson ' + (locked ? 'locked' : 'open') }, html(VIZ[i % 2], 'viz'), h('small', { class: 't' }, `МОДУЛЬ 0${l.id}`), h('h3', { style: 'margin:6px 0 4px' }, l.title), h('p', { class: 'sm mut', style: 'margin:0' }, l.description),
    h('div', { class: 'tp' }, (l.topics || []).map((t) => h('span', {}, t))),
    h('div', { class: 'ft' }, locked ? (count == null ? h('span', { class: 'lk' }, ic('lock'), 'Достарыңызбен бөлісіп ашасыз') : h('span', { class: 'lk' }, ic('lock'), `Тағы ${Math.max(0, l.need - count)} дос`)) : h('span', { class: 'lk' }, ic('check'), 'Ашық'),
      !locked && count != null ? h('button', { class: 'btn', onclick: () => openLesson(l.id) }, 'Модульді қарап көрейін', ic('arrow')) : null),
    locked && count != null ? h('div', { class: 'pb' }, h('i', { style: `width:${Math.min(100, Math.round((count / l.need) * 100))}%` })) : null);
}
function lessonsSection(list, count, unlockedN) {
  return h('section', { class: 'dark', id: 'lessons' }, h('div', { class: 'wrap rv' }, h('div', { class: 'shead' }, h('div', {}, h('div', { class: 'eyebrow', style: 'color:#d9c9bd' }, 'Сізге кішкене сыйлық бар 🎁'), h('h2', { style: 'margin-top:12px' }, 'Senior Sales.', h('br'), h('span', { style: 'color:#b9aca1' }, 'Екеуі де іске жарайды 😉'))),
    h('div', { class: 'counter' }, String(unlockedN), h('small', {}, ` / ${list.length} АШЫҚ`))),
    h('div', { class: 'lessons' }, list.map((l, i) => lessonCard(l, i, count))),
    h('p', { class: 'xs', style: 'color:#b9aca1;margin-top:18px' }, 'Қазір шолу мен практика бар. Авторлық видеолар қосылғанда осы жерден көресіз.')));
}
function rewardSection() {
  const o = cfg.offer, note = h('p', { class: 'sm mut', style: 'margin:18px 0 0' }, '');
  const tk = (k, ico, title, big, sub, tag) => h('button', { type: 'button', class: 'ticket ' + k, onclick: () => sel(k) }, h('span', { class: 'tk-tag' }, tag), h('div', { class: 'tk-ico' }, ico), h('b', { class: 'tk-t' }, title), h('div', { class: 'tk-big' }, big), h('small', {}, sub));
  const tg = tk('transfer', '🎁', 'Досыма сыйлаймын', money(o.discountTransfer), 'жеңілдік досыңызға. Сізге «Жомарт» белгісі мен +300 XP', 'Жомарт таңдауы');
  const tb = tk('bonus', '💰', 'Бонус өзіме', money(o.bonus), 'сізге, досыңыздың төлемі расталғанда', 'Өзіме');
  const sel = (k) => { tg.classList.toggle('on', k === 'transfer'); tb.classList.toggle('on', k === 'bonus'); note.textContent = k === 'transfer' ? 'Досыңыз сіздің арқаңызда жеңілдік алады. Сіз «Жомарт» белгісін және қосымша XP аласыз 😌' : 'Бонус досыңыздың төлемі расталған соң есептеледі.'; };
  const s = h('section', { class: 's wrap rv', id: 'bonus' }, h('div', { class: 'eyebrow' }, 'Досыңыз оқуға қосылса'), h('h2', { style: 'margin:12px 0 8px' }, 'Сыйлықты кім алады?'), h('p', { class: 'mut', style: 'margin:0 0 22px' }, 'Әр досыңызды қосқанда өзіңіз таңдайсыз: сыйлықты өзіңізге аласыз ба, әлде досыңызға сыйлайсыз ба.'),
    h('div', { class: 'tickets' }, tg, tb), note);
  sel('transfer'); return s;
}
// ---------- guest landing ----------
function landing() {
  const n1 = cfg.unlock.lesson1, n2 = cfg.unlock.lesson2;
  const nameEl = h('div', { class: 'nm' }, 'Сіздің аты-жөніңіз');
  const reg = form([{ id: 'name', label: 'Атыңыз', ac: 'name', ph: 'Мысалы, Айгерім' }, { id: 'phone', label: 'WhatsApp нөміріңіз', type: 'tel', ac: 'tel', ph: '+7 701 123 45 67' }], 'Картамды алу',
    async (d) => { const r = await api('register', d); store.set('bp_token', r.token); me = r; dashboard(true); },
    { consent: 'Мен Senior Marketer түлегімін және деректерімді өңдеуге келісемін.', oninput: (f) => { nameEl.textContent = f.name.value.trim() || 'Сіздің аты-жөніңіз'; } });
  let gi = 0; const gav = h('div', { class: 'ava' }); const gsay = () => { gav.innerHTML = character(gi, { stripes: 1, bg: 'halo' }); gi = (gi + 1) % ROLE_DEFS.length; }; gsay(); const gt = setInterval(() => { if (!document.body.contains(gav)) return clearInterval(gt); gsay(); }, 2200);
  const pass = h('div', { class: 'passwrap' }, h('div', { class: 'pcard' }, h('div', { class: 'pass' }, gav, h('div', { class: 'top' }, h('span', {}, 'ALUMNI PASS'), h('span', {}, 'LVL 01')), h('div', { class: 'rl' }, 'Рөл тіркелген соң түседі 🎲'), nameEl, h('div', { class: 'bt' }, h('span', {}, 'ALUMNI CLUB'), h('b', {}, '100 XP'))), h('div', { class: 'pbody' }, reg)));
  mount(nav(h('a', { class: 'btn sm keep', href: '#reg', onclick: (e) => { e.preventDefault(); go('reg'); } }, 'Менің картам', ic('arrow'))),
    h('div', { class: 'wrap hero', id: 'reg' }, h('div', {},
      h('div', { class: 'eyebrow' }, 'Senior Marketer-де оқыған өз адамдарға'), h('h1', { style: 'margin-top:16px' }, 'Йоууу!', h('em', {}, 'Өз адамдарымыз осында 😄')),
      h('p', { class: 'lead' }, (n1 === n2 ? `Досыңызбен бөліссеңіз, жақсы орта көбейеді. ${n1} дос қоссаңыз, екі модуль да сізге ашылады.` : `Досыңызбен бөліссеңіз, жақсы орта көбейеді. ${n1} дос болса, бірінші модуль, ${n2} дос болса, екіншісі сізге ашылады.`)),
      h('div', { class: 'chips' }, h('span', { class: 'chip' }, ic('gift'), 'Екі модуль сыйға'), h('span', { class: 'chip' }, ic('spark'), money(cfg.offer.bonus) + ' бонус')),
      h('div', { class: 'offer' }, h('div', {}, h('small', {}, 'Досыңызға'), h('b', {}, money(cfg.offer.discount)), h('small', {}, 'жеңілдік')), h('span', { class: 'pl' }, '+'), h('div', {}, h('small', {}, 'Сізге'), h('b', {}, money(cfg.offer.bonus)), h('small', {}, 'бонус'))),
      h('div', { class: 'mini3' }, [['1', 'Карта алыңыз'], ['2', 'Досыңызды қосыңыз'], ['3', 'Модульдер ашылады']].map(([n, t]) => h('div', {}, h('b', {}, n), h('span', {}, t)))),
      h('div', { class: 'cta-row' }, h('a', { class: 'btn acc', href: 'https://www.instagram.com/baipket/', target: '_blank', rel: 'noopener' }, 'Instagram-дағы Baipket community', ic('arrow')))), pass),
    marq(),
    h('section', { class: 's wrap rv' }, h('div', { class: 'shead' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Рөл генераторы 🎲'), h('h2', { style: 'margin:12px 0 0' }, 'Қай Senior сізсіз?'))), h('p', { class: 'mut', style: 'margin:-6px 0 22px' }, 'Тіркелгенде сізге осы алты рөлдің бірі түседі. Белбеуіңіздегі жолақтар деңгейіңізбен бірге өседі.'),
      h('div', { class: 'gal' }, ROLE_DEFS.map((r, i) => h('div', { class: 'gcard' }, ava(i, (i % 4) + 1), h('b', {}, r.name))))),
    h('section', { class: 's wrap rv' }, h('div', { class: 'shead' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Қалай жүреді?'), h('h2', { style: 'margin-top:12px' }, 'Үш қадам. Бәрі осы.'))),
      h('div', { class: 'grid2' }, h('div', { class: 'card' }, [['Картаңызды аласыз', 'Атыңыз бен WhatsApp нөміріңіз. 20 секунд.', '+100 XP'], ['Досыңызды қосасыз', 'Аты мен нөмірін жазасыз, WhatsApp-та дайын хабар ашылады.', '+200 XP'], ['Модульдер ашылады', n1 === n2 ? `${n1} дос қоссаңыз, екі модуль бірден ашылады.` : `${n1} дос = 1-модуль. ${n2} дос = 2-модуль.`, 'UNLOCK']].map(([t, s, x], i) => h('div', { class: 'quest' }, h('div', { class: 'qd', style: 'color:var(--ink);font-weight:800' }, String(i + 1)), h('div', {}, h('b', {}, t), h('small', {}, s)), h('span', { class: 'xp' }, x)))),
        h('div', { class: 'card tint' }, h('h3', {}, 'Досыңызбен бөлісу қауіпсіз'), h('p', { class: 'sm mut' }, 'Нөмір тек досыңыздың рұқсатымен беріледі. Біз досыңызға бір рет қана жазамыз, спам жоқ.'), h('div', { class: 'chip' }, ic('shield'), 'Келісім бар'), h('div', { style: 'height:12px' }), h('button', { class: 'btn acc', type: 'button', onclick: () => go('reg') }, 'Картамды алайын', ic('arrow'))))),
    lessonsSection(cfg.lessons.map((l) => ({ ...l, need: l.id === 1 ? n1 : n2, unlocked: false })), null, 0), rewardSection(), faq(), footer(),
    h('div', { class: 'sticky' }, h('button', { class: 'btn acc', onclick: () => go('reg') }, 'Картамды алу', ic('arrow'))));
}

// ---------- friend ----------
function friendPage(sender) {
  const st = cfg.story || {};
  const waText = `Сәлем! Мен ${sender || 'досымның'} шақыруымен келдім (${ref}) ☺️`;
  const waHref = cfg.contact ? 'https://api.whatsapp.com/send?phone=' + cfg.contact.replace(/\D/g, '') + '&text=' + encodeURIComponent(waText) : null;
  const card = h('div', { class: 'pbody', id: 'fcard' });
  const showForm = () => card.replaceChildren(h('h3', { style: 'margin:6px 0 2px' }, 'Нөміріңізді қалдырыңыз'), h('p', { class: 'sm mut', style: 'margin:0' }, 'Біз өзіміз жазамыз. Міндет жоқ.'),
    form([{ id: 'name', label: 'Атыңыз', ac: 'name' }, { id: 'phone', label: 'WhatsApp нөміріңіз', type: 'tel', ac: 'tel', ph: '+7 701 123 45 67' }], 'Хабарласыңыздар', async (d) => { await api('lead', { ...d, code: ref }); boom(); done(); }, { consent: 'Baipket маған хабарласуына және нөмірімді өңдеуіне келісемін.' }));
  const done = () => card.replaceChildren(h('div', { class: 'big' }, '🙌'), h('h3', { style: 'margin:10px 0 6px' }, 'Керемет, жазылдыңыз!'), h('p', { class: 'mut' }, 'Baipket командасы жақын арада WhatsApp-қа жазады. Күтіп отырыңыз.'), waHref ? h('a', { class: 'btn wa block', href: waHref, rel: 'noopener' }, ic('chat'), 'Қазір өзіңіз жазыңыз') : null);
  showForm();
  const cohorts = Math.max(0, Math.min(24, Number(st.cohorts) || 0));
  const cnum = h('b', {}, '0'); const io = () => countUp(cnum, Number(st.cohorts) || 0);
  setTimeout(io, 400);
  const cta = h('div', { class: 'ctaband' }, h('div', {}, h('h2', { style: 'color:#fff' }, 'Қысқа танысып көрейік пе?'), h('p', { style: 'color:#d9c9bd;margin:10px 0 0' }, 'Бір хабар, 5 минут сөйлесу. Қалғанын өзіңіз шешесіз.')),
    h('div', { class: 'cta-row', style: 'margin:0' }, waHref ? h('a', { class: 'btn acc', href: waHref, rel: 'noopener' }, ic('chat'), 'WhatsApp-та жазу') : null, h('button', { class: 'btn', style: 'background:#fff;color:var(--ink)', onclick: () => { window.scrollTo({ top: 0, behavior: 'smooth' }); } }, 'Нөмір қалдыру', ic('arrow'))));
  mount(nav(h('a', { class: 'btn sm keep', href: '#', onclick: (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }, 'Танысу', ic('arrow')), true),
    h('div', { class: 'wrap hero' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Жеке шақыру'), h('h1', { style: 'margin-top:16px' }, 'Baipket-ке', h('em', {}, 'қош келдіңіз 👋')),
      h('p', { class: 'lead' }, (sender ? sender + ' сізге Baipket-ті көрсеткісі келді. ' : '') + (st.about || '')),
      h('div', { class: 'cta-row' }, h('button', { class: 'btn acc', onclick: () => go('tour') }, 'Экскурсияны бастау', ic('arrow')), waHref ? h('a', { class: 'btn wa', href: waHref, rel: 'noopener' }, ic('chat'), 'WhatsApp-та жазу') : null)),
      h('div', { class: 'passwrap' }, h('div', { class: 'pcard' }, h('div', { class: 'pass' }, ava(roleIndex(ref), 3, 'halo'), h('div', { class: 'top' }, h('span', {}, 'BAIPKET'), h('span', {}, 'INVITE')), h('div', { class: 'rl' }, sender ? 'Шақырған: ' + sender : 'Сізге арналған'), h('div', { class: 'nm' }, 'Жеке шақыру'), h('div', { class: 'bt' }, h('span', {}, 'ALUMNI CLUB'), h('b', {}, '✦'))), card))),
    h('div', { class: 'statband' }, h('div', { class: 'wrap sb' }, h('div', {}, h('div', { class: 'sn' }, cnum, h('i', {}, '+')), h('small', {}, 'ПОТОК ӨТТІ')), h('div', {}, h('div', { class: 'sn' }, h('b', {}, st.since || '')), h('small', {}, 'ЖОЛ ЖҮРІЛДІ')), h('div', {}, h('div', { class: 'sn sm2' }, h('b', {}, st.tagline || '')), h('small', {}, 'ҚАЗАҚ ТІЛІНДЕ')))),
    h('section', { class: 's wrap rv', id: 'tour' }, h('div', { class: 'eyebrow' }, '1 · Baipket дегеніміз не?'), h('h2', { style: 'margin:12px 0 24px' }, 'Курс емес.', h('br'), h('span', { class: 'acc' }, 'Акселерация.')),
      h('div', { class: 'three' }, [['🚀', 'Өсудің «турбо-режимі»', 'Теорияны оқып қана қоймай, өз жобаңызда қолданып, нәтиже көресіз.'], ['🗣️', 'Қазақ тілінде', st.tagline || 'Қазақ тілді маркетинг оқуы'], ['🤝', 'Қауымдастық', 'Бір ортада өсетін, бір-біріне көмектесетін адамдар.']].map(([i, t, d]) => h('div', { class: 'card tour' }, h('div', { class: 'ti' }, i), h('h3', {}, t), h('p', { class: 'sm mut', style: 'margin:6px 0 0' }, d))))),
    h('section', { class: 's wrap rv', id: 'cohorts', style: 'padding-top:0' }, h('div', { class: 'eyebrow' }, '2 · Түлектер жолы'), h('h2', { style: 'margin:12px 0 8px' }, `${st.cohorts || ''} поток өтті`), h('p', { class: 'mut', style: 'margin:0 0 20px' }, 'Әр ағыннан кейін қауымдастық кеңейе түседі. Сіз келесі қатардасыз.'),
      h('div', { class: 'wall' }, Array.from({ length: cohorts }, (_, i) => h('div', { class: 'tile', style: `--d:${i * 70}ms` }, h('b', {}, String(i + 1).padStart(2, '0')), h('small', {}, 'ПОТОК'))))),
    h('section', { class: 's wrap rv', id: 'community', style: 'padding-top:0' }, h('div', { class: 'eyebrow' }, '3 · Қауымдастық ішінде'), h('h2', { style: 'margin:12px 0 24px' }, 'Өз адамдар, өз орта 😌'),
      h('div', { class: 'three' }, (st.community || []).map((t, i) => { const [a, ...r] = t.split(':'); return h('div', { class: 'card tour' }, h('div', { class: 'ti' }, ['🎓', '🤝', '🎬', '🔥', '✨', '💬'][i % 6]), h('h3', {}, a.trim()), r.length ? h('p', { class: 'sm mut', style: 'margin:6px 0 0' }, r.join(':').trim()) : null); }))),
    (st.cases || []).length ? h('section', { class: 's wrap rv', style: 'padding-top:0' }, h('div', { class: 'eyebrow' }, '4 · Түлектердің нәтижесі'), h('h2', { style: 'margin:12px 0 24px' }, 'Кейстер'),
      h('div', { class: 'three' }, st.cases.map((c) => h('div', { class: 'card tour' }, h('div', { class: 'cresult' }, c.result), h('b', { style: 'display:block;margin-top:14px' }, c.name), h('small', { class: 'mut' }, c.role))))) : null,
    cfg.lessons.length ? h('section', { class: 's wrap rv', style: 'padding-top:0' }, h('div', { class: 'eyebrow' }, 'Бағдарламадан үзінді'), h('h2', { style: 'margin:12px 0 20px' }, 'Ішінде не үйренеміз?'), h('div', { class: 'three' }, cfg.lessons.map((l) => h('div', { class: 'card tour' }, h('b', {}, l.title), h('p', { class: 'sm mut', style: 'margin:6px 0 0' }, l.description))))) : null,
    h('section', { class: 'wrap rv', style: 'padding:0 20px 40px' }, cta, h('p', { class: 'sm mut', style: 'margin-top:16px' }, 'Baipket-ті Instagram-да көріңіз: ', h('a', { href: 'https://www.instagram.com/baipket/', target: '_blank', rel: 'noopener', style: 'color:var(--acc);font-weight:700' }, '@baipket'))),
    h('section', { class: 's wrap rv', style: 'padding-top:0' }, h('h2', { style: 'font-size:28px;margin-bottom:12px' }, 'Жиі сұрақтар'), [['Міндет бар ма?', 'Жоқ. Нөміріңізді қалдырсаңыз, команда қысқаша түсіндіреді. Шешімді өзіңіз қабылдайсыз.'], ['Менің нөмірімді кім берді?', 'Тек сіз өзіңіз рұқсат берсеңіз ғана нөмір қалады. Шақыру сілтемесін сізге таныс адам жіберді.'], ['Қалай байланысамыз?', 'WhatsApp арқылы. Өзіңіз жазуға да болады: жоғарыдағы батырма.']].map(([q, a]) => h('details', {}, h('summary', {}, q), h('p', {}, a)))),
    footer(), h('div', { class: 'sticky' }, h('button', { class: 'btn acc', onclick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) }, 'Нөмір қалдыру', ic('arrow'))));
}

// ---------- dashboard ----------
function dashboard(first) {
  const { count, unlock, lessons, leads, link, template, offer } = me, sender = me.alumni.name.split(' ')[0];
  const paid = leads.filter((l) => l.status === 'paid').length, gifts = leads.filter((l) => l.reward === 'transfer' && l.status !== 'rejected').length, xp = 100 + count * 200 + paid * 1000 + gifts * 300;
  let li = 0; LEVELS.forEach(([t], i) => { if (xp >= t) li = i; });
  const nextT = LEVELS[li + 1] ? LEVELS[li + 1][0] : null, pct = nextT ? Math.max(6, Math.round(((xp - LEVELS[li][0]) / (nextT - LEVELS[li][0])) * 100)) : 100;
  const unlockedN = lessons.filter((l) => l.unlocked).length;
  const copy = async () => { try { await navigator.clipboard.writeText(link); toast('Сілтеме көшірілді ✅'); } catch { prompt('Сілтеме:', link); } };
  const share = () => navigator.share ? navigator.share({ title: 'Baipket', text: 'Сізге жеке шақыру', url: link }).catch(() => {}) : copy();
  const xpEl = h('b', {}, '0 XP');
  const pass = h('div', { class: 'passwrap' }, h('div', { class: 'pcard' }, h('div', { class: 'pass' }, h('div', { class: 'top' }, h('span', {}, 'ALUMNI PASS'), h('span', {}, 'LVL 0' + (li + 1))), ava(roleIndex(me.alumni.code), li + 1, 'halo'), h('div', { class: 'rl' }, 'Опаа, сізге мына рөл түсті 😎'), h('div', { class: 'nm' }, me.alumni.name), h('div', { class: 'rol' }, ROLE_DEFS[roleIndex(me.alumni.code)].name), h('div', { class: 'bt' }, h('span', {}, LEVELS[li][1].toUpperCase()), xpEl)),
    h('div', { class: 'xpline' }, h('div', {}, `${xp} XP`), h('span', {}, nextT ? `келесі деңгей: ${nextT} XP` : 'ең жоғары деңгей 👑')), h('div', { class: 'bar' }, h('i', { style: `width:${pct}%` })),
    h('div', { class: 'pbody' }, h('button', { class: 'btn acc block', onclick: () => go('invite') }, 'Досыммен бөлісейін', ic('arrow')), h('div', { style: 'display:flex;gap:8px;margin-top:10px' }, h('button', { class: 'btn line sm block', onclick: copy }, 'Сілтемені көшіру'), h('button', { class: 'btn line sm block', onclick: share }, 'Бөлісу')))));
  countUp(xpEl, xp, (v) => v + ' XP');
  // invite
  const preview = h('div', { class: 'preview' });
  const fill = (name) => { preview.textContent = template.replaceAll('{friend}', (name || 'досым').split(' ')[0]).replaceAll('{sender}', sender).replaceAll('{link}', link); }; fill('');
  const seg = h('div', { class: 'seg' }, [['transfer', 'heart', 'Досыма сыйлаймын', true], ['bonus', 'gift', 'Бонус өзіме', false]].map(([v, i, t, on]) => h('label', {}, h('input', { type: 'radio', name: 'reward', value: v, checked: on ? '' : null }), h('span', {}, ic(i), t))));
  const extra = h('div', {}, h('label', { class: 'l' }, 'Сыйлықты кім алады?'), seg, h('p', { class: 'xs mut', style: 'margin:8px 0 0' }, `Досыма сыйласаңыз: оған ${money(offer.discountTransfer)} жеңілдік, сізге «Жомарт» белгісі +300 XP. Бонус өзіме: сізге ${money(offer.bonus)}.`), h('label', { class: 'l' }, 'WhatsApp-та осындай хабар барады'), preview);
  const inviteForm = form([{ id: 'name', label: 'Досыңыздың аты', ph: 'Мысалы, Данияр' }, { id: 'phone', label: 'Досыңыздың WhatsApp нөмірі', type: 'tel', ph: '+7 701 123 45 67' }], 'Бөлісіп, модульді ашайын',
    async (d, f) => {
      const r = await api('lead', { ...d, reward: f.reward.value, onBehalf: true }); const c = r.count;
      try { sessionStorage.setItem('bp_flash', c >= unlock.lesson2 ? 'Екі модуль да ашылды! 🎉' : c >= unlock.lesson1 ? 'Бірінші модуль ашылды! 🎉' : `Тамаша! Бірінші модульге тағы ${unlock.lesson1 - c} нөмір қалды 🔥`); } catch {}
      location.href = r.whatsapp;
    }, { row: true, extra, consent: 'Досым нөмірін Baipket-ке беруге және оған хабарласуға келісті.', oninput: (f) => fill(f.name.value) });
  const quest = (done, t, s, x) => h('div', { class: 'quest' + (done ? ' done' : '') }, h('div', { class: 'qd' }, ic('check')), h('div', {}, h('b', {}, t), h('small', {}, s)), h('span', { class: 'xp' }, x));
  const thanks = leads.filter((l) => l.status === 'paid');
  const badge = (on, i, t) => h('div', { class: 'badge' + (on ? ' on' : '') }, h('div', { class: 'bi' }, on ? i : '🔒'), h('div', { class: 'bt' }, t));
  mount(nav(h('button', { class: 'btn sm keep', onclick: () => go('invite') }, me.alumni.name.split(' ')[0], ic('arrow'))),
    h('div', { class: 'wrap hero' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Сіздің картаңыз дайын'), h('h1', { style: 'margin-top:16px' }, `${sender},`, h('em', {}, count >= unlock.lesson1 ? 'жолыңыз жалғасуда 🔥' : 'бірінші досыңызды қосайық 👋')),
      h('p', { class: 'lead' }, count >= unlock.lesson2 ? 'Екі модуль да сіздікі. Енді досыңыз оқуға қосылса, бонус та келеді.' : `Тағы ${(count >= unlock.lesson1 ? unlock.lesson2 : unlock.lesson1) - count} дос қосыңыз, келесі модуль ашылады.`),
      ...thanks.map((l) => h('div', { class: 'offer', style: 'display:block;margin-top:14px' }, h('b', { style: 'font-size:16px' }, `🙌 ${l.name} Baipket-ке қосылды!`), h('small', { style: 'margin-top:4px;font-size:13px' }, l.reward === 'transfer' ? 'Бонусыңыз досыңызға жеңілдік болды. Рақмет!' : `Бонусыңыз: ${money(offer.bonus)}. Команда сізбен байланысады.`))),
      h('div', { class: 'cta-row' }, h('button', { class: 'btn acc', onclick: () => go('invite') }, 'Досымды қосайын', ic('arrow')), h('a', { class: 'btn line', href: '#lessons', onclick: (e) => { e.preventDefault(); go('lessons'); } }, 'Модульдерім'))), pass),
    marq(),
    h('section', { class: 's wrap rv', style: 'padding-bottom:0' }, h('div', { class: 'eyebrow' }, 'Сіздің нәтижеңіз'), h('div', { class: 'stats' }, [['Сілтеме ашылды', me.stats.clicks, 'рет'], ['Өтінім', me.stats.leads, 'дос'], ['Оқуға қосылды', me.stats.paid, 'дос']].map(([t, v, s]) => h('div', { class: 'stat' }, h('small', {}, t), h('b', {}, String(v)), h('span', {}, s))))),
    h('section', { class: 's wrap rv', id: 'invite' }, h('div', { class: 'shead' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Ал, кімді ертіп келеміз? 👀'), h('h2', { style: 'margin-top:12px' }, 'Бір досыңыз бар шығар?', h('br'), h('span', { class: 'acc' }, 'Бірге көрейік 😄'))), h('span', { class: 'xpbadge' }, '+200 XP')),
      h('div', { class: 'grid2' }, h('div', { class: 'card' }, h('h3', { style: 'margin-bottom:4px' }, 'Досыңызбен танысып алайық 👋'), h('p', { class: 'sm mut', style: 'margin:0' }, 'Нөмірі болса, әрі қарай өзіміз сөйлесеміз.'), inviteForm),
        h('div', { class: 'card tint' }, h('div', { class: 'eyebrow' }, 'Сіздің жолыңыз'), h('div', { style: 'margin-top:8px' }, quest(true, 'Картаңыз дайын', 'Карта + бірінші модульге жол', '+100 XP'), quest(count >= 1, 'Досыңызбен таныстық', 'Келісіммен бір нөмір қалдыру', '+200 XP'), ...(unlock.lesson1 === unlock.lesson2 ? [quest(count >= unlock.lesson1, `${unlock.lesson1} дос: екі модуль`, count >= unlock.lesson1 ? 'Ашылды' : `Тағы ${unlock.lesson1 - count}`, 'UNLOCK')] : [quest(count >= unlock.lesson1, `${unlock.lesson1} дос: 1-модуль`, count >= unlock.lesson1 ? 'Ашылды' : `Тағы ${unlock.lesson1 - count}`, 'UNLOCK'), quest(count >= unlock.lesson2, `${unlock.lesson2} дос: 2-модуль`, count >= unlock.lesson2 ? 'Ашылды' : `Тағы ${unlock.lesson2 - count}`, 'UNLOCK')]), quest(paid >= 1, 'Дос оқуға қосылды', 'Бонус осы кезде есептеледі', '+1000 XP')),
          h('p', { class: 'xs mut', style: 'margin:12px 0 0;display:flex;gap:6px;align-items:center' }, ic('shield'), 'Нөмір тек досыңыздың рұқсатымен беріледі.')))),
    lessonsSection(lessons.map((l) => ({ ...l })), count, unlockedN),
    h('section', { class: 's wrap rv' }, h('div', { class: 'grid2' }, h('div', { class: 'card' }, h('h3', {}, 'Таныстарыңыз'), leads.length ? h('ul', { class: 'list' }, leads.map((l) => { const stg = { new: 1, contacted: 2, interested: 3, awaiting_payment: 3, paid: 4, rejected: 0 }[l.status] ?? 1; return h('li', { class: 'fl' }, h('div', { class: 'fh' }, h('span', {}, h('b', {}, l.name), h('small', { class: 'mut' }, l.reward === 'transfer' ? '  🎁 досқа' : '  💰 маған')), h('span', { class: 'tag ' + (l.status === 'paid' ? 'ok' : '') }, l.bonus_paid ? 'Бонус төленді ✅' : l.status === 'paid' ? 'Қосылды 🎉' : l.status === 'rejected' ? 'Жабылды' : 'Процесте')),
        l.status === 'rejected' ? null : h('div', { class: 'trk' }, ['Жіберілді', 'Сөйлесті', 'Қызықты', 'Қосылды'].map((t, i) => h('div', { class: 'stp' + (stg > i ? ' on' : '') }, h('i', {}), h('small', {}, t))))); })) : h('p', { class: 'sm mut' }, 'Әзірге бос. Бірінші досыңызды қосыңыз 👆')),
      h('div', { class: 'card' }, h('h3', { style: 'margin-bottom:14px' }, 'Жетістіктер 🏆'), h('div', { class: 'badges' }, badge(count >= 1, '🔥', 'Бірінші дос'), badge(count >= unlock.lesson1, '🎓', same() ? 'Модульдер' : '1-модуль'), ...(same() ? [] : [badge(count >= unlock.lesson2, '🚀', '2-модуль')]), badge(gifts >= 1, '🎁', 'Жомарт'), badge(paid >= 1, '💰', 'Бірінші төлем'), badge(paid >= 3, '👑', '3 төлем'))))),
    rewardSection(), faq(), footer(),
    h('div', { class: 'sticky' }, h('button', { class: 'btn acc', onclick: () => go('invite') }, 'Досымды қосу +200 XP', ic('arrow'))));
  if (first) { boom(); window.scrollTo(0, 0); }
  let fl = null; try { fl = sessionStorage.getItem('bp_flash'); sessionStorage.removeItem('bp_flash'); } catch {}
  if (fl) { toast(fl); boom(); setTimeout(() => go('lessons'), 600); }
}

async function openLesson(id) {
  try {
    const l = await api('lesson/' + id);
    const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, h('h2', {}, l.title));
    let ul = null;
    for (const line of l.body.split('\n')) {
      if (line.startsWith('## ')) { ul = null; sheet.append(h('h3', {}, line.slice(3))); }
      else if (line.startsWith('- ')) { if (!ul) { ul = h('ul'); sheet.append(ul); } ul.append(h('li', {}, line.slice(2))); }
      else if (line.trim()) { ul = null; sheet.append(h('p', {}, line)); }
    }
    sheet.append(h('button', { class: 'btn block', style: 'margin-top:20px', onclick: () => modal.remove() }, 'Жабу'));
    const modal = h('div', { class: 'modal', onclick: (e) => { if (e.target === modal) modal.remove(); } }, sheet);
    document.body.append(modal);
  } catch (e) { toast(e.message); }
}

(async function init() {
  try { cfg = { ...cfg, ...(await api('config')) }; } catch {}
  if (ref) { let s = null; try { s = (await api('ref?code=' + ref)).sender; } catch {} return friendPage(s); }
  try { const r = await api('me'); if (r.alumni) { me = r; return dashboard(); } } catch {}
  landing();
})();
