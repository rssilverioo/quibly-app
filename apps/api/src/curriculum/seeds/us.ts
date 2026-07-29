import type { CountrySeed } from './types';

/**
 * United States — SAT and the most-taken AP exams.
 *
 * ## ⚠️ Same caveat as `br.ts`
 *
 * These weights are a **structured first estimate**, not a tabulation of real
 * exam items. The SAT's structure is published by College Board and the domain
 * breakdown below follows it; the per-topic numbers within each domain are
 * judgement, not measurement.
 *
 * Because Fase 6 feeds these straight into `weight × (1 − mastery) × urgency`,
 * a wrong weight doesn't crash anything — it quietly sends someone to study the
 * wrong thing for months. **A teacher has to review this table before Fase 6
 * ships.**
 *
 * ## Why only three APs
 *
 * The brief says quality beats volume, and it's right: there are 38 AP exams,
 * and seeding all of them badly would be worse than seeding three well. These
 * are among the highest-enrollment ones. Adding the rest is a matter of
 * extending this array — no code changes, which is the whole point of the
 * seed architecture.
 */
export const unitedStates: CountrySeed = {
  code: 'US',
  nameEn: 'United States',
  namePt: 'Estados Unidos',
  locale: 'en-US',
  weightSource:
    'Structured estimate from College Board published exam specifications ' +
    '(domain weightings) plus judgement on per-topic distribution. PENDING ' +
    'review by a teacher before Fase 6 — see header of prisma/seeds/us.ts.',

  tracks: [
    {
      slug: 'sat',
      name: 'SAT',
      description:
        'Digital SAT: Reading and Writing, and Math. Adaptive, two modules per section.',
      disciplines: [
        {
          slug: 'reading-writing',
          name: 'Reading and Writing',
          color: '#FF8A4D',
          topics: [
            // The four domains below are College Board's own, and their
            // relative weights are published — these are the one part of this
            // file that isn't guesswork.
            { slug: 'craft-structure', name: 'Craft and Structure', weight: 88, frequency: 10 },
            { slug: 'information-ideas', name: 'Information and Ideas', weight: 88, frequency: 10 },
            { slug: 'standard-english', name: 'Standard English Conventions', weight: 78, frequency: 10 },
            { slug: 'expression-ideas', name: 'Expression of Ideas', weight: 70, frequency: 10 },
            { slug: 'vocabulary-context', name: 'Words in context', weight: 82, frequency: 10 },
            { slug: 'text-structure', name: 'Text structure and purpose', weight: 75, frequency: 10 },
            { slug: 'cross-text', name: 'Cross-text connections', weight: 60, frequency: 9 },
            { slug: 'rhetorical-synthesis', name: 'Rhetorical synthesis', weight: 68, frequency: 9 },
          ],
        },
        {
          slug: 'math',
          name: 'Math',
          color: '#4D9FFF',
          topics: [
            { slug: 'algebra', name: 'Algebra: linear equations and systems', weight: 92, frequency: 10 },
            { slug: 'advanced-math', name: 'Advanced Math: nonlinear functions', weight: 88, frequency: 10 },
            { slug: 'problem-solving-data', name: 'Problem-Solving and Data Analysis', weight: 80, frequency: 10 },
            { slug: 'geometry-trig', name: 'Geometry and Trigonometry', weight: 62, frequency: 10 },
            { slug: 'ratios-percentages', name: 'Ratios, rates and percentages', weight: 78, frequency: 10 },
            { slug: 'quadratics', name: 'Quadratic equations', weight: 75, frequency: 10 },
            { slug: 'exponential-functions', name: 'Exponential functions and growth', weight: 65, frequency: 9 },
            { slug: 'statistics-inference', name: 'Statistics and inference', weight: 60, frequency: 9 },
            { slug: 'circles', name: 'Circles and arc measure', weight: 48, frequency: 8 },
          ],
        },
      ],
    },

    {
      slug: 'ap-calculus-ab',
      name: 'AP Calculus AB',
      disciplines: [
        {
          slug: 'calculus',
          name: 'Calculus AB',
          color: '#4D9FFF',
          topics: [
            { slug: 'limits-continuity', name: 'Limits and Continuity', weight: 72, frequency: 10 },
            { slug: 'differentiation-basic', name: 'Differentiation: definition and rules', weight: 85, frequency: 10 },
            { slug: 'differentiation-composite', name: 'Composite, implicit and inverse functions', weight: 80, frequency: 10 },
            { slug: 'contextual-derivatives', name: 'Contextual applications of differentiation', weight: 78, frequency: 10 },
            { slug: 'analytical-derivatives', name: 'Analytical applications of differentiation', weight: 82, frequency: 10 },
            { slug: 'integration', name: 'Integration and accumulation of change', weight: 88, frequency: 10 },
            { slug: 'differential-equations', name: 'Differential equations', weight: 65, frequency: 9 },
            { slug: 'applications-integration', name: 'Applications of integration', weight: 75, frequency: 10 },
          ],
        },
      ],
    },

    {
      slug: 'ap-us-history',
      name: 'AP U.S. History',
      disciplines: [
        {
          slug: 'apush',
          name: 'U.S. History',
          color: '#FBBF24',
          topics: [
            { slug: 'colonial-1491-1754', name: 'Period 1–2: 1491–1754', weight: 55, frequency: 10 },
            { slug: 'revolution-1754-1800', name: 'Period 3: 1754–1800', weight: 72, frequency: 10 },
            { slug: 'early-republic-1800-1848', name: 'Period 4: 1800–1848', weight: 70, frequency: 10 },
            { slug: 'civil-war-1844-1877', name: 'Period 5: 1844–1877', weight: 82, frequency: 10 },
            { slug: 'gilded-age-1865-1898', name: 'Period 6: 1865–1898', weight: 75, frequency: 10 },
            { slug: 'modern-1890-1945', name: 'Period 7: 1890–1945', weight: 85, frequency: 10 },
            { slug: 'postwar-1945-1980', name: 'Period 8: 1945–1980', weight: 80, frequency: 10 },
            { slug: 'contemporary-1980-present', name: 'Period 9: 1980–present', weight: 45, frequency: 9 },
          ],
        },
      ],
    },

    {
      slug: 'ap-biology',
      name: 'AP Biology',
      disciplines: [
        {
          slug: 'ap-bio',
          name: 'Biology',
          color: '#4ADE80',
          topics: [
            { slug: 'chemistry-of-life', name: 'Chemistry of Life', weight: 60, frequency: 10 },
            { slug: 'cell-structure', name: 'Cell Structure and Function', weight: 72, frequency: 10 },
            { slug: 'cellular-energetics', name: 'Cellular Energetics', weight: 70, frequency: 10 },
            { slug: 'cell-communication', name: 'Cell Communication and Cell Cycle', weight: 75, frequency: 10 },
            { slug: 'heredity', name: 'Heredity', weight: 72, frequency: 10 },
            { slug: 'gene-expression', name: 'Gene Expression and Regulation', weight: 85, frequency: 10 },
            { slug: 'natural-selection', name: 'Natural Selection', weight: 88, frequency: 10 },
            { slug: 'ecology', name: 'Ecology', weight: 78, frequency: 10 },
          ],
        },
      ],
    },
  ],
};
