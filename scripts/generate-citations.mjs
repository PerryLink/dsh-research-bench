// Deterministic citation benchmark generator (no randomness, no network).
//
// Every case is synthetic: fictional works under the reserved-ish 10.5555
// prefix, fictional journals, and provider responses built from the same table.
// The point is to measure the CHECKING LOGIC against a frozen rubric, not to
// test whether Crossref is up. Ground truth is the generator's label, never the
// plugin's output.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'data', 'citations')
mkdirSync(outDir, { recursive: true })

/** The synthetic works every case is built from. */
const WORKS = [
  { id: 'w01', doi: '10.5555/synth.2020.001', title: 'A synthetic study of anchoring', authors: ['Doe, Jane', 'Roe, Richard'], year: 2020, venue: 'Journal of Synthetic Tests', pages: '101-118' },
  { id: 'w02', doi: '10.5555/synth.2021.002', title: 'Synthetic evidence for reproducible pipelines', authors: ['Muster, Max', 'Beispiel, Erika'], year: 2021, venue: 'Reproducibility Letters', pages: '1-14' },
  { id: 'w03', doi: '10.5555/synth.2019.003', title: 'A controlled comparison of two synthetic estimators', authors: ['Nguyen, An', 'Park, Ji-Woo'], year: 2019, venue: 'Computational Fixtures', pages: '55-72' },
  { id: 'w04', doi: '10.5555/synth.2022.004', title: 'Longitudinal effects in a synthetic cohort', authors: ['Garcia, Ana', 'Silva, Rui', 'Khan, Aisha'], year: 2022, venue: 'Fixture Epidemiology', pages: 'e100-e112' },
  { id: 'w05', doi: '10.5555/synth.2018.005', title: 'Measurement invariance in fabricated scales', authors: ['Ivanova, Olga'], year: 2018, venue: 'Journal of Placeholder Methods', pages: '300-315' },
  { id: 'w06', doi: '10.5555/synth.2023.006', title: 'A negative result that should be reported', authors: ['Okafor, Chidi', 'Tanaka, Yui'], year: 2023, venue: 'Negative Results Quarterly', pages: '7-19' },
  { id: 'w07', doi: '10.5555/synth.2020.007', title: 'Bayesian alternatives in a synthetic benchmark', authors: ['Rossi, Marco'], year: 2020, venue: 'Bayesian Fixtures', pages: '201-220' },
  { id: 'w08', doi: '10.5555/synth.2021.008', title: 'Scaling laws for imaginary models', authors: ['Weber, Lena', 'Fischer, Tom'], year: 2021, venue: 'Machine Learning Fixtures', pages: '1-12' },
  { id: 'w09', doi: '10.5555/synth.2017.009', title: 'A replication of a replication', authors: ['Novak, Petr'], year: 2017, venue: 'Replication Studies', pages: '88-95' },
  { id: 'w10', doi: '10.5555/synth.2024.010', title: 'Open data in synthetic trials', authors: ['Haddad, Layla', 'Ahmed, Omar'], year: 2024, venue: 'Open Research Fixtures', pages: 'e200-e210' },
]

const work = id => WORKS.find(item => item.id === id)
const splitAuthor = author => {
  const [family, given] = author.split(',').map(part => part.trim())
  return given === undefined ? { family } : { family, given }
}

/** Build a Crossref `works/{doi}` body for one work. */
function crossrefBody(target, options = {}) {
  const message = {
    DOI: target.doi,
    title: [options.title ?? target.title],
    author: (options.authors ?? target.authors).map(splitAuthor),
    issued: { 'date-parts': [[options.year ?? target.year]] },
    'container-title': [options.venue ?? target.venue],
    page: target.pages,
    publisher: 'Synthetic Press',
    type: 'journal-article',
  }
  if (options.update !== undefined) {
    message['update-to'] = [{ type: options.update, DOI: target.doi, label: `${options.update} of ${target.title}` }]
  }
  return { status: 'ok', message }
}

/** Build a PubMed esummary body for one work. */
function pubmedBody(pmid, target, title) {
  return {
    header: { type: 'esummary', version: '0.3' },
    result: {
      uids: [pmid],
      [pmid]: {
        uid: pmid,
        title: `${title ?? target.title}.`,
        authors: target.authors.map(author => ({ name: author.split(',')[0] })),
        pubdate: `${target.year} Jan`,
        fulljournalname: target.venue,
        source: target.venue.split(' ').map(word => word[0]).join(''),
        volume: '1',
        issue: '1',
        pages: target.pages,
        articleids: [{ idtype: 'doi', value: target.doi }, { idtype: 'pubmed', value: pmid }],
      },
    },
  }
}

/** Build an arXiv Atom entry for one work. */
function arxivBody(arxivId, target) {
  const authors = target.authors.map(author => {
    const [family, given] = author.split(',').map(part => part.trim())
    return `<author><name>${given === undefined ? family : `${given} ${family}`}</name></author>`
  })
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/${arxivId}v1</id>
    <title>${target.title}</title>
    ${authors.join('\n    ')}
    <published>${target.year}-01-15T00:00:00Z</published>
    <arxiv:doi xmlns:arxiv="http://arxiv.org/schemas/atom">${target.doi}</arxiv:doi>
  </entry>
</feed>`
}

/** A Crossref route for a work's own DOI. */
const routeFor = (target, options = {}) => ({
  match: `api.crossref.org/works/${target.doi}`,
  status: 200,
  body: crossrefBody(target, options),
})

const cases = []
let sequence = 0
const push = (category, description, input, providers, expected) => {
  sequence += 1
  cases.push({
    id: `cite-${String(sequence).padStart(4, '0')}`,
    category,
    description,
    input,
    providers,
    expected,
  })
}

// ── 30 correct ──────────────────────────────────────────────────────────────
// The third case per work is deliberately a HARD clean case: a correct citation
// that a naive string matcher would flag (diacritics, venue abbreviation,
// omitted subtitle). These keep the clean false-positive rate meaningful.
for (const [index, target] of WORKS.entries()) {
  push(
    'correct',
    'all cited fields match the record',
    { doi: target.doi, title: target.title, authors: [...target.authors], year: target.year, venue: target.venue, pages: target.pages },
    [routeFor(target)],
    { exists: true, mismatch_fields: [], update_notice: false },
  )
  push('correct', 'title + year only', { doi: target.doi, title: target.title, year: target.year }, [routeFor(target)], {
    exists: true,
    mismatch_fields: [],
    update_notice: false,
  })
  if (index < 3) {
    push(
      'correct',
      'author names differ only by diacritics (same people)',
      { doi: target.doi, authors: ['Muller, Jurgen', 'Ostergard, Soren'] },
      [routeFor(target, { authors: ['Müller, Jürgen', 'Østergård, Søren'] })],
      { exists: true, mismatch_fields: [], update_notice: false },
    )
  } else if (index < 6) {
    const abbreviated = target.venue
      .split(' ')
      .map(word => (word.length > 6 ? `${word[0].toUpperCase()}.` : word))
      .join(' ')
    push(
      'correct',
      'venue cited in abbreviated form',
      { doi: target.doi, venue: abbreviated },
      [routeFor(target)],
      { exists: true, mismatch_fields: [], update_notice: false },
    )
  } else if (index < 9) {
    push(
      'correct',
      'subtitle omitted from the cited title',
      { doi: target.doi, title: target.title },
      [routeFor(target, { title: `${target.title}: evidence from fixtures` })],
      { exists: true, mismatch_fields: [], update_notice: false },
    )
  } else {
    push('correct', 'authors only', { doi: target.doi, authors: [...target.authors] }, [routeFor(target)], {
      exists: true,
      mismatch_fields: [],
      update_notice: false,
    })
  }
}

// ── 20 wrong author ─────────────────────────────────────────────────────────
for (const target of WORKS) {
  const [family, given] = target.authors[0].split(',').map(part => part.trim())
  const wrongFirst = `${family}-Wrong, ${given ?? 'A'}`
  push(
    'wrong-author',
    'first author family name altered',
    { doi: target.doi, authors: [wrongFirst, ...target.authors.slice(1)], title: target.title },
    [routeFor(target)],
    { exists: true, mismatch_fields: ['authors'], update_notice: false },
  )
  push(
    'wrong-author',
    'an extra author is cited',
    { doi: target.doi, authors: [...target.authors, 'Extra, Person'], title: target.title },
    [routeFor(target)],
    { exists: true, mismatch_fields: ['authors'], update_notice: false },
  )
}

// ── 15 wrong year ───────────────────────────────────────────────────────────
for (const [index, target] of WORKS.entries()) {
  const delta = index % 2 === 0 ? 1 : 10
  push(
    'wrong-year',
    `cited year is ${delta} year(s) off`,
    { doi: target.doi, year: target.year + delta, title: target.title },
    [routeFor(target)],
    { exists: true, mismatch_fields: ['year'], update_notice: false },
  )
}
for (const target of WORKS.slice(0, 5)) {
  push(
    'wrong-year',
    'cited year is 2 years off',
    { doi: target.doi, year: target.year + 2, title: target.title },
    [routeFor(target)],
    { exists: true, mismatch_fields: ['year'], update_notice: false },
  )
}

// ── 15 wrong DOI: 8 not found, 7 pointing at a different work ───────────────
for (let index = 1; index <= 8; index += 1) {
  const missing = `10.5555/synth.missing.${String(index).padStart(3, '0')}`
  push(
    'wrong-doi',
    'DOI does not exist at the provider',
    { doi: missing, title: 'A work that does not exist' },
    [{ match: `api.crossref.org/works/${missing}`, status: 404, body: null }],
    { exists: false, mismatch_fields: [], update_notice: false },
  )
}
for (const [index, target] of WORKS.slice(0, 7).entries()) {
  const actual = WORKS[index + 1]
  push(
    'wrong-doi',
    'DOI resolves to a different work',
    { doi: target.doi, title: target.title, authors: [...target.authors], year: target.year, venue: target.venue },
    // The route is keyed by the REQUESTED DOI; the body is a different work.
    [{ match: `api.crossref.org/works/${target.doi}`, status: 200, body: crossrefBody(actual) }],
    { exists: true, mismatch_fields: ['title', 'authors', 'year', 'venue'], update_notice: false },
  )
}

// ── 8 retraction notices + 6 correction notices ─────────────────────────────
for (const target of WORKS.slice(0, 8)) {
  push(
    'retracted',
    'the resolved record carries a retraction notice',
    { doi: target.doi, title: target.title },
    [routeFor(target, { update: 'retraction' })],
    { exists: true, mismatch_fields: [], update_notice: true },
  )
}
for (const target of WORKS.slice(0, 6)) {
  push(
    'correction',
    'the resolved record carries a correction notice',
    { doi: target.doi, title: target.title },
    [routeFor(target, { update: 'correction' })],
    { exists: true, mismatch_fields: [], update_notice: true },
  )
}

// ── 4 preprint + published version ──────────────────────────────────────────
for (const [index, target] of WORKS.slice(0, 4).entries()) {
  const arxivId = `2401.0000${index + 1}`
  push(
    'preprint',
    'arXiv and the published DOI agree on the title',
    { doi: target.doi, arxiv: arxivId, title: target.title },
    [
      routeFor(target),
      { match: `export.arxiv.org/api/query?id_list=${arxivId}`, status: 200, body: arxivBody(arxivId, target) },
    ],
    { exists: true, mismatch_fields: [], update_notice: false },
  )
}

// ── 2 two-source disagreements ──────────────────────────────────────────────
for (const [index, target] of WORKS.slice(0, 2).entries()) {
  const pmid = `90000${index + 1}`
  push(
    'disagreement',
    'PubMed and Crossref titles disagree',
    { doi: target.doi, pmid, title: target.title },
    [
      routeFor(target),
      { match: 'eutils.ncbi.nlm.nih.gov', status: 200, body: pubmedBody(pmid, target, `${target.title} retracted and revised`) },
    ],
    { exists: true, mismatch_fields: ['version'], update_notice: false },
  )
}

// ── write ───────────────────────────────────────────────────────────────────
const byCategory = {}
for (const item of cases) byCategory[item.category] = (byCategory[item.category] ?? 0) + 1
const summary = {
  dataset: 'citations',
  version: '0.1.0',
  generatedAt: '2026-11-08',
  total: cases.length,
  byCategory,
  labelSpace: { mismatchFields: ['title', 'authors', 'year', 'venue', 'pages', 'version'] },
  synthetic: true,
  note: 'All works, DOIs and venues are fictional; provider responses are frozen fixtures. Ground truth comes from this generator, never from a plugin.',
}

writeFileSync(path.join(outDir, 'cases.jsonl'), `${cases.map(item => JSON.stringify(item)).join('\n')}\n`, 'utf8')
writeFileSync(path.join(outDir, 'SUMMARY.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
console.log(`citations: ${cases.length} cases -> ${path.relative(root, path.join(outDir, 'cases.jsonl'))}`)
console.log(JSON.stringify(byCategory))
