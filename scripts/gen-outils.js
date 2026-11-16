// Génère la rangée d'outils du profil (versions claire et sombre), chaque pastille apparaissant à son tour.
// Usage : bun scripts/gen-outils.js
const tools = ['Claude Code', 'Obsidian', 'JavaScript', 'Python', 'Ollama', 'Three.js', 'GSAP', 'MetaTrader 5'];
const THEMES = {
  dark: { fill: '#161b22', stroke: '#30363d', text: '#e6edf3', dot: '#f0c860' },
  light: { fill: '#f6f8fa', stroke: '#d0d7de', text: '#1f2328', dot: '#9a6700' },
};
const CW = 7.8;

export function outils(theme) {
  const c = THEMES[theme];
  let x = 2;
  const chips = tools.map((tool, i) => {
    const w = tool.length * CW + 40;
    const chip = `  <g class="chip c${i}"><rect x="${x.toFixed(1)}" y="8" width="${w.toFixed(1)}" height="32" rx="8" fill="${c.fill}" stroke="${c.stroke}"/><circle cx="${(x + 15).toFixed(1)}" cy="24" r="3.5" fill="${c.dot}"/><text x="${(x + 26).toFixed(1)}" y="29" textLength="${(tool.length * CW).toFixed(1)}" lengthAdjust="spacingAndGlyphs">${tool}</text></g>`;
    x += w + 8;
    return chip;
  });
  const width = Math.ceil(x);
  const delays = tools.map((_, i) => `.c${i} { animation-delay: ${(0.08 * i).toFixed(2)}s; }`).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="48" viewBox="0 0 ${width} 48" role="img" aria-labelledby="t">
  <title id="t">Outils : ${tools.join(', ')}</title>
  <style>
    .chip { opacity: 0; animation: in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    ${delays}
    @keyframes in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .chip { animation: none; opacity: 1; } }
    text { font-family: 'Cascadia Mono', 'SF Mono', Consolas, 'DejaVu Sans Mono', 'Courier New', monospace; font-size: 13px; font-weight: 600; fill: ${c.text}; }
  </style>
${chips.join('\n')}
</svg>
`;
}

if (import.meta.main) {
  for (const theme of Object.keys(THEMES)) {
    const svg = outils(theme);
    await Bun.write(new URL(`../assets/outils-${theme}.svg`, import.meta.url), svg);
    console.log(`outils-${theme}.svg`, svg.length, 'octets');
  }
}
