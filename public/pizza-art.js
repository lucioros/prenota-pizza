// Icone degli ingredienti e disegno delle pizze.
// Ogni ingrediente riceve un'icona, un colore e una forma in base al nome; la pizzeria può cambiare l'icona.
const ASPETTO = [
  // [parole chiave, icona, colore, forma]
  [['bufala'], '🧀', '#fbf7ec', 'blob'],
  [['mozzarella', 'fior di latte', 'fiordilatte'], '🧀', '#fbf5e4', 'blob'],
  [['gorgonzola'], '🧀', '#e8e6cf', 'blob'],
  [['grana', 'parmigiano', 'pecorino'], '🧀', '#f1d98c', 'flake'],
  [['scamorza', 'provola', 'brie', 'stracchino', 'ricotta', 'burrata', 'stracciatella'], '🧀', '#efc77e', 'blob'],
  [['cotto'], '🥓', '#f0a7a2', 'strip'],
  [['crudo', 'speck', 'bresaola', 'pancetta', 'guanciale', 'mortadella'], '🥓', '#c85a5e', 'strip'],
  [['salame', 'salamino', 'spianata', 'pepperoni'], '🔴', '#b8382c', 'disc'],
  [['nduja', 'peperoncino', 'olio piccante', 'piccante'], '🌶️', '#c4321f', 'dot'],
  [['salsiccia'], '🥩', '#9c5236', 'crumb'],
  [['würstel', 'wurstel', 'wurst'], '🌭', '#d88a55', 'disc'],
  [['pollo', 'tacchino'], '🍗', '#e2b27a', 'crumb'],
  [['porcini', 'funghi', 'champignon', 'tartufo'], '🍄', '#b48c63', 'mushroom'],
  [['peperon'], '🫑', '#e0482f', 'strip'],
  [['melanzan'], '🍆', '#5e2f63', 'disc'],
  [['zucchin'], '🥒', '#6e9c3c', 'disc'],
  [['olive', 'oliva'], '🫒', '#2f2a26', 'ring'],
  [['cipoll'], '🧅', '#c99cc8', 'ring'],
  [['rucola', 'insalata', 'spinaci', 'friarielli', 'cime di rapa'], '🥬', '#4b8a2c', 'leaf'],
  [['pomodorin', 'ciliegin', 'datterin', 'pomodoro secco', 'pachino'], '🍅', '#d9352b', 'disc'],
  [['carciof'], '🌿', '#8d9c4a', 'leaf'],
  [['acciug', 'alici'], '🐟', '#8b8f95', 'strip'],
  [['tonno', 'salmone'], '🐟', '#d8a58b', 'crumb'],
  [['gamber', 'scampi', 'frutti di mare', 'cozze'], '🦐', '#ef8f6b', 'crumb'],
  [['basilico'], '🌿', '#3b8c37', 'leaf'],
  [['origano', 'rosmarino', 'prezzemolo'], '🌿', '#6e7d3a', 'dot'],
  [['aglio'], '🧄', '#f1ead2', 'dot'],
  [['patatin', 'patate'], '🍟', '#f1c24c', 'stick'],
  [['mais'], '🌽', '#f2c94c', 'dot'],
  [['ananas'], '🍍', '#f4cf4f', 'cube'],
  [['uovo'], '🥚', '#f6d34a', 'blob'],
  [['noci', 'pistacchi', 'nocciol'], '🥜', '#a8774a', 'crumb'],
  [['nutella', 'cioccolat'], '🍫', '#5b3a26', 'blob'],
  [['capperi'], '🌿', '#617a37', 'dot'],
];
const PER_CATEGORIA = { Formaggi: ['🧀', '#f3e3b5', 'blob'], Salumi: ['🥓', '#c86d6a', 'strip'], Verdure: ['🥬', '#5c9a3a', 'leaf'], Pesce: ['🐟', '#9aa0a6', 'crumb'], Extra: ['✨', '#c99a4a', 'dot'] };
// icone tra cui la pizzeria può scegliere nelle impostazioni
const ICONE_SCELTA = ['🧀', '🥓', '🔴', '🌶️', '🥩', '🌭', '🍗', '🍄', '🫑', '🍆', '🥒', '🫒', '🧅', '🥬', '🍅', '🌿', '🐟', '🦐', '🧄', '🍟', '🌽', '🍍', '🥚', '🥜', '🍫', '🥔', '🥕', '🍋', '🍯', '✨'];

function aspetto(g) {
  if (!g) return { e: '•', c: '#c99a4a', s: 'dot' };
  const n = String(g.nome || '').toLowerCase();
  let a = ASPETTO.find(([k]) => k.some(w => n.includes(w)));
  let r = a ? { e: a[1], c: a[2], s: a[3] } : (() => { const p = PER_CATEGORIA[g.categoria] || PER_CATEGORIA.Extra; return { e: p[0], c: p[1], s: p[2] }; })();
  if (g.icona) r = { ...r, e: g.icona };
  return r;
}
const icona = g => aspetto(g).e;

// generatore pseudo-casuale con seme: la stessa pizza ha sempre lo stesso disegno
function semeDa(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }

// Disegno SVG di una pizza vista dall'alto. ingredienti: oggetti {nome, categoria, icona}
function pizzaSVG(ingredienti, opz = {}) {
  const rnd = semeDa(opz.seme || ingredienti.map(g => g && g.nome).join('|') || 'base');
  const rossa = opz.rossa !== false;
  const out = [];
  const R = 34; // raggio utile per i condimenti
  const punto = () => { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * R; return [50 + Math.cos(a) * d, 50 + Math.sin(a) * d]; };
  // crosta, salsa, mozzarella della base
  out.push(`<circle cx="50" cy="50" r="48" fill="#d99a52"/><circle cx="50" cy="50" r="48" fill="none" stroke="#b5733a" stroke-width="1.2"/>`);
  for (let i = 0; i < 9; i++) { const a = rnd() * Math.PI * 2; out.push(`<circle cx="${50 + Math.cos(a) * 45}" cy="${50 + Math.sin(a) * 45}" r="${1.6 + rnd() * 1.6}" fill="#8f4f22" opacity=".35"/>`); }
  out.push(`<circle cx="50" cy="50" r="41" fill="${rossa ? '#c9402c' : '#f3e7c8'}"/>`);
  for (let i = 0; i < 7; i++) { const [x, y] = punto(); out.push(`<ellipse cx="${x}" cy="${y}" rx="${7 + rnd() * 5}" ry="${5 + rnd() * 4}" transform="rotate(${rnd() * 180} ${x} ${y})" fill="#fbf3dc" opacity="${rossa ? .92 : .7}"/>`); }
  for (const g of ingredienti) {
    if (!g) continue;
    const { c, s } = aspetto(g);
    const n = { disc: 6, ring: 7, strip: 6, leaf: 5, dot: 16, blob: 5, crumb: 11, mushroom: 6, stick: 6, flake: 9, cube: 8 }[s] || 6;
    for (let i = 0; i < n; i++) {
      const [x, y] = punto(), rot = Math.round(rnd() * 180);
      switch (s) {
        case 'disc': out.push(`<circle cx="${x}" cy="${y}" r="4.6" fill="${c}"/><circle cx="${x - 1}" cy="${y - 1}" r="1.3" fill="#fff" opacity=".18"/>`); break;
        case 'ring': out.push(`<circle cx="${x}" cy="${y}" r="2.9" fill="none" stroke="${c}" stroke-width="1.8"/>`); break;
        case 'strip': out.push(`<rect x="${x - 5.5}" y="${y - 1.8}" width="11" height="3.6" rx="1.6" fill="${c}" transform="rotate(${rot} ${x} ${y})"/>`); break;
        case 'leaf': out.push(`<ellipse cx="${x}" cy="${y}" rx="4.8" ry="2.2" fill="${c}" transform="rotate(${rot} ${x} ${y})"/><line x1="${x - 4}" y1="${y}" x2="${x + 4}" y2="${y}" stroke="#ffffff" stroke-opacity=".25" stroke-width=".5" transform="rotate(${rot} ${x} ${y})"/>`); break;
        case 'dot': out.push(`<circle cx="${x}" cy="${y}" r="1.1" fill="${c}"/>`); break;
        case 'blob': out.push(`<ellipse cx="${x}" cy="${y}" rx="${5 + rnd() * 2}" ry="${3.6 + rnd() * 1.5}" fill="${c}" transform="rotate(${rot} ${x} ${y})"/>`); break;
        case 'crumb': out.push(`<circle cx="${x}" cy="${y}" r="${1.8 + rnd() * 1.2}" fill="${c}"/>`); break;
        case 'mushroom': out.push(`<path d="M${x - 4} ${y} a4 3.4 0 0 1 8 0 z" fill="${c}"/><rect x="${x - 1.3}" y="${y}" width="2.6" height="3" rx=".8" fill="${c}" opacity=".8"/>`); break;
        case 'stick': out.push(`<rect x="${x - 4.5}" y="${y - 1.1}" width="9" height="2.2" rx=".6" fill="${c}" transform="rotate(${rot} ${x} ${y})"/>`); break;
        case 'flake': out.push(`<rect x="${x - 2}" y="${y - 1}" width="4" height="2" fill="${c}" transform="rotate(${rot} ${x} ${y})"/>`); break;
        case 'cube': out.push(`<rect x="${x - 2.2}" y="${y - 2.2}" width="4.4" height="4.4" rx=".8" fill="${c}" transform="rotate(${rot} ${x} ${y})"/>`); break;
      }
    }
  }
  return `<svg class="pizza-svg" viewBox="0 0 100 100" role="img" aria-label="${(opz.titolo || 'Pizza').replace(/"/g, '')}" focusable="false">${out.join('')}</svg>`;
}
