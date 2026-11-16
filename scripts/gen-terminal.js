// Génère la fiche « terminal » du profil (versions claire et sombre) : une commande qui se tape,
// une fiche façon neofetch, puis l'invitation au musée. Aucune police distante : chaque ligne
// reçoit un textLength, donc l'animation de frappe reste calée même si la police de secours change.
// Usage : bun scripts/gen-terminal.js
const CW = 8.4; // largeur imposée d'un caractère (px)
const LH = 23; // interligne
const FS = 14;

const THEMES = {
  dark: {
    page: '#0d1117', win: '#161b22', bar: '#21262d', edge: '#30363d', text: '#e6edf3', dim: '#8b949e',
    prompt: '#5ef2b0', path: '#e6edf3', key: '#8b949e', accent: '#5ef2b0', ok: '#5ef2b0',
    art: ['#e6edf3', '#8b949e'],
  },
  light: {
    page: '#ffffff', win: '#f6f8fa', bar: '#eaeef2', edge: '#d0d7de', text: '#1f2328', dim: '#59636e',
    prompt: '#1a7f37', path: '#1f2328', key: '#59636e', accent: '#1a7f37', ok: '#1a7f37',
    art: ['#1f2328', '#59636e'],
  },
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const len = (s) => [...s].length;

// Une ligne de texte de largeur exacte (textLength) ; segments = [[texte, couleur], …]
function line(x, y, segments, extra = '') {
  let cx = x;
  return segments.map(([s, fill]) => {
    const w = len(s) * CW;
    const t = s.trim() === '' ? '' : `<text x="${cx.toFixed(1)}" y="${y}" fill="${fill}" textLength="${w.toFixed(1)}" lengthAdjust="spacingAndGlyphs" xml:space="preserve"${extra}>${esc(s)}</text>`;
    cx += w;
    return t;
  }).join('');
}

const ART = [
  ' █████    █████ ',
  '██   ██  ██   ██',
  '██       ██     ',
  '██       ██  ███',
  '██       ██   ██',
  '██   ██  ██   ██',
  ' █████    █████ ',
];

const FACTS = [
  ['Rôle', 'Business × IA'],
  ['Formation', 'Master International Business'],
  ['Construit', 'Sites web · agents IA · automatisation'],
  ['Outils', 'Claude Code · Obsidian · JS · Python · Ollama'],
  ['Projet ★', 'Site vitrine de Tethys, en ligne en 3 mois'],
  ['Méthode', 'Je cadre, les agents codent, je vérifie'],
];

export function terminal(theme, status = 'Ouvert aux échanges') {
  const c = THEMES[theme];
  const W = 740;
  const X = 34; // marge gauche du texte
  const top = 62; // première ligne
  const css = [];
  let y = top;
  const body = [];

  // Commande tapée : texte + cache qui glisse vers la droite caractère par caractère.
  let t = 0.4; // horloge de la mise en scène (s)
  function typed(cmd, yy) {
    const promptSegs = [['clement@gast', c.prompt], [':', c.text], ['~', c.path], ['$ ', c.text]];
    const pw = len('clement@gast:~$ ') * CW;
    const n = len(cmd);
    const dur = Math.max(0.5, n * 0.055);
    const id = `k${body.length}`;
    body.push(line(X, yy, promptSegs));
    body.push(line(X + pw, yy, [[cmd, c.text]]));
    body.push(`<rect class="${id}" x="${(X + pw - 1).toFixed(1)}" y="${yy - 16}" width="${(n * CW + 12).toFixed(1)}" height="21" fill="${c.win}"/>`);
    css.push(`.${id}{animation:type ${dur.toFixed(2)}s steps(${n}) ${t.toFixed(2)}s forwards;--w:${(n * CW).toFixed(1)}px}`);
    t += dur + 0.35;
  }
  function reveal(markup, step = 0.09) {
    const id = `r${body.length}`;
    body.push(`<g class="rv ${id}">${markup}</g>`);
    css.push(`.${id}{animation-delay:${t.toFixed(2)}s}`);
    t += step;
  }

  typed('whoami', y);
  y += LH + 8;

  // Fiche : art à gauche, faits à droite
  const artX = X + 4;
  const factX = X + 21 * CW;
  const startY = y;
  // monogramme en pixels « caractère de terminal » (10 × 20), qui se construit ligne à ligne
  ART.forEach((row, i) => {
    const cells = [...row].map((ch, j) => ch === '█'
      ? `<rect x="${artX + j * 10}" y="${startY - 12 + i * 21}" width="9" height="19" rx="1.5" fill="url(#art)"/>` : '').join('');
    reveal(cells, 0.05);
  });
  t -= ART.length * 0.05; // l'art et les faits apparaissent ensemble
  reveal(line(factX, startY, [['clement', c.prompt], ['@', c.text], ['gast', c.prompt]]));
  reveal(line(factX, startY + LH, [['─'.repeat(44), c.edge]]));
  FACTS.forEach(([k, v], i) => {
    reveal(line(factX, startY + LH * (i + 2), [[k.padEnd(11), c.key], [v, c.text]]));
  });
  const statusY = startY + LH * (FACTS.length + 2);
  reveal(`<circle class="pulse" cx="${(factX + 11 * CW + 5).toFixed(1)}" cy="${statusY - 5}" r="5" fill="${c.ok}"/>`
    + line(factX, statusY, [['Statut', c.key]]) + line(factX + 13 * CW, statusY, [[status, c.ok]]));

  y = statusY + 42;
  typed('./musee --visiter', y);
  y += LH;
  reveal(line(X, y, [['→ ', c.accent], ['clement4-g.github.io', c.accent], ['  · un musée à visiter en 3D', c.dim]]), 0.2);
  y += LH;
  const curX = X + len('clement@gast:~$ ') * CW;
  reveal(line(X, y, [['clement@gast', c.prompt], [':', c.text], ['~', c.path], ['$', c.text]])
    + `<rect class="cursor" x="${curX.toFixed(1)}" y="${y - 14}" width="${CW.toFixed(1)}" height="18" fill="${c.text}"/>`);

  const H = y + 30;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d">
  <title id="t">Clément GAST · Business × IA</title>
  <desc id="d">Terminal animé : fiche de présentation (Master International Business, sites web, agents IA et automatisation, statut : ${esc(status)}) puis lien vers le musée-portfolio.</desc>
  <style>
    text { font-family: 'Cascadia Mono', 'SF Mono', Consolas, 'DejaVu Sans Mono', 'Courier New', monospace; font-size: ${FS}px; }
    .rv { opacity: 0; animation: rv 0.35s ease-out forwards; }
    @keyframes rv { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: none; } }
    @keyframes type { to { transform: translateX(var(--w)); } }
    .cursor { animation: blink 1.05s steps(1) infinite; }
    @keyframes blink { 50% { opacity: 0; } }
    .pulse { animation: pulse 1.8s ease-in-out infinite; }
    @keyframes pulse { 50% { opacity: 0.3; } }
    ${css.join('\n    ')}
    @media (prefers-reduced-motion: reduce) {
      .rv { animation: none; opacity: 1; }
      [class^="k"] { animation: none; display: none; }
      .cursor, .pulse { animation: none; }
    }
  </style>
  <defs>
    <linearGradient id="art" gradientUnits="userSpaceOnUse" x1="38" y1="80" x2="200" y2="230"><stop offset="0" stop-color="${c.art[0]}"/><stop offset="1" stop-color="${c.art[1]}"/></linearGradient>
  </defs>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="12" fill="${c.win}" stroke="${c.edge}"/>
  <path d="M1 13a12 12 0 0 1 12-12h${W - 26}a12 12 0 0 1 12 12v19H1z" fill="${c.bar}"/>
  <line x1="1" y1="32" x2="${W - 1}" y2="32" stroke="${c.edge}"/>
  <circle cx="22" cy="17" r="6" fill="${c.edge}"/><circle cx="42" cy="17" r="6" fill="${c.edge}"/><circle cx="62" cy="17" r="6" fill="${c.edge}"/>
  <text x="${W / 2}" y="21" text-anchor="middle" fill="${c.dim}" style="font-size:12px">clement@gast — bash</text>
  ${body.join('\n  ')}
</svg>
`;
}

export const TERMINAL_THEMES = Object.keys(THEMES);

if (import.meta.main) {
  // le statut est lu sur le site en ligne, comme le fait l'Action quotidienne
  const { fetchCv, statusLine } = await import('./update-now.js');
  const status = statusLine(await fetchCv());
  for (const theme of TERMINAL_THEMES) {
    const svg = terminal(theme, status);
    await Bun.write(new URL(`../assets/terminal-${theme}.svg`, import.meta.url), svg);
    console.log(`terminal-${theme}.svg`, (svg.length / 1024).toFixed(1), 'Ko', '· statut :', status);
  }
}
