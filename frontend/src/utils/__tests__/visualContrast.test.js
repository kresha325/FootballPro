import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { lightColors, darkColors } from '../../../../mobile/src/theme/tokens.js';

const frontendRoot = globalThis.process.cwd();
const css = readFileSync(path.resolve(frontendRoot, 'src/index.css'), 'utf8');
const matchesSource = readFileSync(path.resolve(frontendRoot, 'src/components/Matches.jsx'), 'utf8');
const tournamentMobileSource = readFileSync(path.resolve(frontendRoot, '../mobile/src/screens/TournamentDetailScreen.js'), 'utf8');

function luminance(hex) {
  const raw = hex.replace('#', '');
  const expanded = raw.length === 3 ? raw.split('').map((part) => part + part).join('') : raw;
  const channels = [0, 2, 4].map((offset) => parseInt(expanded.slice(offset, offset + 2), 16) / 255);
  const [r, g, b] = channels.map((value) => (
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function cssTokenValues(name) {
  return [...css.matchAll(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})`, 'g'))].map((match) => match[1]);
}

describe('XTALENTI visual accessibility regression checks', () => {
  it('keeps mobile secondary and muted labels at WCAG AA on elevated surfaces', () => {
    expect(contrast(lightColors.mutedSoft, lightColors.bgElevated)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(darkColors.mutedSoft, darkColors.bgElevated)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps foreground text on the brand action color at WCAG AA in both themes', () => {
    expect(contrast(lightColors.onPrimary, lightColors.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(darkColors.onPrimary, darkColors.primary)).toBeGreaterThanOrEqual(4.5);
    const webGold = cssTokenValues('--xt-color-gold');
    const webOnGold = cssTokenValues('--xt-color-on-gold');
    expect(webGold).toHaveLength(2);
    expect(webOnGold).toHaveLength(2);
    webGold.forEach((gold, index) => expect(contrast(webOnGold[index], gold)).toBeGreaterThanOrEqual(4.5));
    expect(css).toContain('.btn-primary { color: var(--xt-color-on-gold); background: var(--xt-color-gold); }');
  });

  it('uses a theme-aware heading color on the light and dark match listing card', () => {
    expect(matchesSource).toMatch(/<h1[^>]*text-\[var\(--xt-color-text\)\]/);
  });

  it('renders the official tournament match score as a distinct accessible value', () => {
    expect(tournamentMobileSource).toContain('styles.officialScore');
    expect(tournamentMobileSource).toContain("{matchModal.data.match.scoreHome ?? '—'} : {matchModal.data.match.scoreAway ?? '—'}");
    expect(tournamentMobileSource).toContain('Rezultati zyrtar:');
  });
});
