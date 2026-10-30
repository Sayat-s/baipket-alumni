// Аниме стиліндегі Senior-самурай генераторы (түпнұсқа SVG). Рөлге қарай шашы, шапаны, белгісі өзгереді.
export const ROLE_DEFS = [
  { name: 'Senior', hair: '#1c1c1c', style: 'spiky', hb: '#e24a2c', iris: '#6b3b1f', emoji: '📈' },
  { name: 'Аға маркетолог', hair: '#3a2a1f', style: 'knot', hb: '#161616', iris: '#2c5d8f', emoji: '🧠' },
  { name: 'Growth-лидер', hair: '#9a3b24', style: 'spiky', hb: '#ffd62e', iris: '#1e7a4c', emoji: '🚀' },
  { name: 'Воронка шебері', hair: '#27325a', style: 'tail', hb: '#e24a2c', iris: '#8a2f6b', emoji: '🎯' },
  { name: 'Лид-аңшы', hair: '#c9ced6', style: 'spiky', hb: '#e24a2c', iris: '#b8461f', emoji: '🏹' },
  { name: 'Сандар жаны', hair: '#161616', style: 'knot', hb: '#2b6cb0', iris: '#6b3b1f', emoji: '📊' },
];
export const roleIndex = (code) => [...String(code)].reduce((a, c) => a + c.charCodeAt(0), 0) % ROLE_DEFS.length;

export function character(i, { stripes = 2, bg = 'disc' } = {}) {
  const r = ROLE_DEFS[((i % ROLE_DEFS.length) + ROLE_DEFS.length) % ROLE_DEFS.length], ink = '#161616', skin = '#ffd9bd', st = `stroke="${ink}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  const bars = Array.from({ length: Math.min(4, Math.max(0, stripes)) }, (_, k) => `<rect x="${121 + k * 6}" y="141" width="3" height="14" fill="#ffd62e"/>`).join('');
  const back = r.style === 'tail' ? `<path d="M128 28 Q184 10 172 92 Q164 56 134 48 Z" fill="${r.hair}" ${st}/>` : '';
  const knot = r.style === 'knot' ? `<ellipse cx="100" cy="10" rx="12" ry="10" fill="${r.hair}" ${st}/><rect x="90" y="17" width="20" height="6" rx="2" fill="${r.hb}" ${st}/>` : '';
  return `<svg viewBox="0 0 200 276" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${r.name}">
${bg === 'disc' ? `<circle cx="100" cy="150" r="96" fill="#fdf8f3" ${st}/><circle cx="100" cy="86" r="52" fill="#ffe2d2"/>` : bg === 'halo' ? `<circle cx="100" cy="110" r="84" fill="#e24a2c" opacity=".92"/><circle cx="100" cy="110" r="58" fill="#ff7a45" opacity=".55"/>` : ''}
<ellipse cx="100" cy="266" rx="62" ry="7" fill="#000" opacity=".16"/>
<g transform="translate(0 14)">
${back}
<path d="M58 152 L142 152 L158 244 L104 244 L100 196 L96 244 L42 244 Z" fill="#27324f" ${st}/>
<path d="M100 196 L100 160" stroke="#3b4a73" stroke-width="3" fill="none"/>
<ellipse cx="70" cy="246" rx="24" ry="7" fill="#fdf8f3" ${st}/><ellipse cx="130" cy="246" rx="24" ry="7" fill="#fdf8f3" ${st}/>
<path d="M64 94 Q100 84 136 94 L140 152 L60 152 Z" fill="#fdf8f3" ${st}/>
<path d="M118 100 L136 96 L140 150 L116 150 Z" fill="#000" opacity=".07"/>
<rect x="92" y="78" width="16" height="16" fill="${skin}" ${st}/>
<path d="M86 90 L100 124 L114 90 Z" fill="${skin}"/>
<path d="M82 88 L102 128 M118 88 L98 128" ${st} fill="none"/>
<path d="M68 96 L42 124 L54 152 L78 130 Z" fill="#fdf8f3" ${st}/><path d="M132 96 L158 124 L146 152 L122 130 Z" fill="#fdf8f3" ${st}/>
<circle cx="60" cy="152" r="9" fill="${skin}" ${st}/><circle cx="140" cy="152" r="9" fill="${skin}" ${st}/>
<rect x="54" y="140" width="92" height="16" rx="3" fill="#111" ${st}/>${bars}
<path d="M94 158 L86 192 L99 187 L101 160 Z" fill="#111" ${st}/><path d="M106 158 L116 190 L102 185 L100 160 Z" fill="#111" ${st}/>
<rect x="89" y="137" width="22" height="24" rx="6" fill="#222" ${st}/><path d="M94 144 L106 144" stroke="#555" stroke-width="2.5" stroke-linecap="round"/>
<circle cx="66" cy="56" r="7" fill="${skin}" ${st}/><circle cx="134" cy="56" r="7" fill="${skin}" ${st}/>
<ellipse cx="100" cy="54" rx="34" ry="37" fill="${skin}" ${st}/>
${knot}
<path d="M65 52 Q60 8 100 6 Q140 8 135 52 Q132 36 100 34 Q68 36 65 52 Z" fill="${r.hair}" ${st}/>
<path d="M68 48 L66 70 L76 58 Z" fill="${r.hair}" ${st}/><path d="M132 48 L134 70 L124 58 Z" fill="${r.hair}" ${st}/>
<rect x="64" y="33" width="72" height="10" rx="3" fill="${r.hb}" ${st}/><circle cx="100" cy="38" r="3.6" fill="#fdf8f3"/>
<path d="M136 36 L160 28 L154 40 L164 50 L138 43 Z" fill="${r.hb}" ${st}/>
<path d="M74 50 L92 54 M126 50 L108 54" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>
<ellipse cx="85" cy="63" rx="9" ry="11" fill="#fff" ${st}/><ellipse cx="115" cy="63" rx="9" ry="11" fill="#fff" ${st}/>
<ellipse cx="86" cy="65" rx="6" ry="8" fill="${r.iris}"/><ellipse cx="114" cy="65" rx="6" ry="8" fill="${r.iris}"/>
<circle cx="86" cy="66" r="3" fill="${ink}"/><circle cx="114" cy="66" r="3" fill="${ink}"/>
<circle cx="83.5" cy="61.5" r="2.4" fill="#fff"/><circle cx="111.5" cy="61.5" r="2.4" fill="#fff"/><circle cx="88" cy="69" r="1.2" fill="#fff"/><circle cx="116" cy="69" r="1.2" fill="#fff"/>
<ellipse cx="76" cy="76" rx="6" ry="3.4" fill="#ff7a6b" opacity=".45"/><ellipse cx="124" cy="76" rx="6" ry="3.4" fill="#ff7a6b" opacity=".45"/>
<path d="M99 72 L97 77 L101 77" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M90 83 Q100 91 110 83" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>
</g>
<circle cx="32" cy="74" r="22" fill="#fff" ${st}/><text x="32" y="83" text-anchor="middle" font-size="24">${r.emoji}</text>
</svg>`;
}
