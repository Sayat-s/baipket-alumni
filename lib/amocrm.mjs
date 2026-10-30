// amoCRM v4 адаптері: сайт -> amoCRM (бір жақты). Токен env-те ғана сақталады.
const base = () => (process.env.AMO_DOMAIN ? 'https://' + process.env.AMO_DOMAIN.replace(/^https?:\/\//, '').replace(/\/+$/, '') : '');
export const crmEnabled = () => !!(base() && process.env.AMO_TOKEN);

async function call(method, path, body) {
  const r = await fetch(base() + '/api/v4' + path, {
    method,
    headers: { Authorization: 'Bearer ' + process.env.AMO_TOKEN, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
  if (!r.ok) throw new Error(`amoCRM ${r.status}: ${text.slice(0, 300)}`);
  return json;
}

export const STAGES = ['Жаңа реферал', 'Байланыстық', 'Қызығушылық бар', 'Төлем күтеміз'];

// Воронканы бір рет құрады: «Baipket • Рефералдар»
export async function setupPipeline() {
  const name = 'Baipket • Рефералдар';
  const list = await call('GET', '/leads/pipelines');
  let p = (list?._embedded?.pipelines || []).find((x) => x.name === name);
  if (!p) {
    const colors = ['#d6eaff', '#fffeb2', '#fffd7f', '#ebffb1'];
    const res = await call('POST', '/leads/pipelines', [{
      name, is_main: false, is_unsorted_on: false,
      _embedded: { statuses: STAGES.map((n, i) => ({ name: n, sort: (i + 1) * 10, color: colors[i] })) },
    }]);
    p = res._embedded.pipelines[0];
  }
  const full = await call('GET', '/leads/pipelines/' + p.id + '/statuses');
  const first = (full?._embedded?.statuses || []).sort((a, b) => a.sort - b.sort).find((s) => s.type === 0 || s.name === STAGES[0]);
  const OURS = ['new', 'contacted', 'interested', 'awaiting_payment'];
  const statusMap = { 142: 'paid', 143: 'rejected' }; // amoCRM жүйелік: «Успешно реализовано» / «Закрыто»
  (full?._embedded?.statuses || []).forEach((st) => { const i = STAGES.indexOf(st.name); if (i >= 0) statusMap[st.id] = OURS[i]; });
  return { pipelineId: p.id, statusId: first?.id, statusMap };
}

export async function sendLead(lead, alumni, cfg, offer) {
  const transfer = lead.reward === 'transfer';
  const price = transfer ? offer.transferred : offer.friend;
  const title = `${alumni.name} таныс: ${lead.name} [BP:${lead.id}]`;
  const body = [{
    name: title,
    price,
    ...(cfg?.pipelineId ? { pipeline_id: Number(cfg.pipelineId) } : {}),
    ...(cfg?.statusId ? { status_id: Number(cfg.statusId) } : {}),
    _embedded: {
      contacts: [{ first_name: lead.name, custom_fields_values: [{ field_code: 'PHONE', values: [{ value: '+' + lead.phone, enum_code: 'MOB' }] }] }],
      tags: [{ name: 'рефералка' }, { name: 'ref-' + alumni.code }, { name: transfer ? 'жеңілдік-досқа' : 'бонус-түлекке' }],
    },
  }];
  const res = await call('POST', '/leads/complex', body);
  const id = res?.[0]?.id;
  if (!id) throw new Error('amoCRM жауабында lead id жоқ');
  const choice = transfer ? `Түлек бонусын досына берді: баға ${offer.transferred} ₸ (${offer.friend} ₸ орнына).` : `Түлек бонусты өзіне алады: ${offer.bonus} ₸. Досқа баға ${offer.friend} ₸.`;
  try {
    await call('POST', '/leads/notes', [{
      entity_id: id, note_type: 'common',
      params: { text: `↗ Осыдан келді: реферал.\nШақырған түлек: ${alumni.name} (+${alumni.phone}), код ${alumni.code}.\n${choice}\nДерек көзі: ${lead.source === 'self' ? 'таныс өзі қалдырды' : 'түлек таныстың келісімімен берді'}. Келісім: иә, ${lead.created_at}.` },
    }]);
  } catch { /* note маңызды емес */ }
  return String(id);
}
