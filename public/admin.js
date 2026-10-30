const $ = document.getElementById('app');
const h = (tag, a = {}, ...k) => { const e = document.createElement(tag); for (const [x, v] of Object.entries(a)) { if (x === 'class') e.className = v; else if (x.startsWith('on')) e.addEventListener(x.slice(2), v); else if (v != null && v !== false) e.setAttribute(x, v); } for (const c of k.flat()) e.append(c instanceof Node ? c : document.createTextNode(c ?? '')); return e; };
const call = async (p, body) => { const r = await fetch('/api/admin/' + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json().catch(() => ({})); if (r.status === 401 && p !== 'login') { login(); throw new Error('auth'); } if (!r.ok) throw new Error(j.error || 'Қате'); return j; };
const money = (n) => Number(n).toLocaleString('ru-RU') + ' ₸';
const thanksLink = (l, s) => { const reward = l.reward === 'transfer' ? 'Бонусыңыз досыңызға жеңілдік болды, оған үлкен рақмет!' : 'Бонусыңыз: ' + money(s.offer.bonus) + '. Жақын арада есептейміз.'; const t = s.thanks.replaceAll('{name}', l.alumni_name.split(' ')[0]).replaceAll('{friend}', l.name.split(' ')[0]).replaceAll('{reward}', reward); return 'https://api.whatsapp.com/send?phone=' + l.alumni_phone + '&text=' + encodeURIComponent(t); };
const LBL = { new: 'Жаңа', contacted: 'Байланыстық', interested: 'Қызығушылық бар', awaiting_payment: 'Төлем күтеміз', paid: 'Төлем расталды', rejected: 'Жабылды' };

function login() {
  const err = h('p', { class: 'err' });
  const pw = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Пароль' });
  $.replaceChildren(h('form', { class: 'card', onsubmit: async (e) => { e.preventDefault(); try { await call('login', { password: pw.value }); load(); } catch (x) { err.textContent = x.message; } } }, h('h2', {}, 'Админге кіру'), pw, h('button', { class: 'btn', style: 'margin-top:12px' }, 'Кіру'), err));
}

async function load() {
  let d; try { d = await call('data'); } catch { return; }
  const s = d.settings, msg = h('span', { class: 'ok' });
  const flash = (t) => { msg.textContent = t; setTimeout(() => (msg.textContent = ''), 3000); };
  const tbody = d.leads.map((l) => h('tr', {},
    h('td', {}, new Date(l.created_at).toLocaleString('kk-KZ', { dateStyle: 'short', timeStyle: 'short' })),
    h('td', {}, l.name, h('br'), h('a', { href: 'https://wa.me/' + l.phone, target: '_blank', rel: 'noopener' }, '+' + l.phone)),
    h('td', {}, l.alumni_name, h('br'), h('span', { class: 'muted small' }, l.alumni_code, l.source === 'self' ? ' · өзі' : ' · түлек берді')),
    h('td', {}, l.reward === 'transfer' ? '🎁 досқа ' + money(s.offer.transferred) : '💰 түлекке ' + money(s.offer.bonus)),
    h('td', {}, h('select', { onchange: (e) => call('lead', { id: l.id, status: e.target.value }).then(() => flash('Сақталды')) }, d.statuses.map((x) => h('option', { value: x, selected: x === l.status ? '' : null }, LBL[x])))),
    h('td', {}, h('input', { type: 'checkbox', checked: l.bonus_paid ? '' : null, onchange: (e) => call('lead', { id: l.id, bonus_paid: e.target.checked }).then(() => flash('Сақталды')) })),
    h('td', {}, l.status === 'paid' ? h('a', { class: 'btn', style: 'padding:6px 10px;font-size:13px;width:auto;display:inline-block', target: '_blank', rel: 'noopener', href: thanksLink(l, s) }, '🙏 Рақмет') : h('span', { class: 'muted' }, '—')),
    h('td', { class: l.crm_status === 'sent' ? 'ok' : l.crm_status === 'error' ? 'bad' : 'muted', title: l.crm_error || '' }, l.crm_status)));
  const u1 = h('input', { type: 'number', min: 0, max: 50, value: s.unlock.lesson1 }), u2 = h('input', { type: 'number', min: 0, max: 50, value: s.unlock.lesson2 });
  const sy = s.story;
  const stC = h('input', { type: 'number', min: 0, value: sy.cohorts }), stS = h('input', { class: 't', value: sy.since }), stT = h('input', { class: 't', value: sy.tagline });
  const stA = h('textarea', {}, sy.about), stM = h('textarea', {}, sy.community.join('\n')), stK = h('textarea', {}, (sy.cases || []).map((c) => `${c.name} | ${c.role} | ${c.result}`).join('\n'));
  const tmpl = h('textarea', {}, s.message), thx = h('textarea', {}, s.thanks);
  const o0 = h('input', { type: 'number', min: 0, value: s.offer.presale }), o1 = h('input', { type: 'number', min: 0, value: s.offer.friend }), o2 = h('input', { type: 'number', min: 0, value: s.offer.transferred }), o3 = h('input', { type: 'number', min: 0, value: s.offer.bonus });
  const lessonEls = s.lessons.map((l) => ({ l, t: h('input', { class: 't', value: l.title }), ds: h('input', { class: 't', value: l.description }), b: h('textarea', { style: 'min-height:220px' }, l.body) }));
  $.replaceChildren(
    h('div', { class: 'row', style: 'margin:10px 0' }, h('b', {}, `Түлектер: ${d.alumni.length} · Лидтер: ${d.leads.length}`), h('a', { class: 'btn ghost', href: '/api/admin/export.csv' }, 'CSV жүктеу'), h('button', { class: 'btn ghost', onclick: () => call('logout', {}).then(login) }, 'Шығу'), msg),
    h('section', { class: 'card' }, h('h2', {}, 'Лидтер'), h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ['Уақыт', 'Таныс', 'Түлек', 'Таңдау', 'Статус', 'Бонус төленді', 'Рақмет', 'CRM'].map((x) => h('th', {}, x)))), h('tbody', {}, tbody)))),
    h('section', { class: 'card' }, h('h2', {}, 'amoCRM'),
      h('p', { class: d.crm.enabled ? 'ok' : 'muted' }, d.crm.enabled ? 'Қосылған (AMO_DOMAIN + AMO_TOKEN бар). ' + (d.crm.config ? `Воронка ID: ${d.crm.config.pipelineId}` : 'Воронка әлі құрылмаған.') : 'Қосылмаған. Сервердің env-ін толтырыңыз: AMO_DOMAIN, AMO_TOKEN.'),
      h('p', { class: 'muted small' }, 'amoCRM → Webhook (сделка статусы өзгергенде) мекенжайы. Оны amoCRM-де «Статус сделки изменён» оқиғасына қойсаңыз, сделка «Успешно реализовано» болғанда сайтта да «төлем расталды» болады:'), h('input', { class: 't', readonly: '', value: d.crm.webhook, onclick: (e) => e.target.select() }),
      h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn', onclick: () => call('crm/setup', {}).then(() => { flash('Воронка дайын'); load(); }).catch((e) => alert(e.message)) }, 'Воронканы құру/тексеру'), h('button', { class: 'btn ghost', onclick: () => call('crm/retry', {}).then((r) => { flash('Қайта жіберілді: ' + r.tried); load(); }).catch((e) => alert(e.message)) }, 'Жіберілмегендерді қайта жіберу'))),
    h('section', { class: 'card' }, h('h2', {}, 'Сабақтардың ашылу шарты'), h('div', { class: 'row' }, h('label', {}, '1-сабақ үшін нөмір саны', u1), h('label', {}, '2-сабақ үшін нөмір саны', u2)),
      h('button', { class: 'btn', style: 'margin-top:12px;width:auto', onclick: () => call('settings', { unlock: { lesson1: u1.value, lesson2: u2.value } }).then(() => flash('Сақталды')) }, 'Сақтау')),
    h('section', { class: 'card' }, h('h2', {}, 'Baipket туралы (достың беті)'), h('p', { class: 'muted small' }, 'Осы мәтіндер досыңыз сілтемені ашқанда көрінеді. Баға көрсетілмейді. Кейстер толтырылмаса, бөлім көрінбейді.'),
      h('div', { class: 'row' }, h('label', {}, 'Неше поток өтті', stC), h('label', {}, 'Қанша уақыт (мысалы, 1,5 жыл)', stS)), h('label', { class: 'l' }, 'Қысқа ұран', stT), h('label', { class: 'l' }, 'Baipket туралы қысқаша', stA),
      h('label', { class: 'l' }, 'Қауымдастық: әр жолға бір пункт (формат: «Тақырып: сипаттама»)', stM), h('label', { class: 'l' }, 'Кейстер: әр жолға бір кейс (формат: «Аты | Кім | Нәтиже»)', stK),
      h('button', { class: 'btn', style: 'margin-top:12px;width:auto', onclick: () => call('settings', { story: { cohorts: stC.value, since: stS.value, tagline: stT.value, about: stA.value, community: stM.value.split('\n').map((x) => x.trim()).filter(Boolean), cases: stK.value.split('\n').map((x) => x.split('|').map((y) => y.trim())).filter((p) => p.length >= 3).map(([name, role, ...r]) => ({ name, role, result: r.join(' | ') })) } }).then(() => flash('Сақталды')).catch((e) => alert(e.message)) }, 'Сақтау')),
    h('section', { class: 'card' }, h('h2', {}, 'Бағалар мен бонус (₸)'), h('div', { class: 'row' }, h('label', {}, 'Алдын ала баға (presale)', o0), h('label', {}, 'Досқа баға', o1), h('label', {}, 'Бонус досқа берілсе баға', o2), h('label', {}, 'Түлектің бонусы', o3)), h('button', { class: 'btn', style: 'margin-top:12px;width:auto', onclick: () => call('settings', { offer: { presale: o0.value, friend: o1.value, transferred: o2.value, bonus: o3.value } }).then(() => flash('Сақталды')) }, 'Сақтау')),
    h('section', { class: 'card' }, h('h2', {}, 'Төлемнен кейінгі «Рақмет» мәтіні'), h('p', { class: 'muted small' }, 'Орындар: {name} түлек, {friend} дос, {reward} бонус туралы сөйлем. Лидті «Төлем расталды» қойған соң, «🙏 Рақмет» батырмасы WhatsApp-ты түлекке дайын хабармен ашады.'), thx, h('button', { class: 'btn', style: 'margin-top:12px;width:auto', onclick: () => call('settings', { thanks: thx.value }).then(() => flash('Сақталды')) }, 'Сақтау')),
    h('section', { class: 'card' }, h('h2', {}, 'WhatsApp хабар мәтіні'), h('p', { class: 'muted small' }, 'Орындар: {friend} досының аты, {sender} түлектің аты, {link} жеке сілтеме (міндетті).'), tmpl,
      h('button', { class: 'btn', style: 'margin-top:12px;width:auto', onclick: () => call('settings', { message: tmpl.value }).then(() => flash('Сақталды')).catch((e) => alert(e.message)) }, 'Сақтау')),
    h('section', { class: 'card' }, h('h2', {}, 'Сабақ мәтіндері'), h('p', { class: 'muted small' }, 'Формат: «## Тақырып», «- тізім», қалғаны абзац.'),
      lessonEls.map((x) => h('div', {}, h('label', {}, `Сабақ ${x.l.id}: атауы`), x.t, h('label', {}, 'Қысқа сипаттама'), x.ds, h('label', {}, 'Мәтін'), x.b)),
      h('button', { class: 'btn', style: 'margin-top:12px;width:auto', onclick: () => call('settings', { lessons: lessonEls.map((x) => ({ id: x.l.id, title: x.t.value, description: x.ds.value, body: x.b.value })) }).then(() => flash('Сақталды')) }, 'Сақтау')),
    h('section', { class: 'card' }, h('h2', {}, 'Түлектер'), h('div', { class: 'scroll' }, h('table', {}, h('tbody', {}, d.alumni.map((a) => h('tr', {}, h('td', {}, a.name), h('td', {}, '+' + a.phone), h('td', {}, a.code), h('td', {}, a.leads + ' лид')))))))
  );
}
load();
