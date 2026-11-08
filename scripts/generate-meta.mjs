// Deterministic synthetic meta-analysis benchmark generator.
//
// Ground truth is computed here, from the defining formulas, and never from
// dsh-meta-analysis: this script does not import the plugin and no expected
// value is fitted to plugin output. The two models are inverse-variance
// pooling with
//
//   w_i = 1 / se_i^2,  theta_FE = sum(w_i theta_i) / sum(w_i),
//   Q = sum w_i (theta_i - theta_FE)^2,  df = k - 1,
//   tau^2 = max(0, (Q - df) / (sum w_i - sum w_i^2 / sum w_i))   [DerSimonian-Laird],
//   w_i* = 1 / (se_i^2 + tau^2),  theta_RE = sum(w_i* theta_i) / sum(w_i*),
//   se_FE = sqrt(1 / sum w_i),  se_RE = sqrt(1 / sum w_i*),
//   I^2 = max(0, (Q - df) / Q)   (0 when Q = 0),
//   CI = theta +/- 1.959963984540054 * se.
//
// pQ = P(chi^2_df > Q) is evaluated from the closed-form finite-sum survival
// formulas for integer df (even: a terminating Poisson sum; odd: the same sum
// plus erfc(sqrt(Q/2)), with erfc from its Taylor series / continued fraction).
// That path is independent of the plugin's regularized incomplete-gamma code.
//
// The dataset is synthetic and frozen: no timestamps, no randomness, and two
// runs write byte-identical files.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'data', 'meta')
mkdirSync(outDir, { recursive: true })

const VERSION = '0.1.0'
const TOTAL_CASES = 20
const CONFIDENCE_LEVEL = 0.95
const Z_CRITICAL = 1.959963984540054

// ── independent special functions ───────────────────────────────────────────

/** erf(x) for x >= 0 from its Taylor series. */
function erfSeries(x) {
  let term = x
  let sum = 0
  for (let n = 0; n < 200; n += 1) {
    const add = term / (2 * n + 1)
    sum += add
    if (Math.abs(add) < 1e-18 * Math.max(Math.abs(sum), 1e-300)) break
    term *= (-x * x) / (n + 1)
  }
  return (2 / Math.sqrt(Math.PI)) * sum
}

/**
 * erfc(x) for x >= 0: Taylor series below 1.5 (no cancellation), then the
 * standard continued fraction erfc(x) = exp(-x^2)/sqrt(pi) / D(x) with
 * D = x + (1/2)/(x + 1/(x + (3/2)/(x + 2/(x + ...)))).
 */
function erfc(x) {
  if (x < 1.5) return 1 - erfSeries(x)
  let denominator = x
  for (let n = 200; n >= 1; n -= 1) denominator = x + (n / 2) / denominator
  return Math.exp(-x * x) / Math.sqrt(Math.PI) / denominator
}

/**
 * Upper-tail probability P(chi^2_df > x) for an integer df >= 1, from the
 * finite-sum survival formula. No gamma/beta functions are involved.
 */
function chiSquareUpperTail(x, df) {
  if (!Number.isInteger(df) || df < 1) throw new RangeError(`df must be a positive integer, got ${df}`)
  if (!(x > 0)) return 1
  const half = x / 2
  if (df % 2 === 0) {
    const terms = df / 2
    let term = 1
    let sum = 1
    for (let j = 1; j < terms; j += 1) {
      term *= half / j
      sum += term
    }
    return Math.exp(-half) * sum
  }
  const terms = (df - 1) / 2
  let term = Math.sqrt((2 * x) / Math.PI)
  let sum = 0
  for (let j = 1; j <= terms; j += 1) {
    sum += term
    term *= x / (2 * j + 1)
  }
  return erfc(Math.sqrt(half)) + Math.exp(-half) * sum
}

/** Published upper .05 critical values; the survival function must reproduce .05. */
function assertCriticalValues() {
  const table = [
    [1, 3.841459],
    [2, 5.991465],
    [3, 7.814728],
    [4, 9.487729],
    [5, 11.070498],
    [6, 12.591587],
    [7, 14.06714],
    [8, 15.507313],
    [9, 16.918978],
    [10, 18.307038],
    [11, 19.675138],
    [12, 21.02607],
  ]
  for (const [df, critical] of table) {
    const p = chiSquareUpperTail(critical, df)
    if (Math.abs(p - 0.05) > 5e-6) {
      throw new Error(`chi-square survival self-check failed at df=${df}: p=${p} for x=${critical}`)
    }
  }
  if (chiSquareUpperTail(0, 3) !== 1) throw new Error('chi-square survival must be 1 at x=0')
}

// ── closed-form pooling ─────────────────────────────────────────────────────

/** Resolve each study's SE exactly as the contract says: given, or from its symmetric CI. */
function resolveStandardError(study) {
  if (typeof study.se === 'number') return study.se
  return (study.ciHigh - study.ciLow) / (2 * Z_CRITICAL)
}

/** Closed-form inverse-variance pooling, DL tau^2, Q, I^2 and pQ. */
function computeExpected(studies) {
  const resolved = studies.map(study => ({ effect: study.effect, se: resolveStandardError(study) }))
  const k = resolved.length
  const df = k - 1
  const weights = resolved.map(study => 1 / (study.se * study.se))
  const sumW = weights.reduce((sum, weight) => sum + weight, 0)
  const sumW2 = weights.reduce((sum, weight) => sum + weight * weight, 0)

  let fixedEffect = 0
  for (let index = 0; index < k; index += 1) fixedEffect += weights[index] * resolved[index].effect
  fixedEffect /= sumW
  const fixedSe = Math.sqrt(1 / sumW)

  let Q = 0
  for (let index = 0; index < k; index += 1) {
    Q += weights[index] * (resolved[index].effect - fixedEffect) ** 2
  }
  const pQ = chiSquareUpperTail(Q, df)
  const I2 = Q === 0 ? 0 : Math.max(0, (Q - df) / Q)
  const tau2 = Math.max(0, (Q - df) / (sumW - sumW2 / sumW))

  const randomWeights = resolved.map(study => 1 / (study.se * study.se + tau2))
  const sumRandomWeight = randomWeights.reduce((sum, weight) => sum + weight, 0)
  let randomEffect = 0
  for (let index = 0; index < k; index += 1) randomEffect += randomWeights[index] * resolved[index].effect
  randomEffect /= sumRandomWeight
  const randomSe = Math.sqrt(1 / sumRandomWeight)

  const estimate = (effect, se) => ({
    effect,
    se,
    ciLow: effect - Z_CRITICAL * se,
    ciHigh: effect + Z_CRITICAL * se,
  })

  return {
    k,
    df,
    fixed: estimate(fixedEffect, fixedSe),
    random: estimate(randomEffect, randomSe),
    Q,
    pQ,
    I2,
    tau2,
    egger: k >= 10,
  }
}

// ── case design ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  'homogeneous',
  'medium-heterogeneity',
  'high-heterogeneity',
  'zero-effect',
  'negative-effect',
  'small-k',
]

const TAGS = [
  'k2',
  'k5',
  'k10',
  'k12',
  'equal-se',
  'unequal-se',
  'se-input',
  'ci-input',
  'mixed-input',
  'egger-run',
  'egger-boundary',
  'egger-not-run',
  'wide-narrow-weights',
  'small-k',
  'positive-effect',
  'negative-effect',
  'zero-effect',
  'sign-flip',
  'symmetric-effects',
  'q-zero',
  'i2-zero',
  'tau2-zero',
]

/**
 * Build one synthetic case. `inputs` is either one input style for every study
 * ('se' or 'ci') or an array selecting the style per study (mixed input).
 */
function makeCase({ id, category, description, tags, effects, ses, inputs }) {
  if (effects.length !== ses.length) throw new Error(`${id}: effects and ses differ in length`)
  const studies = effects.map((effect, index) => {
    const style = Array.isArray(inputs) ? inputs[index] : inputs
    const label = `Study ${String(index + 1).padStart(2, '0')}`
    if (style === 'ci') {
      return { label, effect, ciLow: effect - Z_CRITICAL * ses[index], ciHigh: effect + Z_CRITICAL * ses[index] }
    }
    if (style === 'se') return { label, effect, se: ses[index] }
    throw new Error(`${id}: unknown study input style ${String(style)}`)
  })
  return { id, category, description, tags, studies, expected: computeExpected(studies) }
}

const SPECS = [
  // ── homogeneous: I^2 = 0 and tau^2 = 0 ──────────────────────────────────
  {
    id: 'meta-0001',
    category: 'homogeneous',
    description: 'Five identical effects and SEs; Q = 0, so fixed and random pooling coincide with no heterogeneity.',
    tags: ['k5', 'equal-se', 'se-input', 'egger-not-run', 'positive-effect', 'q-zero', 'i2-zero', 'tau2-zero'],
    effects: [0.25, 0.25, 0.25, 0.25, 0.25],
    ses: [0.15, 0.15, 0.15, 0.15, 0.15],
    inputs: 'se',
  },
  {
    id: 'meta-0002',
    category: 'homogeneous',
    description: 'Five near-identical effects with a 25x SE range; Q stays below df, so I^2 = 0 and tau^2 = 0.',
    tags: ['k5', 'unequal-se', 'se-input', 'egger-not-run', 'wide-narrow-weights', 'positive-effect', 'i2-zero', 'tau2-zero'],
    effects: [0.3, 0.31, 0.29, 0.3, 0.305],
    ses: [0.05, 0.08, 0.12, 0.18, 0.25],
    inputs: 'se',
  },
  {
    id: 'meta-0003',
    category: 'homogeneous',
    description: 'The minimal k = 2 pool: two null effects with equal precision, so Q = 0 and the pooled effect is exactly zero.',
    tags: ['k2', 'equal-se', 'se-input', 'egger-not-run', 'zero-effect', 'q-zero', 'i2-zero', 'tau2-zero'],
    effects: [0, 0],
    ses: [0.12, 0.12],
    inputs: 'se',
  },
  {
    id: 'meta-0004',
    category: 'homogeneous',
    description: 'Ten CI-derived studies with a 5x SE range and near-identical effects; Q < df and Egger runs at the k = 10 boundary.',
    tags: ['k10', 'unequal-se', 'ci-input', 'egger-run', 'egger-boundary', 'wide-narrow-weights', 'positive-effect', 'i2-zero', 'tau2-zero'],
    effects: [0.18, 0.2, 0.22, 0.19, 0.21, 0.2, 0.23, 0.17, 0.21, 0.19],
    ses: [0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1, 0.12, 0.15, 0.2],
    inputs: 'ci',
  },
  {
    id: 'meta-0005',
    category: 'homogeneous',
    description: 'Twelve equal-precision studies with a small negative effect; Q < df, so the random-effects estimate equals the fixed one.',
    tags: ['k12', 'equal-se', 'se-input', 'egger-run', 'negative-effect', 'i2-zero', 'tau2-zero'],
    effects: [-0.16, -0.15, -0.14, -0.155, -0.145, -0.16, -0.15, -0.14, -0.155, -0.145, -0.15, -0.16],
    ses: [0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08],
    inputs: 'se',
  },

  // ── medium heterogeneity: Q > df and tau^2 > 0 ──────────────────────────
  {
    id: 'meta-0006',
    category: 'medium-heterogeneity',
    description: 'Five equal-precision studies spanning 0.10-0.50; Q = 10 with df = 4, so I^2 = 0.60 and DL tau^2 = 0.015.',
    tags: ['k5', 'equal-se', 'se-input', 'egger-not-run', 'positive-effect'],
    effects: [0.1, 0.2, 0.3, 0.4, 0.5],
    ses: [0.1, 0.1, 0.1, 0.1, 0.1],
    inputs: 'se',
  },
  {
    id: 'meta-0007',
    category: 'medium-heterogeneity',
    description: 'Five CI-derived studies with SEs from 0.05 to 0.25 and a 0.0-0.4 effect gradient; moderate heterogeneity.',
    tags: ['k5', 'unequal-se', 'ci-input', 'egger-not-run', 'wide-narrow-weights', 'positive-effect'],
    effects: [0, 0.1, 0.2, 0.3, 0.4],
    ses: [0.05, 0.1, 0.15, 0.2, 0.25],
    inputs: 'ci',
  },
  {
    id: 'meta-0008',
    category: 'medium-heterogeneity',
    description: 'Ten equal-precision studies with each of five effect levels repeated twice; Q = 20 with df = 9.',
    tags: ['k10', 'equal-se', 'se-input', 'egger-run', 'egger-boundary', 'positive-effect'],
    effects: [0.1, 0.2, 0.3, 0.4, 0.5, 0.1, 0.2, 0.3, 0.4, 0.5],
    ses: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
    inputs: 'se',
  },
  {
    id: 'meta-0009',
    category: 'medium-heterogeneity',
    description: 'Twelve studies with an effect gradient and increasing SEs; Q = 19.08, df = 11, I^2 = 0.42.',
    tags: ['k12', 'unequal-se', 'se-input', 'egger-run', 'wide-narrow-weights', 'positive-effect'],
    effects: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55],
    ses: [0.05, 0.07, 0.09, 0.11, 0.13, 0.15, 0.17, 0.19, 0.21, 0.23, 0.25, 0.27],
    inputs: 'se',
  },
  {
    id: 'meta-0010',
    category: 'medium-heterogeneity',
    description: 'Ten CI-derived studies with a graded effect and SEs from 0.05 to 0.23; Q = 13.74, df = 9, I^2 = 0.35.',
    tags: ['k10', 'unequal-se', 'ci-input', 'egger-run', 'egger-boundary', 'wide-narrow-weights', 'positive-effect'],
    effects: [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55],
    ses: [0.05, 0.07, 0.09, 0.11, 0.13, 0.15, 0.17, 0.19, 0.21, 0.23],
    inputs: 'ci',
  },

  // ── high heterogeneity: I^2 well above 0.75 ──────────────────────────────
  {
    id: 'meta-0011',
    category: 'high-heterogeneity',
    description: 'Ten equal-precision studies spread from -0.8 to 1.0; Q = 330, I^2 = 0.97, tau^2 = 0.36.',
    tags: ['k10', 'equal-se', 'se-input', 'egger-run', 'egger-boundary', 'positive-effect'],
    effects: [-0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1],
    ses: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
    inputs: 'se',
  },
  {
    id: 'meta-0012',
    category: 'high-heterogeneity',
    description: 'Ten CI-derived studies with SEs from 0.04 to 0.22 and a wide effect range; the fixed estimate is negative while the random estimate is positive.',
    tags: ['k10', 'unequal-se', 'ci-input', 'egger-run', 'egger-boundary', 'wide-narrow-weights', 'sign-flip'],
    effects: [-0.6, -0.45, -0.3, -0.15, 0, 0.15, 0.3, 0.45, 0.6, 0.75],
    ses: [0.04, 0.06, 0.08, 0.1, 0.12, 0.14, 0.16, 0.18, 0.2, 0.22],
    inputs: 'ci',
  },
  {
    id: 'meta-0013',
    category: 'high-heterogeneity',
    description: 'Twelve equal-precision studies on a strong effect gradient; I^2 = 0.95 and tau^2 = 0.28.',
    tags: ['k12', 'equal-se', 'se-input', 'egger-run', 'positive-effect'],
    effects: [-0.7, -0.55, -0.4, -0.25, -0.1, 0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95],
    ses: [0.12, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12],
    inputs: 'se',
  },
  {
    id: 'meta-0014',
    category: 'high-heterogeneity',
    description: 'Twelve studies with SEs from 0.05 to 0.27 and a wide effect range; I^2 = 0.95 and the fixed estimate is negative while the random estimate is near zero.',
    tags: ['k12', 'unequal-se', 'se-input', 'egger-run', 'wide-narrow-weights', 'sign-flip'],
    effects: [-0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1, -0.5, 0.5],
    ses: [0.05, 0.07, 0.09, 0.11, 0.13, 0.15, 0.17, 0.19, 0.21, 0.23, 0.25, 0.27],
    inputs: 'se',
  },

  // ── zero effect ──────────────────────────────────────────────────────────
  {
    id: 'meta-0015',
    category: 'zero-effect',
    description: 'Twelve CI-derived studies in six symmetric +/- pairs; both pooled estimates are zero and heterogeneity is high.',
    tags: ['k12', 'unequal-se', 'ci-input', 'egger-run', 'wide-narrow-weights', 'zero-effect', 'symmetric-effects'],
    effects: [-0.2, 0.2, -0.3, 0.3, -0.4, 0.4, -0.5, 0.5, -0.6, 0.6, -0.7, 0.7],
    ses: [0.05, 0.05, 0.08, 0.08, 0.12, 0.12, 0.16, 0.16, 0.2, 0.2, 0.25, 0.25],
    inputs: 'ci',
  },
  {
    id: 'meta-0016',
    category: 'zero-effect',
    description: 'Five equal-precision studies symmetric around zero; the pooled effect is zero with Q = 40 and I^2 = 0.90.',
    tags: ['k5', 'equal-se', 'se-input', 'egger-not-run', 'zero-effect', 'symmetric-effects'],
    effects: [-0.4, -0.2, 0, 0.2, 0.4],
    ses: [0.1, 0.1, 0.1, 0.1, 0.1],
    inputs: 'se',
  },

  // ── negative effect ──────────────────────────────────────────────────────
  {
    id: 'meta-0017',
    category: 'negative-effect',
    description: 'Ten studies with mixed SE and CI inputs around -0.35; Q = 20 with df = 9 and Egger runs at k = 10.',
    tags: ['k10', 'equal-se', 'mixed-input', 'egger-run', 'egger-boundary', 'negative-effect'],
    effects: [-0.55, -0.45, -0.35, -0.25, -0.15, -0.55, -0.45, -0.35, -0.25, -0.15],
    ses: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
    inputs: ['se', 'ci', 'se', 'ci', 'se', 'ci', 'se', 'ci', 'se', 'ci'],
  },
  {
    id: 'meta-0018',
    category: 'negative-effect',
    description: 'Two unequal-precision studies with negative effects; k = 2 and Q = 3.2 > df, so a random-effects estimate is reported.',
    tags: ['k2', 'unequal-se', 'se-input', 'egger-not-run', 'negative-effect'],
    effects: [-0.4, -0.2],
    ses: [0.1, 0.05],
    inputs: 'se',
  },

  // ── k = 2 boundary ───────────────────────────────────────────────────────
  {
    id: 'meta-0019',
    category: 'small-k',
    description: 'Two equal-precision studies with different effects; Q = 2, I^2 = 0.50, and no Egger test because k < 10.',
    tags: ['k2', 'equal-se', 'se-input', 'egger-not-run', 'small-k', 'positive-effect'],
    effects: [0.1, 0.5],
    ses: [0.2, 0.2],
    inputs: 'se',
  },
  {
    id: 'meta-0020',
    category: 'small-k',
    description: 'Two CI-derived studies with a 9x weight ratio; k = 2, Q = 3.6, I^2 = 0.72, and no Egger test.',
    tags: ['k2', 'unequal-se', 'ci-input', 'egger-not-run', 'small-k', 'wide-narrow-weights', 'positive-effect'],
    effects: [0.2, 0.8],
    ses: [0.1, 0.3],
    inputs: 'ci',
  },
]

// ── assemble, assert coverage, write ────────────────────────────────────────

assertCriticalValues()

const cases = SPECS.map(makeCase)

function check(condition, message) {
  if (!condition) throw new Error(`generate-meta: ${message}`)
}

check(cases.length === TOTAL_CASES, `expected ${TOTAL_CASES} cases, built ${cases.length}`)
for (const [index, item] of cases.entries()) {
  check(item.id === `meta-${String(index + 1).padStart(4, '0')}`, `case ${index + 1} has id ${item.id}`)
  check(CATEGORIES.includes(item.category), `${item.id}: unknown category ${item.category}`)
  check(item.tags.length === new Set(item.tags).size, `${item.id}: duplicate tag`)
  for (const tag of item.tags) check(TAGS.includes(tag), `${item.id}: unknown tag ${tag}`)
  check(item.tags.filter(tag => /^k\d+$/u.test(tag)).length === 1, `${item.id}: exactly one k tag is required`)
  check(item.tags.includes(`k${item.expected.k}`), `${item.id}: k tag disagrees with the study count`)
  check(item.tags.some(tag => tag === 'equal-se' || tag === 'unequal-se'), `${item.id}: missing an SE-structure tag`)
  check(item.tags.some(tag => tag === 'se-input' || tag === 'ci-input' || tag === 'mixed-input'), `${item.id}: missing an input tag`)
  check(item.expected.df === item.expected.k - 1, `${item.id}: df is not k - 1`)
  check(item.expected.egger === (item.expected.k >= 10), `${item.id}: Egger flag disagrees with k`)
  check(item.expected.Q >= 0 && item.expected.I2 >= 0 && item.expected.I2 <= 1 && item.expected.tau2 >= 0, `${item.id}: negative heterogeneity`)
}

for (const category of CATEGORIES) check(cases.some(item => item.category === category), `category ${category} is not covered`)
for (const k of [2, 5, 10, 12]) check(cases.some(item => item.expected.k === k), `k = ${k} is not covered`)
for (const structure of ['equal', 'unequal']) check(cases.some(item => item.tags.includes(`${structure}-se`)), `${structure} SEs are not covered`)
for (const input of ['se', 'ci', 'mixed']) check(cases.some(item => item.tags.includes(`${input}-input`)), `${input} input is not covered`)
check(cases.some(item => item.tags.includes('egger-boundary')), 'the k = 10 Egger boundary is not covered')
check(cases.some(item => item.expected.egger && item.expected.k === 12), 'a k = 12 Egger case is not covered')
check(cases.some(item => !item.expected.egger), 'an Egger-not-run case is not covered')
check(cases.some(item => item.expected.tau2 === 0 && item.expected.I2 === 0), 'a tau^2 = 0 / I^2 = 0 case is not covered')

const countBy = (items, pick) => {
  const counts = {}
  for (const item of items) {
    const key = pick(item)
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

const byCategory = Object.fromEntries(CATEGORIES.map(category => [category, 0]))
for (const item of cases) byCategory[item.category] += 1

const byK = { 2: 0, 5: 0, 10: 0, 12: 0 }
for (const item of cases) byK[item.expected.k] += 1

const byTag = Object.fromEntries(TAGS.map(tag => [tag, 0]))
for (const item of cases) for (const tag of item.tags) byTag[tag] += 1

const bySeStructure = {
  equal: cases.filter(item => item.tags.includes('equal-se')).length,
  unequal: cases.filter(item => item.tags.includes('unequal-se')).length,
}
const byInput = {
  se: cases.filter(item => item.tags.includes('se-input')).length,
  ci: cases.filter(item => item.tags.includes('ci-input')).length,
  mixed: cases.filter(item => item.tags.includes('mixed-input')).length,
}
const eggerCases = cases.filter(item => item.expected.egger)
const eggerBoundary = cases.filter(item => item.tags.includes('egger-boundary'))

const summary = {
  dataset: 'meta',
  version: VERSION,
  total: cases.length,
  synthetic: true,
  confidenceLevel: CONFIDENCE_LEVEL,
  zCritical: Z_CRITICAL,
  byCategory,
  byK,
  bySeStructure,
  byInput,
  egger: {
    run: eggerCases.length,
    notRun: cases.length - eggerCases.length,
    boundaryK: 10,
    boundaryCases: eggerBoundary.length,
  },
  byTag,
  labelSpace: {
    category: CATEGORIES,
    k: [2, 5, 10, 12],
    seStructure: ['equal', 'unequal'],
    input: ['se', 'ci', 'mixed'],
    tag: TAGS,
  },
  groundTruth:
    'closed-form inverse-variance pooling and DerSimonian-Laird tau^2 computed by the generator itself (no plugin import, no plugin output); ' +
    'pQ from the finite-sum chi-square survival formula for integer df; CIs use z = 1.959963984540054.',
  caseSchema: 'schema.json',
}

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://raw.githubusercontent.com/PerryLink/dsh-research-bench/main/data/meta/schema.json',
  title: 'Synthetic meta-analysis pooling benchmark case',
  type: 'object',
  additionalProperties: false,
  required: ['id', 'category', 'description', 'tags', 'studies', 'expected'],
  properties: {
    id: { type: 'string', pattern: '^meta-[0-9]{4}$' },
    category: { enum: CATEGORIES },
    description: { type: 'string', minLength: 1, maxLength: 400 },
    tags: {
      type: 'array',
      minItems: 3,
      maxItems: TAGS.length,
      uniqueItems: true,
      items: { enum: TAGS },
    },
    studies: {
      type: 'array',
      minItems: 2,
      maxItems: 12,
      items: { $ref: '#/$defs/study' },
    },
    expected: {
      type: 'object',
      additionalProperties: false,
      required: ['k', 'df', 'fixed', 'random', 'Q', 'pQ', 'I2', 'tau2', 'egger'],
      properties: {
        k: { type: 'integer', minimum: 2, maximum: 12 },
        df: { type: 'integer', minimum: 1, maximum: 11 },
        fixed: { $ref: '#/$defs/estimate' },
        random: { $ref: '#/$defs/estimate' },
        Q: { type: 'number', minimum: 0 },
        pQ: { type: 'number', minimum: 0, maximum: 1 },
        I2: { type: 'number', minimum: 0, maximum: 1 },
        tau2: { type: 'number', minimum: 0 },
        egger: { type: 'boolean' },
      },
    },
  },
  $defs: {
    study: {
      type: 'object',
      additionalProperties: false,
      required: ['label', 'effect'],
      properties: {
        label: { type: 'string', minLength: 1 },
        effect: { type: 'number' },
        se: { type: 'number', exclusiveMinimum: 0 },
        ciLow: { type: 'number' },
        ciHigh: { type: 'number' },
      },
      oneOf: [
        {
          required: ['se'],
          not: { anyOf: [{ required: ['ciLow'] }, { required: ['ciHigh'] }] },
        },
        {
          required: ['ciLow', 'ciHigh'],
          not: { required: ['se'] },
        },
      ],
    },
    estimate: {
      type: 'object',
      additionalProperties: false,
      required: ['effect', 'se', 'ciLow', 'ciHigh'],
      properties: {
        effect: { type: 'number' },
        se: { type: 'number', exclusiveMinimum: 0 },
        ciLow: { type: 'number' },
        ciHigh: { type: 'number' },
      },
    },
  },
}

writeFileSync(path.join(outDir, 'cases.jsonl'), `${cases.map(item => JSON.stringify(item)).join('\n')}\n`, 'utf8')
writeFileSync(path.join(outDir, 'SUMMARY.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
writeFileSync(path.join(outDir, 'schema.json'), `${JSON.stringify(schema, null, 2)}\n`, 'utf8')

console.log(`meta: ${cases.length} cases -> data/meta/cases.jsonl`)
console.log(`categories: ${JSON.stringify(byCategory)}`)
console.log(`k: ${JSON.stringify(byK)}; SEs: ${JSON.stringify(bySeStructure)}; input: ${JSON.stringify(byInput)}; Egger run: ${eggerCases.length}`)
