// Deterministic synthetic reproducibility-audit benchmark generator.
//
// Every case is a *recipe*, not a fixture: a relative-path -> UTF-8 content map
// plus a git mode and a post-manifest drift operation. The adapter
// (dsh-repro-audit/bench/run-repro.mjs) materialises the recipe in a fresh
// temporary directory, records a manifest, applies the drift, and checks it.
//
// Ground truth is hand-authored from the plugin's documented gap rules and from
// the recipe itself. This script does not import dsh-repro-audit, never reads
// plugin output, and writes no timestamps: two runs are byte-identical.
//
// The git modes are part of the recipe contract:
//   none               no repository at all
//   commit             init + add + commit; clean worktree at manifest time
//   dirty              commit, then add an untracked notes.txt; worktree dirty
//   commit-then-modify commit, then append a comment to the tracked analysis.py
//
// Drift is applied only after the manifest has been recorded:
//   none               leave the tree alone
//   modify:<path>      append one LF to the recorded file (keeps JSON/CSV valid)
//   delete:<path>      remove the recorded file
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'data', 'repro')
mkdirSync(outDir, { recursive: true })

const VERSION = '0.1.0'
const TOTAL_CASES = 10

// The label space matches the gap codes documented by dsh-repro-audit. A case
// only ever uses the six codes listed in `gapCodesExercised`, but the schema
// accepts every code the scanner can emit.
const GAP_CODES = [
  'no_git_commit',
  'dirty_worktree',
  'no_lockfile',
  'no_run_command',
  'no_seed',
  'no_data',
  'no_environment',
  'unhashed_data',
  'no_figures',
  'scan_truncated',
]
const GAP_ORDER = new Map(GAP_CODES.map((code, index) => [code, index]))
const ERROR_CODES = new Set(['no_git_commit', 'no_lockfile', 'no_run_command'])
const WARNING_CODES = new Set([
  'dirty_worktree',
  'no_seed',
  'no_data',
  'no_environment',
  'unhashed_data',
  'scan_truncated',
])
const LEVELS = ['reproducible', 'partial', 'not_reproducible']
const GIT_MODES = ['none', 'commit', 'dirty', 'commit-then-modify']
const CATEGORIES = ['complete', 'evidence-gap', 'runtime-gap', 'git-gap', 'drift']

// ── fixture content ─────────────────────────────────────────────────────────

const PACKAGE_JSON = `${JSON.stringify(
  {
    name: 'repro-fixture',
    version: '0.0.0',
    private: true,
    scripts: { analyze: 'python analysis.py' },
  },
  null,
  2,
)}\n`

const PACKAGE_LOCK = `${JSON.stringify(
  {
    name: 'repro-fixture',
    version: '0.0.0',
    lockfileVersion: 3,
    requires: true,
    packages: {},
  },
  null,
  2,
)}\n`

const PYTHON_VERSION = '3.12\n'
const REQUIREMENTS = 'numpy==2.1.0\n'
const NODE_VERSION = '24\n'

const SEEDED_ANALYSIS = [
  'import numpy as np',
  '',
  'np.random.seed(42)',
  'values = np.array([1.0, 2.0, 3.0])',
  'print(values.mean())',
  '',
].join('\n')

const UNSEEDED_ANALYSIS = [
  'values = [1.0, 2.0, 3.0]',
  'print(sum(values) / len(values))',
  '',
].join('\n')

const INPUT_CSV = ['id,value', '1,2', '2,3', '3,5', ''].join('\n')

const FIGURE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">' +
  '<rect width="10" height="10" fill="#333333"/></svg>\n'

/** The complete, gap-free project used as the base of most recipes. */
const COMPLETE_FILES = {
  'package.json': PACKAGE_JSON,
  'package-lock.json': PACKAGE_LOCK,
  '.nvmrc': NODE_VERSION,
  'analysis.py': SEEDED_ANALYSIS,
  'data/input.csv': INPUT_CSV,
  'figures/fig1.svg': FIGURE_SVG,
}

/** Sort file keys so committed JSONL is byte-stable. */
function sortRecord(record) {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)))
}

/** Build a complete project with per-case overrides and omissions. */
function completeFiles(overrides = {}, omit = []) {
  const files = { ...COMPLETE_FILES, ...overrides }
  for (const key of omit) delete files[key]
  return sortRecord(files)
}

/** Sort expected gap codes into the scanner's documented order. */
function sortGaps(codes) {
  return [...new Set(codes)].sort((left, right) => GAP_ORDER.get(left) - GAP_ORDER.get(right))
}

/** The level implied by a gap-code set, using the documented severities. */
function levelForGaps(codes) {
  if (codes.some(code => ERROR_CODES.has(code))) return 'not_reproducible'
  if (codes.some(code => WARNING_CODES.has(code))) return 'partial'
  return 'reproducible'
}

/** Build the drift string expected by the adapter. */
function driftOf(operation, target) {
  return operation === 'none' ? 'none' : `${operation}:${target}`
}

// ── case design ─────────────────────────────────────────────────────────────

const CASES = [
  {
    id: 'repro-0001',
    category: 'complete',
    description:
      'A complete committed Python project: package.json entry point, lockfile, runtime pin, seed, input CSV and an SVG figure; the worktree is clean.',
    files: completeFiles(),
    git: 'commit',
    expected: { level: 'reproducible', gaps: [] },
    drift: driftOf('none'),
  },
  {
    id: 'repro-0002',
    category: 'evidence-gap',
    description:
      'The analysis script has no seed literal, and a tracked edit after the commit leaves the worktree dirty; both warnings must be reported.',
    files: completeFiles({ 'analysis.py': UNSEEDED_ANALYSIS }),
    git: 'commit-then-modify',
    expected: { level: 'partial', gaps: ['dirty_worktree', 'no_seed'] },
    drift: driftOf('none'),
  },
  {
    id: 'repro-0003',
    category: 'evidence-gap',
    description:
      'A complete project with package-lock.json removed; the missing dependency lock must be an error even though every other signal is present.',
    files: completeFiles({}, ['package-lock.json']),
    git: 'commit',
    expected: { level: 'not_reproducible', gaps: ['no_lockfile'] },
    drift: driftOf('none'),
  },
  {
    id: 'repro-0004',
    category: 'git-gap',
    description:
      'The same complete project without a git repository; only the missing commit hash is an error, because a project outside git has no worktree state to compare.',
    files: completeFiles(),
    git: 'none',
    expected: { level: 'not_reproducible', gaps: ['no_git_commit'] },
    drift: driftOf('none'),
  },
  {
    id: 'repro-0005',
    category: 'git-gap',
    description:
      'Everything is present and committed, then an untracked notes file is added; the worktree is dirty and the recorded commit does not describe every file.',
    files: completeFiles(),
    git: 'dirty',
    expected: { level: 'partial', gaps: ['dirty_worktree'] },
    drift: driftOf('none'),
  },
  {
    id: 'repro-0006',
    category: 'runtime-gap',
    description:
      'A Python-only fixture with a requirements.txt lock, runtime pin, seed, data and figure, but no package.json script, Makefile target or run/reproduce/analysis entry script.',
    files: sortRecord({
      '.python-version': PYTHON_VERSION,
      'requirements.txt': REQUIREMENTS,
      'model.py': SEEDED_ANALYSIS,
      'data/input.csv': INPUT_CSV,
      'figures/fig1.svg': FIGURE_SVG,
    }),
    git: 'commit',
    expected: { level: 'not_reproducible', gaps: ['no_run_command'] },
    drift: driftOf('none'),
  },
  {
    id: 'repro-0007',
    category: 'runtime-gap',
    description:
      'A complete project with .nvmrc removed; there is no environment file and no runtime pin, but every other reproducibility signal is present.',
    files: completeFiles({}, ['.nvmrc']),
    git: 'commit',
    expected: { level: 'partial', gaps: ['no_environment'] },
    drift: driftOf('none'),
  },
  {
    id: 'repro-0008',
    category: 'drift',
    description:
      'A complete clean project; after the manifest is recorded one LF is appended to data/input.csv. The drift check must report a changed data artifact.',
    files: completeFiles(),
    git: 'commit',
    expected: { level: 'reproducible', gaps: [] },
    drift: driftOf('modify', 'data/input.csv'),
  },
  {
    id: 'repro-0009',
    category: 'drift',
    description:
      'A complete clean project; after the manifest is recorded data/input.csv is deleted. The drift check must report a missing data artifact.',
    files: completeFiles(),
    git: 'commit',
    expected: { level: 'reproducible', gaps: [] },
    drift: driftOf('delete', 'data/input.csv'),
  },
  {
    id: 'repro-0010',
    category: 'drift',
    description:
      'A complete clean project; after the manifest is recorded one LF is appended to package-lock.json. The drift check must report a changed dependency lockfile.',
    files: completeFiles(),
    git: 'commit',
    expected: { level: 'reproducible', gaps: [] },
    drift: driftOf('modify', 'package-lock.json'),
  },
]

// ── assemble, assert the recipe contract, write ─────────────────────────────

function check(condition, message) {
  if (!condition) throw new Error(`generate-repro: ${message}`)
}

/** A relative POSIX path that cannot escape the fixture project. */
function isSafeRelative(value) {
  if (typeof value !== 'string' || value === '' || value.includes('\\')) return false
  if (path.posix.isAbsolute(value)) return false
  const segments = value.split('/')
  return segments.every(segment => segment !== '' && segment !== '.' && segment !== '..')
}

/** Split a drift value and validate its shape. */
function parseDrift(value) {
  if (value === 'none') return { operation: 'none', target: null }
  const separator = value.indexOf(':')
  if (separator < 0) return { operation: value, target: null }
  return { operation: value.slice(0, separator), target: value.slice(separator + 1) }
}

check(CASES.length === TOTAL_CASES, `expected ${TOTAL_CASES} cases, built ${CASES.length}`)

const ids = new Set()
for (const [index, item] of CASES.entries()) {
  const where = item.id ?? `case ${index + 1}`
  check(item.id === `repro-${String(index + 1).padStart(4, '0')}`, `${where}: id is not the sequential case id`)
  check(!ids.has(item.id), `${where}: duplicate id`)
  ids.add(item.id)
  check(CATEGORIES.includes(item.category), `${where}: unknown category ${item.category}`)
  check(typeof item.description === 'string' && item.description.length > 0, `${where}: description is empty`)
  check(GIT_MODES.includes(item.git), `${where}: unknown git mode ${item.git}`)
  check(LEVELS.includes(item.expected.level), `${where}: unknown expected level ${item.expected.level}`)
  check(Array.isArray(item.expected.gaps), `${where}: expected.gaps is not an array`)
  check(item.expected.gaps.every(code => GAP_CODES.includes(code)), `${where}: unknown gap code`)
  check(new Set(item.expected.gaps).size === item.expected.gaps.length, `${where}: duplicate gap code`)

  check(Object.keys(item.files).length > 0, `${where}: no files`)
  for (const [relative, content] of Object.entries(item.files)) {
    check(isSafeRelative(relative), `${where}: unsafe relative path ${JSON.stringify(relative)}`)
    check(!relative.split('/').includes('.git'), `${where}: recipe must not ship .git contents`)
    check(relative.split('/')[0] !== '.repro-audit', `${where}: recipe must not ship the record store`)
    check(typeof content === 'string' && content.length > 0, `${where}: file ${relative} is empty or not a string`)
  }

  const drift = parseDrift(item.drift)
  check(drift.operation === 'none' || drift.operation === 'modify' || drift.operation === 'delete', `${where}: unknown drift operation`)
  if (drift.operation === 'none') {
    check(item.drift === 'none', `${where}: malformed drift value ${item.drift}`)
  } else {
    check(drift.target !== null && isSafeRelative(drift.target), `${where}: unsafe drift target`)
    check(item.files[drift.target] !== undefined, `${where}: drift target ${drift.target} is not a recipe file`)
  }

  if (item.git === 'none') {
    check(item.expected.gaps.includes('no_git_commit'), `${where}: git none must expect no_git_commit`)
  } else {
    check(!item.expected.gaps.includes('no_git_commit'), `${where}: a committed fixture must not expect no_git_commit`)
  }
  if (item.git === 'dirty' || item.git === 'commit-then-modify') {
    check(item.expected.gaps.includes('dirty_worktree'), `${where}: a dirty fixture must expect dirty_worktree`)
  } else {
    check(!item.expected.gaps.includes('dirty_worktree'), `${where}: a clean fixture must not expect dirty_worktree`)
  }
  if (item.git === 'commit-then-modify') check(item.files['analysis.py'] !== undefined, `${where}: commit-then-modify needs analysis.py`)
  if (item.git === 'dirty') check(item.files['notes.txt'] === undefined, `${where}: dirty adds notes.txt itself`)

  check(levelForGaps(item.expected.gaps) === item.expected.level, `${where}: expected level disagrees with gap severities`)
}

const countBy = (items, pick) => {
  const counts = {}
  for (const item of items) {
    const key = pick(item)
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

// Required scenario coverage. These assertions are deliberately explicit: a
// future edit that silently drops a scenario fails generation.
check(CASES.filter(item => item.expected.gaps.length === 0 && item.drift === 'none').length === 1, 'exactly one gap-free, drift-free case is required')
check(CASES.some(item => item.expected.gaps.includes('no_seed')), 'a missing-seed case is required')
check(CASES.some(item => item.expected.gaps.includes('no_lockfile')), 'a missing-lockfile case is required')
check(CASES.some(item => item.git === 'none' && item.expected.gaps.includes('no_git_commit')), 'a no-git case is required')
check(CASES.some(item => item.expected.gaps.includes('dirty_worktree') && item.git === 'dirty'), 'a dirty-worktree case is required')
check(CASES.some(item => item.expected.gaps.includes('no_run_command')), 'a no-run-command case is required')
check(CASES.some(item => item.expected.gaps.includes('no_environment')), 'a no-environment-pin case is required')
check(CASES.some(item => item.drift === 'modify:data/input.csv'), 'a recorded-data-modified case is required')
check(CASES.some(item => item.drift === 'delete:data/input.csv'), 'a recorded-data-deleted case is required')
check(CASES.some(item => item.drift === 'modify:package-lock.json'), 'a recorded-lockfile-modified case is required')
check(CASES.filter(item => item.drift !== 'none').length === 3, 'exactly three drift cases are required')
for (const mode of GIT_MODES) check(CASES.some(item => item.git === mode), `git mode ${mode} is not covered`)

const levelCounts = Object.fromEntries(LEVELS.map(level => [level, 0]))
for (const item of CASES) levelCounts[item.expected.level] += 1
const byCategory = Object.fromEntries(CATEGORIES.map(category => [category, 0]))
for (const item of CASES) byCategory[item.category] += 1
for (const [category, count] of Object.entries(byCategory)) check(count > 0, `category ${category} is not covered`)

const byGit = Object.fromEntries(GIT_MODES.map(mode => [mode, 0]))
for (const item of CASES) byGit[item.git] += 1

const byDrift = { none: 0, modify: 0, delete: 0 }
for (const item of CASES) byDrift[parseDrift(item.drift).operation] += 1

const gapCodesExercised = [...new Set(CASES.flatMap(item => item.expected.gaps))].sort(
  (left, right) => GAP_ORDER.get(left) - GAP_ORDER.get(right),
)

const summary = {
  dataset: 'repro',
  version: VERSION,
  total: CASES.length,
  synthetic: true,
  byCategory,
  byLevel: levelCounts,
  byGit,
  byDrift,
  gapCodesExercised,
  labelSpace: {
    category: CATEGORIES,
    level: LEVELS,
    git: GIT_MODES,
    drift: ['none', 'modify', 'delete'],
    gap: GAP_CODES,
  },
  groundTruth:
    'Hand-authored from each recipe and the scanner\'s documented gap rules; the generator does not import dsh-repro-audit and never fits an expected value to plugin output. ' +
    'The expected level is the level at manifest-record time; drift is scored separately by the adapter.',
  caseSchema: 'schema.json',
}

// JSON Schema 2020-12. The allOf rules keep the hand-authored labels internally
// consistent (git state vs. no_git_commit/dirty_worktree, gap severity vs. level).
const errorGapEnum = GAP_CODES.filter(code => ERROR_CODES.has(code))
const warningGapEnum = GAP_CODES.filter(code => WARNING_CODES.has(code))

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://raw.githubusercontent.com/PerryLink/dsh-research-bench/main/data/repro/schema.json',
  title: 'Synthetic reproducibility-audit benchmark case',
  description:
    'One line of data/repro/cases.jsonl. `files` is the initial tree written before the git mode is applied; `git` then commits it and, for dirty/commit-then-modify, adds the uncommitted change. `drift` is applied after the manifest is recorded. Paths are POSIX-relative and must stay inside the fixture project.',
  type: 'object',
  additionalProperties: false,
  required: ['id', 'category', 'description', 'files', 'git', 'expected', 'drift'],
  properties: {
    id: { type: 'string', pattern: '^repro-[0-9]{4}$' },
    category: { enum: CATEGORIES },
    description: { type: 'string', minLength: 1, maxLength: 500 },
    files: {
      type: 'object',
      minProperties: 1,
      propertyNames: { pattern: '^[^/\\\\][^\\\\]*$' },
      additionalProperties: { type: 'string', minLength: 1 },
    },
    git: {
      enum: GIT_MODES,
      description:
        'none: no repository. commit: init/add/commit, clean. dirty: commit then add an untracked notes.txt. commit-then-modify: commit then append a comment to the tracked analysis.py.',
    },
    expected: {
      type: 'object',
      additionalProperties: false,
      required: ['level', 'gaps'],
      properties: {
        level: { enum: LEVELS },
        gaps: { type: 'array', uniqueItems: true, items: { enum: GAP_CODES } },
      },
    },
    drift: {
      type: 'string',
      pattern: '^(none|(modify|delete):[A-Za-z0-9._/-]+)$',
      description:
        'Applied after the manifest. modify appends one LF to the recorded file; delete removes it.',
    },
  },
  allOf: [
    {
      if: { properties: { git: { const: 'none' } }, required: ['git'] },
      then: { properties: { expected: { properties: { gaps: { contains: { const: 'no_git_commit' } } } } } },
    },
    {
      if: { properties: { git: { enum: ['commit', 'dirty', 'commit-then-modify'] } }, required: ['git'] },
      then: { properties: { expected: { properties: { gaps: { not: { contains: { const: 'no_git_commit' } } } } } } },
    },
    {
      if: { properties: { git: { enum: ['dirty', 'commit-then-modify'] } }, required: ['git'] },
      then: { properties: { expected: { properties: { gaps: { contains: { const: 'dirty_worktree' } } } } } },
    },
    {
      if: { properties: { git: { enum: ['none', 'commit'] } }, required: ['git'] },
      then: { properties: { expected: { properties: { gaps: { not: { contains: { const: 'dirty_worktree' } } } } } } },
    },
    {
      if: {
        properties: {
          expected: {
            properties: { gaps: { contains: { enum: errorGapEnum } } },
            required: ['gaps'],
          },
        },
        required: ['expected'],
      },
      then: { properties: { expected: { properties: { level: { const: 'not_reproducible' } } } } },
    },
    {
      if: {
        properties: {
          expected: {
            properties: { gaps: { contains: { enum: warningGapEnum } } },
            required: ['gaps'],
          },
        },
        required: ['expected'],
      },
      then: { properties: { expected: { properties: { level: { enum: ['partial', 'not_reproducible'] } } } } },
    },
    {
      if: {
        properties: {
          expected: {
            properties: { gaps: { not: { contains: { enum: [...errorGapEnum, ...warningGapEnum] } } } },
            required: ['gaps'],
          },
        },
        required: ['expected'],
      },
      then: { properties: { expected: { properties: { level: { const: 'reproducible' } } } } },
    },
  ],
}

const cases = CASES.map(item => ({
  id: item.id,
  category: item.category,
  description: item.description,
  files: item.files,
  git: item.git,
  expected: { level: item.expected.level, gaps: sortGaps(item.expected.gaps) },
  drift: item.drift,
}))

writeFileSync(path.join(outDir, 'cases.jsonl'), `${cases.map(item => JSON.stringify(item)).join('\n')}\n`, 'utf8')
writeFileSync(path.join(outDir, 'SUMMARY.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
writeFileSync(path.join(outDir, 'schema.json'), `${JSON.stringify(schema, null, 2)}\n`, 'utf8')

console.log(`repro: ${cases.length} cases -> data/repro/cases.jsonl`)
console.log(`categories: ${JSON.stringify(byCategory)}`)
console.log(`levels: ${JSON.stringify(levelCounts)}; git: ${JSON.stringify(byGit)}; drift: ${JSON.stringify(byDrift)}`)
console.log(`gap codes exercised: ${gapCodesExercised.join(', ')}`)
