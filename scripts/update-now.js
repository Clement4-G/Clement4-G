// Réécrit la section « En ce moment » du README à partir du site en ligne (cv.json) et de la date
// de dernière publication du musée. Lancé chaque jour par .github/workflows/now.yml.
// Les données distantes sont traitées comme non fiables : nettoyées, bornées, jamais interprétées.
const START = '<!-- NOW:START -->';
const END = '<!-- NOW:END -->';
const SITE = 'https://clement4-g.github.io';
const MUSEUM_REPO = 'Clement4-G/Clement4-G.github.io';

// Date d'une chaîne ISO plausible (après 2020, pas dans le futur), en français, heure de Paris.
export function frDate(iso) {
  if (typeof iso !== 'string') throw new Error(`date absente : ${iso}`);
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t) || t < Date.UTC(2020, 0, 1) || t > Date.now() + 86400000) throw new Error(`date invalide : ${iso}`);
  const parts = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type).value;
  const day = get('day') === '1' ? '1er' : get('day');
  return `${day} ${get('month')} ${get('year')}`;
}

// Texte brut sur liste blanche : lettres, chiffres, espaces et ponctuation simple.
// Ni « : », ni « / », ni « @ » : aucun lien ni e-mail ne peut se former, même par autolien GitHub.
export function clean(s) {
  const kept = String(s ?? '')
    .replace(/[\p{Cc}\p{Cf}]+/gu, ' ')
    .replace(/[^\p{L}\p{N} .,;'’!?–-]/gu, '')
    .replace(/\bwww\./giu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return [...kept].slice(0, 120).join('').trim();
}

function checkCv(cv) {
  if (!cv || !Array.isArray(cv.projects)) throw new Error('cv.json inattendu : pas de liste de projets');
  const n = cv.projects.length;
  if (n < 1 || n > 20) throw new Error(`cv.json inattendu : ${n} projets`);
  if (!cv.projects.every((p) => p && typeof p === 'object')) throw new Error('cv.json inattendu : projets mal formés');
  if (cv.seeking !== undefined && typeof cv.seeking?.fr !== 'string') throw new Error('cv.json inattendu : statut non textuel');
  return n;
}

// Phrase courte pour le terminal : la première phrase du statut, ou une formule neutre.
export function statusLine(cv) {
  const first = clean(cv?.seeking?.fr).split('.')[0].trim();
  return first ? [...first].slice(0, 32).join('') : 'Ouvert aux échanges';
}

export function renderNow({ cv, museumPushedAt }) {
  const n = checkCv(cv);
  const seeking = clean(cv.seeking?.fr);
  const status = seeking ? `🟢 ${seeking}` : '⚪ Ouvert aux échanges';
  return [
    '| | |',
    '|---|---|',
    `| **Musée** | [mis à jour le ${frDate(museumPushedAt)}](${SITE}/) · ${n} projet${n > 1 ? 's' : ''} exposé${n > 1 ? 's' : ''} |`,
    `| **Statut** | ${status} |`,
  ].join('\n');
}

export function replaceBlock(readme, block) {
  const a = readme.indexOf(START);
  const b = readme.indexOf(END);
  if (a < 0 || b < a) throw new Error('marqueurs NOW absents du README');
  return readme.slice(0, a + START.length) + '\n' + block + '\n' + readme.slice(b);
}

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers: { 'user-agent': 'profile-readme-updater', ...headers }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

export const fetchCv = () => getJson(`${SITE}/cv.json`);

// Écrit un fichier seulement s'il change ; renvoie true si c'est le cas.
async function writeIfChanged(url, text) {
  const file = Bun.file(url);
  if ((await file.exists()) && (await file.text()) === text) return false;
  await Bun.write(url, text);
  return true;
}

if (import.meta.main) {
  const auth = process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
  const [cv, repo] = await Promise.all([
    fetchCv(),
    getJson(`https://api.github.com/repos/${MUSEUM_REPO}`, { accept: 'application/vnd.github+json', ...auth }),
  ]);
  // tout est calculé et validé avant la moindre écriture : une donnée suspecte n'écrit rien
  const readmeUrl = new URL('../README.md', import.meta.url);
  const readme = replaceBlock(await Bun.file(readmeUrl).text(), renderNow({ cv, museumPushedAt: repo.pushed_at }));
  const { terminal, TERMINAL_THEMES } = await import('./gen-terminal.js');
  const status = statusLine(cv);
  const changed = [await writeIfChanged(readmeUrl, readme)];
  for (const theme of TERMINAL_THEMES) changed.push(await writeIfChanged(new URL(`../assets/terminal-${theme}.svg`, import.meta.url), terminal(theme, status)));
  console.log(changed.some(Boolean) ? 'Profil mis à jour.' : 'Profil déjà à jour.', '· statut :', status);
}
