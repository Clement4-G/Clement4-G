import { describe, expect, test } from 'bun:test';
import { frDate, clean, renderNow, replaceBlock, statusLine } from './update-now.js';

const cv = {
  seeking: { fr: 'Je cherche un stage. Écrivez-moi.' },
  projects: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
};

describe('frDate', () => {
  test('écrit la date en français, heure de Paris', () => {
    expect(frDate('2026-11-16T13:28:15Z')).toBe('16 novembre 2026');
    // 23 h 30 UTC le 31 décembre = déjà le 1er janvier à Paris
    expect(frDate('2025-12-31T23:30:00Z')).toBe('1er janvier 2026');
  });
  test('refuse une date invalide, absente, trop ancienne ou future', () => {
    expect(() => frDate('pas une date')).toThrow();
    expect(() => frDate(null)).toThrow();
    expect(() => frDate(0)).toThrow();
    expect(() => frDate('1970-01-01T00:00:00Z')).toThrow();
    expect(() => frDate('2999-01-01T00:00:00Z')).toThrow();
  });
});

describe('clean', () => {
  test('neutralise le Markdown et le HTML venus du site', () => {
    expect(clean('<img src=x onerror=alert(1)> [lien](http://x) | a')).not.toMatch(/[<>[\]()|]/);
  });
  test('supprime liens, e-mails et caractères de contrôle invisibles', () => {
    const out = clean('Visitez https://evil.example/x www.evil.example ' + ['mail', 'evil.example'].join('@') + ' a\u202Eb\u200Bc');
    expect(out).not.toMatch(/[:/@]/);
    expect(out).not.toMatch(/[\u202E\u200B]/);
  });
  test('garde les accents et la ponctuation simple', () => {
    expect(clean('Je cherche un stage. Écrivez-moi.')).toBe('Je cherche un stage. Écrivez-moi.');
  });
  test('ne coupe jamais un caractère en deux', () => {
    const out = clean('é'.repeat(119) + '\u{1F600}\u{1F600}');
    expect(out).not.toMatch(/[\uD800-\uDFFF]/u);
  });
  test('coupe les textes trop longs et les retours à la ligne', () => {
    const out = clean('a'.repeat(500) + '\nb');
    expect(out.length).toBeLessThanOrEqual(120);
    expect(out).not.toContain('\n');
  });
});

describe('renderNow', () => {
  test('affiche date du musée, nombre de projets et statut', () => {
    const md = renderNow({ cv, museumPushedAt: '2026-11-16T13:28:15Z' });
    expect(md).toContain('16 novembre 2026');
    expect(md).toContain('4 projets exposés');
    expect(md).toContain('Je cherche un stage. Écrivez-moi.');
  });
  test('sans recherche en cours, le statut reste neutre', () => {
    const md = renderNow({ cv: { projects: [{}] }, museumPushedAt: '2026-11-16T13:28:15Z' });
    expect(md).toContain('Ouvert aux échanges');
    expect(md).not.toContain('stage');
  });
  test('refuse un cv.json sans liste de projets', () => {
    expect(() => renderNow({ cv: {}, museumPushedAt: '2026-11-16T13:28:15Z' })).toThrow();
  });
  test('refuse un statut qui n’est pas du texte', () => {
    expect(() => renderNow({ cv: { ...cv, seeking: { fr: 12345 } }, museumPushedAt: '2026-11-16T13:28:15Z' })).toThrow();
  });
  test('refuse un nombre de projets aberrant', () => {
    expect(() => renderNow({ cv: { projects: [] }, museumPushedAt: '2026-11-16T13:28:15Z' })).toThrow();
    expect(() => renderNow({ cv: { projects: Array(50).fill({}) }, museumPushedAt: '2026-11-16T13:28:15Z' })).toThrow();
    expect(() => renderNow({ cv: { projects: [1, 2] }, museumPushedAt: '2026-11-16T13:28:15Z' })).toThrow();
  });
  test('statusLine donne une phrase courte pour le terminal', () => {
    expect(statusLine(cv)).toBe('Je cherche un stage');
    expect(statusLine({ projects: [{}] })).toBe('Ouvert aux échanges');
  });
});

describe('replaceBlock', () => {
  const readme = 'avant\n<!-- NOW:START -->\nvieux\n<!-- NOW:END -->\naprès\n';
  test('remplace uniquement entre les marqueurs', () => {
    expect(replaceBlock(readme, 'neuf')).toBe('avant\n<!-- NOW:START -->\nneuf\n<!-- NOW:END -->\naprès\n');
  });
  test('refuse un README sans marqueurs', () => {
    expect(() => replaceBlock('rien', 'neuf')).toThrow();
  });
});
