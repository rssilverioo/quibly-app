/**
 * Contrast audit for theme/colors.ts.
 *
 *   node scripts/contrast.mjs
 *
 * Contrast is a requirement, not a taste — `colors.ts` already documents that
 * the lime fails as text on light. This makes that check repeatable instead of
 * folklore, and it runs against both palettes because dark-first is not
 * dark-only.
 *
 * Thresholds are WCAG 2.1: 4.5 for body text, 3.0 for large text (>=18.66px
 * bold or >=24px) and for non-text UI (borders, bars, focus rings).
 */

const hex = (h) => {
  const s = h.replace('#', '');
  const n = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
};

const parse = (c) => {
  const m = /rgba?\(([^)]+)\)/.exec(c);
  if (!m) return [...hex(c), 1];
  const p = m[1].split(',').map((x) => parseFloat(x.trim()));
  return [p[0], p[1], p[2], p[3] ?? 1];
};

/** Flatten a possibly-translucent colour onto an opaque base. */
const over = (fg, bg) => {
  const [r, g, b, a] = parse(fg);
  const [br, bg_, bb] = parse(bg);
  return [r * a + br * (1 - a), g * a + bg_ * (1 - a), b * a + bb * (1 - a)];
};

const lum = ([r, g, b]) => {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

/** WCAG contrast ratio. `fg` may be translucent; it is flattened onto `bg`. */
export const ratio = (fg, bg) => {
  const a = lum(over(fg, bg));
  const b = lum(parse(bg).slice(0, 3));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

// ─── The palettes under test ───────────────────────────────────────────────

const dark = {
  bg: '#0A0A0C',
  surface: '#131318',
  surfaceRaised: '#1C1C23',
  fg: '#F5F5F7',
  fgMuted: '#8E8E9A',
  fgSubtle: '#686874',
  accent: '#C8FF4D',
  success: '#4ADE80',
  warning: '#FBBF24',
  danger: '#FF5A5A',
  deadline: '#FF8C3B',
  deadlineSoft: 'rgba(255,140,59,0.16)',
};

const light = {
  bg: '#FAFAFB',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  fg: '#0A0A0C',
  fgMuted: '#6B6B78',
  fgSubtle: '#8E8E9A',
  accent: '#4F7A00',
  success: '#137A38',
  warning: '#A55200',
  danger: '#DC2626',
  deadline: '#A84C08',
  deadlineSoft: 'rgba(168,76,8,0.14)',
};

// ─── Candidates for the new deadline token ─────────────────────────────────
//
// The deadline is the product's motor made visible. It must not read as a
// third red (danger and live are already red) and must not read as `warning`,
// which is a system state. Ember-orange: hotter than amber, not red.

const candidates = {
  dark: ['#FF9F45', '#FFA23A', '#FF8C3B', '#FFB05C', '#F59E4B'],
  light: ['#B4530A', '#A84C08', '#C2570B', '#9A4507', '#AD5A12'],
};

// ─── Report ────────────────────────────────────────────────────────────────

const fmt = (n) => n.toFixed(2).padStart(5);
const verdict = (n, min) => (n >= min ? 'ok  ' : 'FAIL');

const line = (label, fg, bg, min) => {
  const r = ratio(fg, bg);
  console.log(`  ${verdict(r, min)} ${fmt(r)}  (min ${min.toFixed(1)})  ${label}`);
  return r >= min;
};

let failures = 0;
const check = (...args) => { if (!line(...args)) failures++; };

for (const [name, p] of [['DARK', dark], ['LIGHT', light]]) {
  console.log(`\n═══ ${name} — paleta existente ═══`);
  for (const surface of ['bg', 'surface', 'surfaceRaised']) {
    console.log(` sobre ${surface} (${p[surface]})`);
    check('fg          texto corrido', p.fg, p[surface], 4.5);
    check('fgMuted     texto secundário', p.fgMuted, p[surface], 4.5);
    // `fgSubtle` is deliberately below body-text contrast. It is restricted to
    // disabled/non-text detail; readable timestamps and metadata use fgMuted.
    check('fgSubtle    disabled / non-text', p.fgSubtle, p[surface], 3.0);
    check('accent      texto', p.accent, p[surface], 4.5);
    check('success     ✓ verificado', p.success, p[surface], 4.5);
    check('danger      texto', p.danger, p[surface], 4.5);
    check('warning     texto', p.warning, p[surface], 4.5);
  }
}

console.log('\n═══ DEADLINE — valores finais ═══');
for (const [name, p] of [['dark', dark], ['light', light]]) {
  const pill = '#' + over(p.deadlineSoft, p.surface)
    .map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  check(`${name} deadline sobre surface`, p.deadline, p.surface, 4.5);
  check(`${name} deadline sobre deadlineSoft`, p.deadline, pill, 4.5);
}

console.log('\n═══ DEADLINE — candidatos ═══');
for (const [name, p] of [['dark', dark], ['light', light]]) {
  console.log(`\n ${name}: texto do prazo sobre surface (${p.surface}) e sobre o pill`);
  for (const cand of candidates[name]) {
    // The pill: `deadlineSoft` is the candidate at low alpha over the surface.
    const [r, g, b] = hex(cand);
    const softAlpha = name === 'dark' ? 0.16 : 0.14;
    const soft = `rgba(${r},${g},${b},${softAlpha})`;
    const toHex = (rgb) =>
      '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
    const onSurface = ratio(cand, p.surface);
    const onPill = ratio(cand, toHex(over(soft, p.surface)));
    const vsWarning = ratio(cand, p.warning);
    console.log(
      `  ${cand}  surface ${fmt(onSurface)}  pill ${fmt(onPill)}` +
      `  |  distinto de warning: ${vsWarning.toFixed(2)}`,
    );
  }
}

console.log(
  failures === 0
    ? '\n✓ paleta existente sem falha de contraste\n'
    : `\n⚠ ${failures} falha(s) de contraste na paleta existente — ver acima\n`,
);
