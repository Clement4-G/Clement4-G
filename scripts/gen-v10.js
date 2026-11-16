// Génère le V10 animé du profil (versions claire et sombre).
// GitHub interdit le JavaScript dans un README : la 3D est donc calculée ici (projection d'un vrai
// modèle 3D : bancs à 72°, vilebrequin, bielles, pistons) puis figée en images clés SVG que le CSS
// fait défiler. Chaque piston suit la cinématique bielle-manivelle ; un allumage tous les 72°.
// Usage : bun scripts/gen-v10.js
const N = 48; // images par cycle de 720°
const CYCLE = 2.4; // secondes par cycle (animation très ralentie)
// Ordre d'allumage choisi pour l'animation (classique pour un V10 à manetons partagés) : ce n'est pas celui documenté de la LFA.
const ORDER = [1, 6, 5, 10, 2, 7, 3, 8, 4, 9];
const V = (72 / 2) * (Math.PI / 180);
const R = 0.38; // rayon de manivelle
const L = 1.25; // longueur de bielle
const BORE = 0.36;
const DECK = 1.78;
const HEAD = 2.3;

const THEMES = {
  dark: {
    bg: '#0d1117', panel: '#161b22', edge: '#30363d', text: '#e6edf3', dim: '#8b949e', prompt: '#5ef2b0', path: '#58a6ff',
    steel: '#9aa7b4', steelHi: '#d7dee6', steelLo: '#5b6672', rod: '#7d8894', crank: '#c3ccd5',
    glass: '#38d6ff', head: '#1f6f8b', gold: '#f0c860', goldLo: '#a47c22', spark: '#ff9a3c', red: '#f85149', shadow: '#000000',
  },
  light: {
    bg: '#ffffff', panel: '#f6f8fa', edge: '#d0d7de', text: '#1f2328', dim: '#59636e', prompt: '#1a7f37', path: '#0969da',
    steel: '#7b8794', steelHi: '#c4ccd4', steelLo: '#4a5561', rod: '#5f6b77', crank: '#5f6b77',
    glass: '#0a7ea4', head: '#0a7ea4', gold: '#c9961f', goldLo: '#8a6510', spark: '#f0661a', red: '#cf222e', shadow: '#1f2328',
  },
};

// ---------- géométrie 3D ----------
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => mul(a, 1 / Math.hypot(...a));
const rotX = (v, b) => [v[0], v[1] * Math.cos(b) - v[2] * Math.sin(b), v[1] * Math.sin(b) + v[2] * Math.cos(b)];

const AXIS = { A: [0, -Math.sin(V), Math.cos(V)], B: [0, Math.sin(V), Math.cos(V)] };
// cylindres 1-5 sur le banc A, 6-10 sur le banc B (décalé d'une demi-bielle)
const CYL = Array.from({ length: 10 }, (_, i) => {
  const n = i + 1;
  const bank = n <= 5 ? 'A' : 'B';
  const x = n <= 5 ? i * 1.0 : (i - 5) * 1.0 + 0.32;
  const u = AXIS[bank];
  const phase = ORDER.indexOf(n) * 72; // PMH d'allumage (degrés de vilebrequin)
  return { n, bank, x, u, phase };
});

// projection : vue de trois quarts, légèrement plongeante
const AZ = -32 * (Math.PI / 180);
const EL = 20 * (Math.PI / 180);
const S = 72;
const OX = 330;
const OY = 278;
const CX = 2.15;
function proj(p) {
  const x = p[0] - CX;
  const x1 = x * Math.cos(AZ) - p[1] * Math.sin(AZ);
  const y1 = x * Math.sin(AZ) + p[1] * Math.cos(AZ);
  const up = p[2] * Math.cos(EL) + y1 * Math.sin(EL);
  const depth = y1 * Math.cos(EL) - p[2] * Math.sin(EL);
  return { x: OX + x1 * S, y: OY - up * S, d: depth };
}

function ring(center, axis, radius, n = 14) {
  const e1 = [1, 0, 0];
  const e2 = norm(cross(axis, e1));
  const a = Math.abs(axis[0]) > 0.9 ? norm(cross(axis, [0, 0, 1])) : e1;
  const b = Math.abs(axis[0]) > 0.9 ? norm(cross(axis, a)) : e2;
  return Array.from({ length: n }, (_, k) => {
    const t = (k / n) * Math.PI * 2;
    return add(center, add(mul(a, Math.cos(t) * radius), mul(b, Math.sin(t) * radius)));
  });
}

function hull(points) {
  const p = points.map((q) => [q.x, q.y]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const c = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const q of p) { while (lo.length >= 2 && c(lo.at(-2), lo.at(-1), q) <= 0) lo.pop(); lo.push(q); }
  const up = [];
  for (const q of p.reverse()) { while (up.length >= 2 && c(up.at(-2), up.at(-1), q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const f1 = (n) => (Math.round(n * 10) / 10).toString();
const pathOf = (pts) => 'M' + pts.map((q) => `${f1(q[0] ?? q.x)} ${f1(q[1] ?? q.y)}`).join('L') + 'Z';
const avgDepth = (pts) => pts.reduce((s, q) => s + q.d, 0) / pts.length;

// solide de révolution entre deux centres (piston, chemise, trompette)
function tube(c0, c1, r0, r1 = r0) {
  const axis = norm(add(c1, mul(c0, -1)));
  const pts = [...ring(c0, axis, r0), ...ring(c1, axis, r1)].map(proj);
  const top = ring(c1, axis, r1).map(proj);
  return { outline: pathOf(hull(pts)), top: pathOf(top.map((q) => [q.x, q.y])), d: avgDepth(pts) };
}

// cinématique : position du pied de piston et du maneton pour un angle de vilebrequin
function kinematics(cyl, thetaDeg) {
  const beta = ((thetaDeg - cyl.phase) * Math.PI) / 180;
  const pin = add([cyl.x, 0, 0], mul(rotX(cyl.u, -beta), R)); // sens de rotation choisi pour que les cylindres n et n+5 partagent leur maneton
  const along = R * Math.cos(beta);
  const perp = R * Math.sin(beta);
  const s = along + Math.sqrt(L * L - perp * perp);
  return { pin, gudgeon: add([cyl.x, 0, 0], mul(cyl.u, s)), s };
}

// ---------- rendu ----------
function frame(c, k) {
  const theta = (k / N) * 720;
  const items = [];
  // vilebrequin : arbre principal + bras vers chaque maneton
  const shaftA = proj([-0.55, 0, 0]);
  const shaftB = proj([4.85, 0, 0]);
  items.push({ d: 0.5, svg: `<path d="M${f1(shaftA.x)} ${f1(shaftA.y)}L${f1(shaftB.x)} ${f1(shaftB.y)}" stroke="${c.crank}" stroke-width="7" stroke-linecap="round"/>` });
  for (const cyl of CYL) {
    const { pin, gudgeon, s } = kinematics(cyl, theta);
    const m = proj([cyl.x, 0, 0]);
    const p = proj(pin);
    const g = proj(gudgeon);
    items.push({ d: p.d + 0.01, svg: `<path d="M${f1(m.x)} ${f1(m.y)}L${f1(p.x)} ${f1(p.y)}" stroke="${c.steelLo}" stroke-width="9" stroke-linecap="round"/>` });
    items.push({ d: (p.d + g.d) / 2, svg: `<path d="M${f1(p.x)} ${f1(p.y)}L${f1(g.x)} ${f1(g.y)}" stroke="${c.rod}" stroke-width="4" stroke-linecap="round"/>` });
    const piston = tube(add([cyl.x, 0, 0], mul(cyl.u, s - 0.3)), add([cyl.x, 0, 0], mul(cyl.u, s + 0.12)), BORE - 0.02);
    items.push({ d: piston.d - 0.02, svg: `<path d="${piston.outline}" fill="url(#steel)" stroke="${c.steelLo}" stroke-width="0.8"/><path d="${piston.top}" fill="${c.steelHi}" opacity="0.9"/>` });
  }
  items.sort((a, b) => b.d - a.d); // du plus loin au plus proche

  // allumages : flash dans la chambre du cylindre qui vient de passer son PMH d'allumage
  const sparks = CYL.map((cyl) => {
    const since = (((theta - cyl.phase) % 720) + 720) % 720;
    if (since > 45) return '';
    const o = proj(add([cyl.x, 0, 0], mul(cyl.u, DECK - 0.05)));
    const a = 1 - since / 45;
    return `<circle cx="${f1(o.x)}" cy="${f1(o.y)}" r="${f1(10 + 16 * a)}" fill="url(#spark)" opacity="${a.toFixed(2)}"/>`;
  }).join('');
  return { body: items.map((i) => i.svg).join(''), sparks };
}

function staticParts(c) {
  const liners = [];
  const heads = [];
  const stacks = [];
  for (const cyl of CYL) {
    const o = [cyl.x, 0, 0];
    const t = tube(add(o, mul(cyl.u, 0.95)), add(o, mul(cyl.u, DECK)), BORE + 0.04);
    liners.push({ d: t.d, svg: `<path d="${t.outline}" fill="${c.glass}" fill-opacity="0.10" stroke="${c.glass}" stroke-opacity="0.55" stroke-width="1"/><path d="${t.top}" fill="none" stroke="${c.glass}" stroke-opacity="0.7" stroke-width="1"/>` });
    // trompette d'admission (un papillon par cylindre), côté intérieur du V
    const inward = norm(cross([1, 0, 0], cyl.u)).map((v) => v * (cyl.bank === 'A' ? 1 : -1));
    const base = add(add(o, mul(cyl.u, HEAD - 0.08)), mul(inward, 0.22));
    const st = tube(base, add(base, [0, 0, 0.62]), 0.13, 0.2);
    stacks.push({ d: st.d, svg: `<path d="${st.outline}" fill="url(#gold)" stroke="${c.goldLo}" stroke-width="0.8"/><path d="${st.top}" fill="${c.bg}" stroke="${c.gold}" stroke-width="1.2"/>` });
  }
  // culasses : un caisson par banc
  for (const bank of ['A', 'B']) {
    const u = AXIS[bank];
    const side = norm(cross(u, [1, 0, 0]));
    const xs = bank === 'A' ? [-0.5, 4.5] : [-0.18, 4.82];
    const corners = [];
    for (const x of xs) for (const h of [DECK, HEAD]) for (const w of [-0.5, 0.5]) corners.push(proj(add(add([x, 0, 0], mul(u, h)), mul(side, w))));
    heads.push({ d: avgDepth(corners), svg: `<path d="${pathOf(hull(corners))}" fill="${c.head}" fill-opacity="0.22" stroke="${c.glass}" stroke-opacity="0.8" stroke-width="1.2"/>` });
  }
  const sortD = (arr) => arr.sort((a, b) => b.d - a.d).map((i) => i.svg).join('');
  return { liners: sortD(liners), heads: sortD(heads), stacks: sortD(stacks) };
}

function tach(c) {
  // compte-tours façon instrument numérique : 0 à 9 (×1000 tr/min), zone rouge à partir de 8
  const cx = 742;
  const cy = 196;
  const r = 82;
  const ang = (v) => ((-120 + (v / 9) * 240) * Math.PI) / 180;
  const pt = (v, rr) => [cx + Math.sin(ang(v)) * rr, cy - Math.cos(ang(v)) * rr];
  const arc = (v0, v1, rr) => {
    const [x0, y0] = pt(v0, rr);
    const [x1, y1] = pt(v1, rr);
    return `M${f1(x0)} ${f1(y0)}A${rr} ${rr} 0 ${(v1 - v0) / 9 * 240 > 180 ? 1 : 0} 1 ${f1(x1)} ${f1(y1)}`;
  };
  let ticks = '';
  for (let v = 0; v <= 9; v += 1) {
    const [x0, y0] = pt(v, r - 12);
    const [x1, y1] = pt(v, r - 2);
    const [tx, ty] = pt(v, r - 26);
    ticks += `<path d="M${f1(x0)} ${f1(y0)}L${f1(x1)} ${f1(y1)}" stroke="${v >= 8 ? c.red : c.text}" stroke-width="2"/>`;
    ticks += `<text x="${f1(tx)}" y="${f1(ty + 4)}" text-anchor="middle" fill="${v >= 8 ? c.red : c.dim}" class="m" style="font-size:12px">${v}</text>`;
  }
  return `<g>
    <circle cx="${cx}" cy="${cy}" r="${r + 10}" fill="${c.panel}" stroke="${c.edge}"/>
    <path d="${arc(0, 8, r)}" fill="none" stroke="${c.edge}" stroke-width="4"/>
    <path d="${arc(8, 9, r)}" fill="none" stroke="${c.red}" stroke-width="6"/>
    ${ticks}
    <g class="needle"><path d="M${cx - 3} ${cy + 14}L${cx} ${cy - r + 6}L${cx + 3} ${cy + 14}Z" fill="${c.spark}"/></g>
    <circle cx="${cx}" cy="${cy}" r="7" fill="${c.text}"/>
    <text x="${cx}" y="${cy + 42}" text-anchor="middle" fill="${c.dim}" class="m" style="font-size:11px">×1000 tr/min</text>
    <text x="${cx}" y="${cy + 62}" text-anchor="middle" fill="${c.text}" class="m" style="font-size:13px;font-weight:700">9 000</text>
  </g>`;
}

export function v10(theme) {
  const c = THEMES[theme];
  const W = 880;
  const H = 400;
  const st = staticParts(c);
  const frames = Array.from({ length: N }, (_, k) => frame(c, k));
  const step = 100 / N;
  const frameCss = frames.map((_, k) => `.f${k}{animation-delay:${((k / N) * CYCLE - CYCLE).toFixed(3)}s}`).join('');
  const groundA = proj([-0.8, 0, -0.75]);
  const groundB = proj([5.1, 0, -0.75]);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d">
  <title id="t">Un V10 en mouvement</title>
  <desc id="d">Moteur V10 à 72° dessiné en 3D, inspiré de celui de la Lexus LFA : dix pistons, leurs bielles et le vilebrequin tournent, chaque cylindre s'allume à son tour, et un compte-tours monte jusqu'à 9 000 tr/min.</desc>
  <style>
    .m { font-family: 'Cascadia Mono', 'SF Mono', Consolas, 'DejaVu Sans Mono', 'Courier New', monospace; }
    .f { opacity: 0; animation: fr ${CYCLE}s step-end infinite; }
    @keyframes fr { 0% { opacity: 1; } ${step.toFixed(4)}% { opacity: 0; } 100% { opacity: 0; } }
    ${frameCss}
    .needle { transform-origin: 742px 196px; transform: rotate(-120deg); animation: rev ${CYCLE * 2}s cubic-bezier(0.5, 0, 0.3, 1) infinite; }
    @keyframes rev { 0%, 8% { transform: rotate(-104deg); } 38% { transform: rotate(120deg); } 46% { transform: rotate(114deg); } 52% { transform: rotate(120deg); } 82%, 100% { transform: rotate(-104deg); } }
    .glow { animation: glow ${CYCLE * 2}s ease-in-out infinite; }
    @keyframes glow { 0%, 20%, 70%, 100% { opacity: 0.15; } 40%, 52% { opacity: 0.55; } }
    @media (prefers-reduced-motion: reduce) {
      .f, .needle, .glow { animation: none; }
      .f0 { opacity: 1; }
    }
  </style>
  <defs>
    <linearGradient id="steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.steelHi}"/><stop offset="0.55" stop-color="${c.steel}"/><stop offset="1" stop-color="${c.steelLo}"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c.goldLo}"/><stop offset="0.45" stop-color="${c.gold}"/><stop offset="1" stop-color="${c.goldLo}"/></linearGradient>
    <radialGradient id="spark"><stop offset="0" stop-color="#fff6d8"/><stop offset="0.35" stop-color="${c.spark}"/><stop offset="1" stop-color="${c.spark}" stop-opacity="0"/></radialGradient>
    <radialGradient id="shadow"><stop offset="0" stop-color="${c.shadow}" stop-opacity="0.35"/><stop offset="1" stop-color="${c.shadow}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="12" fill="${c.bg}" stroke="${c.edge}"/>
  <text x="26" y="36" class="m" style="font-size:14px"><tspan fill="${c.prompt}">clement@gast</tspan><tspan fill="${c.text}">:</tspan><tspan fill="${c.path}">~</tspan><tspan fill="${c.text}">$ ./passions --moteur v10</tspan></text>
  <ellipse cx="${f1((groundA.x + groundB.x) / 2)}" cy="${f1((groundA.y + groundB.y) / 2 + 8)}" rx="300" ry="38" fill="url(#shadow)"/>
  <ellipse class="glow" cx="${OX}" cy="${OY - 120}" rx="270" ry="120" fill="url(#spark)" opacity="0.15"/>
  ${frames.map((f, k) => `<g class="f f${k}">${f.body}</g>`).join('\n  ')}
  ${st.liners}
  ${st.heads}
  ${frames.map((f, k) => (f.sparks ? `<g class="f f${k}">${f.sparks}</g>` : '')).join('')}
  ${st.stacks}
  ${tach(c)}
  <text x="26" y="${H - 22}" class="m" fill="${c.dim}" style="font-size:12px">V10 à 72° · 4,8 L · un allumage tous les 72° de vilebrequin · inspiré de la Lexus LFA · animation très ralentie</text>
</svg>
`;
}

if (import.meta.main) {
  for (const theme of Object.keys(THEMES)) {
    const svg = v10(theme);
    await Bun.write(new URL(`../assets/v10-${theme}.svg`, import.meta.url), svg);
    console.log(`v10-${theme}.svg`, (svg.length / 1024).toFixed(1), 'Ko');
  }
}
