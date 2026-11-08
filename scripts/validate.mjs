// Validate the committed benchmark data: structure, counts, label space,
// summary agreement and the cross-field label rules. Deterministic; no deps.
import { createHash } from 'node:crypto'
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


// ── images ──────────────────────────────────────────────────────────────────
const imageCases = readJsonl('data/images/cases.jsonl')
if (imageCases.length !== 100) fail(`expected 100 image pairs, found ${imageCases.length}`)
const IMAGE_CATEGORIES = {
  duplicate: { manipulated: true },
  flip: { manipulated: true },
  unrelated: { manipulated: false },
  'hard-negative': { manipulated: false },
}
const imageCounts = Object.fromEntries(Object.keys(IMAGE_CATEGORIES).map(category => [category, 0]))
const imageIds = new Set()
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
for (const [index, item] of imageCases.entries()) {
  const where = `data/images/cases.jsonl:${index + 1}`
  if (typeof item.id !== 'string' || !/^img-[0-9]{4}$/u.test(item.id)) fail(`${where}: bad id ${String(item.id)}`)
  if (imageIds.has(item.id)) fail(`${where}: duplicate id ${item.id}`)
  imageIds.add(item.id)
  if (!Object.hasOwn(IMAGE_CATEGORIES, item.category)) fail(`${where}: unknown category ${String(item.category)}`)
  if (typeof item.expected !== 'object' || item.expected === null || Array.isArray(item.expected)) fail(`${where}: expected must be an object`)
  if (typeof item.expected.manipulated !== 'boolean') fail(`${where}: expected.manipulated must be boolean`)
  if (item.expected.manipulated !== IMAGE_CATEGORIES[item.category].manipulated) fail(`${where}: category ${item.category} has the wrong manipulated label`)
  if (item.category === 'duplicate' && item.expected.kind !== 'duplicate') fail(`${where}: duplicate cases must label kind=duplicate`)
  if (item.category === 'flip' && !['horizontal-flip', 'vertical-flip'].includes(item.expected.kind)) fail(`${where}: flip cases must label a flip kind`)
  if (!item.expected.manipulated && item.expected.kind != null) fail(`${where}: negative cases must not carry a kind`)
  for (const file of ['a.png', 'b.png']) {
    const imagePath = path.join(root, 'data/images/cases', item.id, file)
    let bytes
    try { bytes = readFileSync(imagePath) } catch { fail(`${where}: missing ${file}`) }
    if (bytes.length < 8 || !bytes.subarray(0, 8).equals(png)) fail(`${where}: ${file} is not a PNG`)
  }
  imageCounts[item.category] += 1
}
if (!sameCounts(imageCounts, { duplicate: 25, flip: 25, unrelated: 25, 'hard-negative': 25 })) {
  fail(`image category counts disagree with the frozen rubric: ${JSON.stringify(imageCounts)}`)
}
const imageSummary = readJson('data/images/SUMMARY.json')
if (imageSummary.dataset !== 'images' || imageSummary.total !== 100) fail('data/images/SUMMARY.json: wrong dataset or total')
if (!sameCounts(imageSummary.byCategory, imageCounts)) fail('data/images/SUMMARY.json: byCategory disagrees with the dataset')


// ── meta ────────────────────────────────────────────────────────────────────
const metaCases = readJsonl('data/meta/cases.jsonl')
if (metaCases.length !== 20) fail(`expected 20 meta cases, found ${metaCases.length}`)
const META_CATEGORIES = { homogeneous: 5, 'medium-heterogeneity': 5, 'high-heterogeneity': 4, 'zero-effect': 2, 'negative-effect': 2, 'small-k': 2 }
const metaCounts = Object.fromEntries(Object.keys(META_CATEGORIES).map(category => [category, 0]))
const metaIds = new Set()
const finite = value => typeof value === 'number' && Number.isFinite(value)
for (const [index, item] of metaCases.entries()) {
  const where = `data/meta/cases.jsonl:${index + 1}`
  if (typeof item.id !== 'string' || !/^meta-[0-9]{4}$/u.test(item.id)) fail(`${where}: bad id ${String(item.id)}`)
  if (metaIds.has(item.id)) fail(`${where}: duplicate id ${item.id}`)
  metaIds.add(item.id)
  if (!Object.hasOwn(META_CATEGORIES, item.category)) fail(`${where}: unknown category ${String(item.category)}`)
  if (!Array.isArray(item.studies) || item.studies.length < 2) fail(`${where}: studies must have at least two entries`)
  const expected = item.expected
  if (typeof expected !== 'object' || expected === null) fail(`${where}: expected missing`)
  if (expected.k !== item.studies.length) fail(`${where}: expected.k disagrees with studies.length`)
  if (expected.df !== item.studies.length - 1) fail(`${where}: expected.df must be k-1`)
  for (const model of ['fixed', 'random']) {
    for (const field of ['effect', 'se', 'ciLow', 'ciHigh']) {
      if (!finite(expected[model]?.[field])) fail(`${where}: expected.${model}.${field} must be finite`)
    }
    if (expected[model].ciLow > expected[model].effect || expected[model].ciHigh < expected[model].effect) fail(`${where}: expected.${model} CI does not cover the effect`)
  }
  for (const field of ['Q', 'pQ', 'I2', 'tau2']) if (!finite(expected[field])) fail(`${where}: expected.${field} must be finite`)
  if (expected.Q < 0) fail(`${where}: Q must be non-negative`)
  if (expected.I2 < 0 || expected.I2 > 1) fail(`${where}: I2 must be in [0,1]`)
  if (expected.tau2 < 0) fail(`${where}: tau2 must be non-negative`)
  if (typeof expected.egger !== 'boolean') fail(`${where}: expected.egger must be boolean`)
  if (expected.egger !== (item.studies.length >= 10)) fail(`${where}: Egger flag must be true exactly when k >= 10`)
  for (const study of item.studies) {
    if (typeof study.label !== 'string' || !finite(study.effect)) fail(`${where}: study label/effect invalid`)
    if (!(finite(study.se) && study.se > 0) && !(finite(study.ciLow) && finite(study.ciHigh) && study.ciHigh > study.ciLow)) fail(`${where}: study needs a positive SE or a CI`)
  }
  metaCounts[item.category] += 1
}
if (!sameCounts(metaCounts, META_CATEGORIES)) fail(`meta category counts disagree with the frozen rubric: ${JSON.stringify(metaCounts)}`)
const metaSummary = readJson('data/meta/SUMMARY.json')
assertSummary('data/meta/SUMMARY.json', metaSummary, { dataset: 'meta', total: 20, counts: { byCategory: metaCounts } })
if (!sameCounts(metaSummary.byCategory, metaCounts)) fail('data/meta/SUMMARY.json: byCategory disagrees with the dataset')


// ── claims held-out ─────────────────────────────────────────────────────────
const heldoutCases = readJsonl('data/claims-heldout/cases.jsonl')
if (heldoutCases.length !== 50) fail(`expected 50 held-out claim cases, found ${heldoutCases.length}`)
const heldoutIds = new Set()
const heldoutCounts = {}
const baselineTexts = new Set(readJsonl('data/claims/cases.jsonl').flatMap(item => [item.claim, item.source]))
for (const [index, item] of heldoutCases.entries()) {
  const where = `data/claims-heldout/cases.jsonl:${index + 1}`
  if (typeof item.id !== 'string' || !/^claim-[0-9]{4}$/u.test(item.id)) fail(`${where}: bad id ${String(item.id)}`)
  if (heldoutIds.has(item.id)) fail(`${where}: duplicate id ${item.id}`)
  heldoutIds.add(item.id)
  if (!Object.hasOwn(CLAIM_CATEGORIES, item.category)) fail(`${where}: unknown category ${String(item.category)}`)
  if (!VERDICTS.includes(item.expected?.verdict)) fail(`${where}: bad expected.verdict`)
  if (item.expected.verdict !== CLAIM_CATEGORIES[item.category]) fail(`${where}: category ${item.category} must be labelled ${CLAIM_CATEGORIES[item.category]}`)
  if (baselineTexts.has(item.claim) || baselineTexts.has(item.source)) fail(`${where}: reuses a baseline case verbatim`)
  heldoutCounts[item.category] = (heldoutCounts[item.category] ?? 0) + 1
}
if (!sameCounts(heldoutCounts, { supported: 15, paraphrase: 10, 'number-wrong': 8, negated: 7, 'quote-mined': 5, insufficient: 5 })) {
  fail(`held-out category counts disagree with the frozen rubric: ${JSON.stringify(heldoutCounts)}`)
}
const heldoutSummary = readJson('data/claims-heldout/SUMMARY.json')
if (heldoutSummary.heldOut !== true || heldoutSummary.frozen !== true) fail('data/claims-heldout/SUMMARY.json must declare heldOut and frozen')
if (heldoutSummary.total !== 50) fail('data/claims-heldout/SUMMARY.json: wrong total')
if (!sameCounts(heldoutSummary.byCategory, heldoutCounts)) fail('data/claims-heldout/SUMMARY.json: byCategory disagrees')
const heldoutHash = createHash('sha256').update(readFileSync(path.join(root, 'data/claims-heldout/cases.jsonl'))).digest('hex')
if (heldoutSummary.caseSha256 !== heldoutHash) fail('data/claims-heldout: SUMMARY.caseSha256 does not match the frozen cases file')


// ── manuscripts ─────────────────────────────────────────────────────────────
const manuscriptCases = readJsonl('data/manuscripts/cases.jsonl')
if (manuscriptCases.length !== 10) fail(`expected 10 manuscript cases, found ${manuscriptCases.length}`)
const MANUSCRIPT_ITEMS = ['title','abstract','introduction','methods','results','discussion','conclusion','ethics','consent','funding','conflicts','data','contributions','registration']
const MANUSCRIPT_CORE = ['abstract','introduction','methods','results','discussion']
const manuscriptCategoryCounts = {}
let manuscriptLabels = 0
for (const [index, item] of manuscriptCases.entries()) {
  const where = `data/manuscripts/cases.jsonl:${index + 1}`
  if (typeof item.id !== 'string' || !/^ms-[0-9]{4}$/u.test(item.id)) fail(`${where}: bad id ${String(item.id)}`)
  if (typeof item.text !== 'string' || item.text.length < 200) fail(`${where}: text missing or too short`)
  if (typeof item.category !== 'string' || item.category === '') fail(`${where}: category missing`)
  const items = item.expected?.items
  if (typeof items !== 'object' || items === null) fail(`${where}: expected.items missing`)
  const keys = Object.keys(items)
  if (keys.length !== MANUSCRIPT_ITEMS.length || !MANUSCRIPT_ITEMS.every(key => keys.includes(key))) fail(`${where}: expected.items must cover exactly the 14 items`)
  for (const key of MANUSCRIPT_ITEMS) {
    if (!['present','missing'].includes(items[key])) fail(`${where}: bad status for ${key}`)
    manuscriptLabels += 1
  }
  if (!Array.isArray(item.expected.missingCoreSections)) fail(`${where}: expected.missingCoreSections must be an array`)
  for (const section of item.expected.missingCoreSections) {
    if (!MANUSCRIPT_CORE.includes(section)) fail(`${where}: unknown core section ${section}`)
    if (items[section] !== 'missing') fail(`${where}: core section ${section} is listed missing but item status is ${items[section]}`)
  }
  for (const section of MANUSCRIPT_CORE) {
    if (items[section] === 'missing' && !item.expected.missingCoreSections.includes(section)) fail(`${where}: ${section} missing but not listed in missingCoreSections`)
  }
  manuscriptCategoryCounts[item.category] = (manuscriptCategoryCounts[item.category] ?? 0) + 1
}
if (manuscriptLabels !== 140) fail(`expected 140 manuscript item labels, found ${manuscriptLabels}`)
const manuscriptSummary = readJson('data/manuscripts/SUMMARY.json')
if (manuscriptSummary.dataset !== 'manuscripts' || manuscriptSummary.total !== 10) fail('data/manuscripts/SUMMARY.json: wrong dataset or total')
if (manuscriptSummary.synthetic !== true) fail('data/manuscripts/SUMMARY.json must declare synthetic: true')
if (!sameCounts(manuscriptSummary.byCategory, manuscriptCategoryCounts)) fail('data/manuscripts/SUMMARY.json: byCategory disagrees')

console.log(
  `validate: ok (${citationCases.length} citation cases in ${Object.keys(citationCounts).length} categories, ` +
    `${statCases.length} stat cases, ${claimCases.length} claim cases, ${imageCases.length} image pairs, ${metaCases.length} meta cases, ${heldoutCases.length} held-out claim cases, ${manuscriptCases.length} manuscripts (${manuscriptLabels} labels); counts, categories, labels and SUMMARY agree)`,
)
