// Validate the committed benchmark data: structure, counts, label space and
// summary agreement. Deterministic; runs in CI with no dependencies.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fail = message => {
  console.error(`validate: ${message}`)
  process.exit(1)
}

const readJsonl = file =>
  readFileSync(path.join(root, file), 'utf8')
    .split('\n')
    .filter(line => line.trim() !== '')
    .map((line, index) => {
      try {
        return JSON.parse(line)
      } catch (error) {
        fail(`${file}:${index + 1}: ${error.message}`)
      }
    })

const CATEGORIES = new Set(['correct', 'wrong-author', 'wrong-year', 'wrong-doi', 'retracted', 'correction', 'preprint', 'disagreement'])
const FIELDS = new Set(['title', 'authors', 'year', 'venue', 'pages', 'version'])

// ── citations ───────────────────────────────────────────────────────────────
const citationCases = readJsonl('data/citations/cases.jsonl')
if (citationCases.length !== 100) fail(`expected 100 citation cases, found ${citationCases.length}`)
const ids = new Set()
const byCategory = {}
for (const item of citationCases) {
  if (!/^cite-[0-9]{4}$/u.test(item.id ?? '')) fail(`bad id ${String(item.id)}`)
  if (ids.has(item.id)) fail(`duplicate id ${item.id}`)
  ids.add(item.id)
  if (!CATEGORIES.has(item.category)) fail(`${item.id}: unknown category ${item.category}`)
  byCategory[item.category] = (byCategory[item.category] ?? 0) + 1
  const input = item.input ?? {}
  if (!['doi', 'pmid', 'arxiv', 'bibtex'].some(key => typeof input[key] === 'string' && input[key] !== '')) {
    fail(`${item.id}: input has no identifier`)
  }
  if (!Array.isArray(item.providers) || item.providers.length === 0) fail(`${item.id}: no provider fixture`)
  for (const provider of item.providers) {
    if (typeof provider.match !== 'string' || provider.match === '') fail(`${item.id}: provider.match missing`)
    if (!Number.isInteger(provider.status)) fail(`${item.id}: provider.status must be an integer`)
  }
  const expected = item.expected ?? {}
  if (typeof expected.exists !== 'boolean') fail(`${item.id}: expected.exists must be boolean`)
  if (typeof expected.update_notice !== 'boolean') fail(`${item.id}: expected.update_notice must be boolean`)
  if (!Array.isArray(expected.mismatch_fields)) fail(`${item.id}: expected.mismatch_fields must be an array`)
  for (const field of expected.mismatch_fields) {
    if (!FIELDS.has(field)) fail(`${item.id}: unknown mismatch field ${field}`)
  }
  if (expected.exists === false && !item.providers.some(provider => provider.status === 404)) {
    fail(`${item.id}: exists=false requires a 404 provider fixture`)
  }
  if (item.category === 'wrong-doi' && expected.exists === true && expected.mismatch_fields.length === 0) {
    fail(`${item.id}: a wrong-doi case that resolves must declare the mismatching fields`)
  }
}
const summary = JSON.parse(readFileSync(path.join(root, 'data/citations/SUMMARY.json'), 'utf8'))
if (summary.total !== citationCases.length) fail('SUMMARY.total disagrees with the dataset')
for (const [category, count] of Object.entries(byCategory)) {
  if (summary.byCategory[category] !== count) fail(`SUMMARY.byCategory.${category} disagrees (${count})`)
}

// ── stats (added with dsh-statcheck; optional until then) ──────────────────
try {
  const statCases = readJsonl('data/stats/cases.jsonl')
  if (statCases.length !== 30) fail(`expected 30 stat cases, found ${statCases.length}`)
  const statIds = new Set()
  for (const item of statCases) {
    if (!/^stat-[0-9]{4}$/u.test(item.id ?? '')) fail(`bad stat id ${String(item.id)}`)
    if (statIds.has(item.id)) fail(`duplicate stat id ${item.id}`)
    statIds.add(item.id)
    if (typeof item.text !== 'string' || item.text === '') fail(`${item.id}: text missing`)
    if (!['consistent', 'inconsistent'].includes(item.expected?.verdict)) fail(`${item.id}: bad expected.verdict`)
  }
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}

console.log(`validate: ok (${citationCases.length} citation cases, ${Object.keys(byCategory).length} categories)`)
