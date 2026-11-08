// Validate the committed benchmark data: structure, counts, label space,
// summary agreement and the cross-field label rules. Deterministic; no deps.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fail = message => {
  console.error(`validate: ${message}`)
  process.exit(1)
}

const readJson = file => {
  try {
    return JSON.parse(readFileSync(path.join(root, file), 'utf8'))
  } catch (error) {
    fail(`${file}: ${error.message}`)
  }
}

const readJsonl = file => {
  let text
  try {
    text = readFileSync(path.join(root, file), 'utf8')
  } catch (error) {
    fail(`${file}: ${error.message}`)
  }
  return text
    .split('\n')
    .filter(line => line.trim() !== '')
    .map((line, index) => {
      try {
        const value = JSON.parse(line)
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          fail(`${file}:${index + 1}: each line must be a JSON object`)
        }
        return value
      } catch (error) {
        fail(`${file}:${index + 1}: ${error.message}`)
      }
    })
}

/** Compare two count maps after sorting keys, so key order is irrelevant. */
const sameCounts = (left, right) => {
  const entries = value => Object.entries(value ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return JSON.stringify(entries(left)) === JSON.stringify(entries(right))
}

const sameSet = (left, right) =>
  [...left].sort().join('\u0000') === [...right].sort().join('\u0000')

const assertSummary = (file, summary, expected) => {
  if (summary.dataset !== expected.dataset) fail(`${file}: wrong dataset name ${String(summary.dataset)}`)
  if (summary.version !== '0.1.0') fail(`${file}: wrong dataset version ${String(summary.version)}`)
  if (summary.synthetic !== true) fail(`${file}: summary must declare synthetic: true`)
  if (summary.total !== expected.total) fail(`${file}: SUMMARY.total is ${String(summary.total)}, expected ${expected.total}`)
  for (const [key, expectedValue] of Object.entries(expected.counts)) {
    if (!sameCounts(summary[key], expectedValue)) {
      fail(`${file}: SUMMARY.${key} disagrees with the committed cases`)
    }
  }
}

const CITATION_CATEGORIES = ['correct', 'wrong-author', 'wrong-year', 'wrong-doi', 'retracted', 'correction', 'preprint', 'disagreement']
const FIELDS = ['title', 'authors', 'year', 'venue', 'pages', 'version']
const VERDICTS = ['verified', 'unverified', 'insufficient', 'contradicted', 'disproven']
const STAT_ISSUES = ['p-value', 'p-threshold', 'ci', 'format', 'df']
const CLAIM_CATEGORIES = {
  supported: 'verified',
  paraphrase: 'insufficient',
  'number-wrong': 'disproven',
  negated: 'contradicted',
  'quote-mined': 'contradicted',
  insufficient: 'insufficient',
}

// ── citations ───────────────────────────────────────────────────────────────
const expectedCitationCounts = {
  correct: 30,
  'wrong-author': 20,
  'wrong-year': 15,
  'wrong-doi': 15,
  retracted: 8,
  correction: 6,
  preprint: 4,
  disagreement: 2,
}
const citationCases = readJsonl('data/citations/cases.jsonl')
if (citationCases.length !== 100) fail(`expected 100 citation cases, found ${citationCases.length}`)
const citationIds = new Set()
const citationCounts = Object.fromEntries(CITATION_CATEGORIES.map(category => [category, 0]))
for (const [index, item] of citationCases.entries()) {
  const where = `data/citations/cases.jsonl:${index + 1}`
  if (typeof item.id !== 'string' || !/^cite-[0-9]{4}$/u.test(item.id)) fail(`${where}: bad id ${String(item.id)}`)
  if (citationIds.has(item.id)) fail(`${where}: duplicate id ${item.id}`)
  citationIds.add(item.id)
  if (!CITATION_CATEGORIES.includes(item.category)) fail(`${where}: unknown category ${String(item.category)}`)
  citationCounts[item.category] += 1
  if (typeof item.description !== 'string' || item.description === '') fail(`${where}: description missing`)
  if (typeof item.input !== 'object' || item.input === null || Array.isArray(item.input)) fail(`${where}: input must be an object`)
  const input = item.input
  for (const key of ['doi', 'pmid', 'arxiv', 'bibtex', 'title', 'venue', 'pages']) {
    if (input[key] !== undefined && (typeof input[key] !== 'string' || input[key] === '')) fail(`${where}: input.${key} must be a non-empty string`)
  }
  if (input.authors !== undefined && (!Array.isArray(input.authors) || input.authors.some(author => typeof author !== 'string'))) {
    fail(`${where}: input.authors must be an array of strings`)
  }
  if (input.year !== undefined && !Number.isInteger(input.year)) fail(`${where}: input.year must be an integer`)
  if (!['doi', 'pmid', 'arxiv', 'bibtex'].some(key => typeof input[key] === 'string' && input[key] !== '')) {
    fail(`${where}: input has no identifier`)
  }
  if (!Array.isArray(item.providers) || item.providers.length === 0) fail(`${where}: no provider fixture`)
  const providerMatches = new Set()
  for (const provider of item.providers) {
    if (typeof provider !== 'object' || provider === null || Array.isArray(provider)) fail(`${where}: provider must be an object`)
    if (typeof provider.match !== 'string' || provider.match === '') fail(`${where}: provider.match missing`)
    if (providerMatches.has(provider.match)) fail(`${where}: duplicate provider.match ${provider.match}`)
    providerMatches.add(provider.match)
    if (!Number.isInteger(provider.status) || provider.status < 100 || provider.status > 599) {
      fail(`${where}: provider.status must be an HTTP status integer`)
    }
    if (!('body' in provider)) fail(`${where}: provider.body is required`)
  }
  if (typeof item.expected !== 'object' || item.expected === null || Array.isArray(item.expected)) fail(`${where}: expected must be an object`)
  const expected = item.expected
  if (typeof expected.exists !== 'boolean') fail(`${where}: expected.exists must be boolean`)
  if (typeof expected.update_notice !== 'boolean') fail(`${where}: expected.update_notice must be boolean`)
  if (!Array.isArray(expected.mismatch_fields)) fail(`${where}: expected.mismatch_fields must be an array`)
  if (expected.mismatch_fields.some(field => !FIELDS.includes(field))) fail(`${where}: unknown mismatch field`)
  if (new Set(expected.mismatch_fields).size !== expected.mismatch_fields.length) fail(`${where}: duplicate mismatch field`)
  if (expected.exists === false && !item.providers.some(provider => provider.status === 404)) {
    fail(`${where}: exists=false requires a 404 provider fixture`)
  }
  const fields = expected.mismatch_fields
  if (item.category === 'correct' && (expected.exists !== true || fields.length !== 0 || expected.update_notice !== false)) {
    fail(`${where}: correct cases must exist, match every field and carry no update notice`)
  }
  if (item.category === 'wrong-author' && (expected.exists !== true || !sameSet(fields, ['authors']))) {
    fail(`${where}: wrong-author cases must flag exactly authors`)
  }
  if (item.category === 'wrong-year' && (expected.exists !== true || !sameSet(fields, ['year']))) {
    fail(`${where}: wrong-year cases must flag exactly year`)
  }
  if (item.category === 'wrong-doi') {
    if (expected.exists === false && fields.length !== 0) fail(`${where}: an unresolvable DOI must not flag fields`)
    if (expected.exists === true && !sameSet(fields, ['title', 'authors', 'year', 'venue'])) {
      fail(`${where}: a DOI resolving to another work must flag title/authors/year/venue`)
    }
  }
  if ((item.category === 'retracted' || item.category === 'correction') && (expected.update_notice !== true || fields.length !== 0)) {
    fail(`${where}: ${item.category} cases must carry only an update notice`)
  }
  if (item.category === 'preprint' && (expected.exists !== true || fields.length !== 0 || expected.update_notice !== false)) {
    fail(`${where}: preprint cases must match with no update notice`)
  }
  if (item.category === 'disagreement' && (expected.exists !== true || !sameSet(fields, ['version']))) {
    fail(`${where}: disagreement cases must flag exactly version`)
  }
}
if (!sameCounts(citationCounts, expectedCitationCounts)) {
  fail(`citation category counts disagree with the frozen rubric: ${JSON.stringify(citationCounts)}`)
}
const citationSummary = readJson('data/citations/SUMMARY.json')
assertSummary('data/citations/SUMMARY.json', citationSummary, {
  dataset: 'citations',
  total: 100,
  counts: { byCategory: expectedCitationCounts },
})
if (citationSummary.total !== citationCases.length) fail('SUMMARY.total disagrees with the dataset')
if (!sameCounts(citationSummary.byCategory, citationCounts)) fail('SUMMARY.byCategory disagrees with the dataset')
if (JSON.stringify(citationSummary.labelSpace?.mismatchFields) !== JSON.stringify(FIELDS)) {
  fail('citation SUMMARY.labelSpace.mismatchFields disagrees with the validator')
}

// ── stats ───────────────────────────────────────────────────────────────────
const statCases = readJsonl('data/stats/cases.jsonl')
if (statCases.length !== 30) fail(`expected 30 stat cases, found ${statCases.length}`)
const statIds = new Set()
const statVerdictCounts = { consistent: 0, inconsistent: 0 }
const statIssueCounts = {}
const expectedStatIssueCounts = { none: 10, 'p-value': 15, ci: 2, format: 2, 'p-threshold': 1 }
for (const [index, item] of statCases.entries()) {
  const where = `data/stats/cases.jsonl:${index + 1}`
  if (typeof item.id !== 'string' || !/^stat-[0-9]{4}$/u.test(item.id)) fail(`${where}: bad id ${String(item.id)}`)
  if (statIds.has(item.id)) fail(`${where}: duplicate id ${item.id}`)
  statIds.add(item.id)
  if (typeof item.text !== 'string' || item.text === '') fail(`${where}: text missing`)
  if (typeof item.expected !== 'object' || item.expected === null || Array.isArray(item.expected)) fail(`${where}: expected must be an object`)
  const expected = item.expected
  if (!['consistent', 'inconsistent'].includes(expected.verdict)) fail(`${where}: bad expected.verdict`)
  const issue = expected.issue
  if (issue !== null && !STAT_ISSUES.includes(issue)) fail(`${where}: bad expected.issue ${String(issue)}`)
  if (expected.verdict === 'consistent' && issue !== null) fail(`${where}: a consistent case must not name an issue`)
  if (expected.verdict === 'inconsistent' && issue === null) fail(`${where}: an inconsistent case must name an issue`)
  statVerdictCounts[expected.verdict] += 1
  const issueKey = issue ?? 'none'
  statIssueCounts[issueKey] = (statIssueCounts[issueKey] ?? 0) + 1
}
if (!sameCounts(statVerdictCounts, { consistent: 10, inconsistent: 20 })) fail('stat verdict counts disagree with the frozen rubric')
if (!sameCounts(statIssueCounts, expectedStatIssueCounts)) {
  fail(`stat issue counts disagree with the frozen rubric: ${JSON.stringify(statIssueCounts)}`)
}
const statSummary = readJson('data/stats/SUMMARY.json')
assertSummary('data/stats/SUMMARY.json', statSummary, {
  dataset: 'stats',
  total: 30,
  counts: { byVerdict: statVerdictCounts, byIssue: statIssueCounts },
})
if (!sameCounts(statSummary.byVerdict, statVerdictCounts)) fail('SUMMARY.byVerdict disagrees with the dataset')
if (!sameCounts(statSummary.byIssue, statIssueCounts)) fail('SUMMARY.byIssue disagrees with the dataset')
if (JSON.stringify(statSummary.labelSpace?.issue) !== JSON.stringify(STAT_ISSUES)) {
  fail('stat SUMMARY.labelSpace.issue disagrees with the validator')
}

// ── claims ──────────────────────────────────────────────────────────────────
const claimCases = readJsonl('data/claims/cases.jsonl')
if (claimCases.length !== 50) fail(`expected 50 claim cases, found ${claimCases.length}`)
const claimIds = new Set()
const claimCategoryCounts = Object.fromEntries(Object.keys(CLAIM_CATEGORIES).map(category => [category, 0]))
const claimVerdictCounts = {}
for (const [index, item] of claimCases.entries()) {
  const where = `data/claims/cases.jsonl:${index + 1}`
  if (typeof item.id !== 'string' || !/^claim-[0-9]{4}$/u.test(item.id)) fail(`${where}: bad id ${String(item.id)}`)
  if (claimIds.has(item.id)) fail(`${where}: duplicate id ${item.id}`)
  claimIds.add(item.id)
  if (!Object.hasOwn(CLAIM_CATEGORIES, item.category)) fail(`${where}: unknown category ${String(item.category)}`)
  if (typeof item.claim !== 'string' || item.claim === '') fail(`${where}: claim missing`)
  if (typeof item.source !== 'string' || item.source === '') fail(`${where}: source missing`)
  if (typeof item.expected !== 'object' || item.expected === null || Array.isArray(item.expected)) fail(`${where}: expected must be an object`)
  if (!VERDICTS.includes(item.expected.verdict)) fail(`${where}: bad expected.verdict`)
  if (item.expected.verdict !== CLAIM_CATEGORIES[item.category]) {
    fail(`${where}: category ${item.category} must be labelled ${CLAIM_CATEGORIES[item.category]}, got ${item.expected.verdict}`)
  }
  claimCategoryCounts[item.category] += 1
  claimVerdictCounts[item.expected.verdict] = (claimVerdictCounts[item.expected.verdict] ?? 0) + 1
}
if (!sameCounts(claimCategoryCounts, { supported: 15, paraphrase: 10, 'number-wrong': 8, negated: 7, 'quote-mined': 5, insufficient: 5 })) {
  fail('claim category counts disagree with the frozen rubric')
}
if (!sameCounts(claimVerdictCounts, { verified: 15, insufficient: 15, disproven: 8, contradicted: 12 })) {
  fail('claim verdict counts disagree with the frozen rubric')
}
const claimSummary = readJson('data/claims/SUMMARY.json')
assertSummary('data/claims/SUMMARY.json', claimSummary, {
  dataset: 'claims',
  total: 50,
  counts: { byCategory: claimCategoryCounts, byVerdict: claimVerdictCounts },
})
if (!sameCounts(claimSummary.byCategory, claimCategoryCounts)) fail('SUMMARY.byCategory disagrees with the dataset')
if (!sameCounts(claimSummary.byVerdict, claimVerdictCounts)) fail('SUMMARY.byVerdict disagrees with the dataset')
if (JSON.stringify(claimSummary.labelSpace?.verdict) !== JSON.stringify(VERDICTS)) {
  fail('claim SUMMARY.labelSpace.verdict disagrees with the validator')
}

console.log(
  `validate: ok (${citationCases.length} citation cases in ${Object.keys(citationCounts).length} categories, ` +
    `${statCases.length} stat cases, ${claimCases.length} claim cases; counts, categories, labels and SUMMARY agree)`,
)
