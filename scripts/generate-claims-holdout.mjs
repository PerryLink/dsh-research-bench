// Deterministic held-out claim-support benchmark generator.
//
// This is deliberately separate from data/claims: the 50 cases below were
// authored from rubric/CLAIMS.md with new topics, wording and numbers, and are
// frozen (SHA-256 in SUMMARY.json) before the first plugin evaluation. Labels
// are derived only from the category rule, never from a plugin prediction.
//
// Categories (same counts as the regression baseline):
//   supported   15 -> verified
//   paraphrase  10 -> insufficient
//   number-wrong 8 -> disproven
//   negated      7 -> contradicted
//   quote-mined  5 -> contradicted
//   insufficient 5 -> insufficient
//
// Usage: node scripts/generate-claims-holdout.mjs [--refreeze]
//   --refreeze  only for revisions made BEFORE the first evaluation run; it
//               refuses to silently rewrite an already-frozen set otherwise.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'data', 'claims-heldout')
const casesPath = path.join(outDir, 'cases.jsonl')
const summaryPath = path.join(outDir, 'SUMMARY.json')
const schemaPath = path.join(outDir, 'schema.json')

const FROZEN_DATE = '2026-11-08'
const HASH_ALGORITHM = 'sha256'
const CATEGORY_VERDICT = {
  supported: 'verified',
  paraphrase: 'insufficient',
  'number-wrong': 'disproven',
  negated: 'contradicted',
  'quote-mined': 'contradicted',
  insufficient: 'insufficient',
}
const EXPECTED_COUNTS = {
  supported: 15,
  paraphrase: 10,
  'number-wrong': 8,
  negated: 7,
  'quote-mined': 5,
  insufficient: 5,
}

/** Seven new synthetic source paragraphs, each four sentences, no baseline topic. */
const SOURCES = {
  battery:
    'In the pouch-cell trial the coated cathode retained 86% of its initial capacity after 400 cycles (n = 36, p = .003). The coating failed to improve rate capability at 4.2 V in the high-voltage test (OR = 1.11, 95% CI [0.84, 1.47]). Capacity fade may be associated with electrolyte oxidation, but the post-mortem evidence is preliminary. The uncoated control lost 0.09% capacity per cycle, whereas the coated cells lost 0.04% per cycle.',
  coral:
    'After 18 months the nursery-grown coral fragments covered 31% of the restoration plots (n = 24, p = .012). Herbivore exclusion did not increase fragment survival on the exposed reef (RR = 1.03, 95% CI [0.77, 1.38]). Survival could be linked to shading and wave exposure, though the survey is exploratory. The plots with mixed species showed 12% higher cover than the single-species plots (d = 0.38).',
  minimumWage:
    'The county minimum-wage increase raised restaurant wages by 6.4% over two years (n = 214, p = .021). The policy did not reduce restaurant employment in the first year (RR = 0.99, 95% CI [0.93, 1.06]). Employment changes might reflect seasonal migration, and the estimates are tentative. Teen employment fell by 2.1% in the same period (d = -0.12).',
  recommender:
    'The reranking model improved top-10 recall by 9.7% on the held-out split (n = 5000, p = .008). The baseline did not improve calibration after temperature scaling (OR = 1.04, 95% CI [0.88, 1.23]). Diversity may be associated with the reranking strength, but the ablation is inconclusive. Training time increased by 14 minutes per epoch (t(19) = 2.73, p = .013).',
  canopy:
    'Neighborhoods with 30% tree canopy were 1.8 °C cooler at midday than bare blocks (n = 60, p = .006). Planting did not lower surface temperature in the parking-lot trial (OR = 0.94, 95% CI [0.71, 1.24]). Cooling seems tied to canopy density, although the sensor network is sparse. The canopy program added 4.5 hectares of shade over five years (n = 12 districts).',
  sorghum:
    'The drought-tolerant sorghum line yielded 7.8 tonnes per hectare under deficit irrigation (n = 40, p = .009). The line did not increase grain protein content in the replicated field trial (OR = 1.02, 95% CI [0.86, 1.21]). Yield stability might depend on soil depth, and the genotype-by-environment analysis is preliminary. Stomatal conductance fell by 18% at midday (d = 0.52).',
  vocabulary:
    'Retrieval practice improved delayed vocabulary recall by 21% compared with rereading (n = 132, p < .001). Spacing did not increase recall of low-frequency words at the four-week test (OR = 1.06, 95% CI [0.90, 1.25]). Retention may be associated with the number of retrieval attempts, but the classroom data are preliminary. Response time decreased by 0.3 seconds after three practice sessions (t(131) = 2.48, p = .014).',
}

const cases = []
const push = (category, source, claim, description) => {
  const verdict = CATEGORY_VERDICT[category]
  if (verdict === undefined) throw new Error(`unknown category: ${category}`)
  cases.push({
    id: `claim-${String(cases.length + 1).padStart(4, '0')}`,
    category,
    claim,
    source: SOURCES[source],
    expected: { verdict },
    description,
  })
}

// ── supported (15, verified) ────────────────────────────────────────────────
push('supported', 'battery', 'The trial reports "the coated cathode retained 86% of its initial capacity after 400 cycles".', 'verbatim span with matching capacity and cycle numbers')
push('supported', 'battery', 'The authors report "n = 36, p = .003" for the capacity retention test.', 'verbatim labelled values')
push('supported', 'battery', 'The coating "failed to improve rate capability at 4.2 V" (OR = 1.11).', 'verbatim negative result with a matching labelled value')
push('supported', 'coral', 'The restoration report states "the nursery-grown coral fragments covered 31% of the restoration plots".', 'verbatim span with a matching percentage')
push('supported', 'coral', 'The authors report "RR = 1.03, 95% CI [0.77, 1.38]" for fragment survival.', 'verbatim interval quote that does not assert a direction')
push('supported', 'minimumWage', 'The study reports "raised restaurant wages by 6.4% over two years".', 'verbatim span with a matching percentage')
push('supported', 'minimumWage', 'The authors report "RR = 0.99, 95% CI [0.93, 1.06]" for restaurant employment.', 'verbatim interval quote from a null result')
push('supported', 'recommender', 'The reranking paper reports "improved top-10 recall by 9.7% on the held-out split".', 'verbatim span with matching rank and recall numbers')
push('supported', 'recommender', 'The paper reports "t(19) = 2.73, p = .013" for training time.', 'verbatim labelled values from a different sentence')
push('supported', 'canopy', 'The study reports "30% tree canopy were 1.8 °C cooler at midday".', 'verbatim span with matching canopy and temperature numbers')
push('supported', 'canopy', 'The authors report "OR = 0.94, 95% CI [0.71, 1.24]" for the parking-lot trial.', 'verbatim interval quote from a null result')
push('supported', 'sorghum', 'The field trial reports "yielded 7.8 tonnes per hectare under deficit irrigation".', 'verbatim span with a matching yield')
push('supported', 'sorghum', 'The authors report "d = 0.52" for stomatal conductance.', 'verbatim labelled effect size')
push('supported', 'vocabulary', 'The study reports "improved delayed vocabulary recall by 21% compared with rereading".', 'verbatim span with a matching percentage')
push('supported', 'vocabulary', 'The authors report "t(131) = 2.48, p = .014" for response time.', 'verbatim labelled values')

// ── paraphrase (10, insufficient) ───────────────────────────────────────────
push('paraphrase', 'battery', 'The coated cathode kept most of its capacity across 400 cycles.', 'paraphrase of capacity retention without a quoted span')
push('paraphrase', 'battery', 'The high-voltage coating test found no rate-capability benefit.', 'paraphrase of a negative result without a quoted span')
push('paraphrase', 'coral', 'Coral cover increased in the restoration plots over 18 months.', 'paraphrase of plot cover without a quoted span')
push('paraphrase', 'coral', 'Excluding herbivores barely changed fragment survival on the exposed reef.', 'paraphrase of a null result without a quoted span')
push('paraphrase', 'minimumWage', 'Restaurant wages rose after the county raised its minimum wage.', 'paraphrase of the wage increase without a quoted span')
push('paraphrase', 'minimumWage', 'Employment in restaurants was roughly unchanged in the policy\'s first year.', 'paraphrase of a null result without a quoted span')
push('paraphrase', 'recommender', 'The reranking model improved recall on the held-out split.', 'paraphrase of the recall gain without a quoted span')
push('paraphrase', 'recommender', 'Temperature scaling left calibration essentially unchanged.', 'paraphrase of a null result without a quoted span')
push('paraphrase', 'canopy', 'More tree canopy was linked to cooler midday temperatures.', 'paraphrase of the canopy association without a quoted span')
push('paraphrase', 'sorghum', 'Drought-tolerant sorghum produced 7.8 tonnes of grain per hectare under deficit irrigation.', 'paraphrase of the yield result without a quoted span')

// ── number-wrong (8, disproven) ─────────────────────────────────────────────
push('number-wrong', 'battery', 'The battery trial reports "the coated cathode retained 86% of its initial capacity after 400 cycles" with n = 60.', 'correct quote, contradicted sample size')
push('number-wrong', 'battery', 'The authors report "the coated cathode retained 86% of its initial capacity" with p = .030.', 'correct quote, contradicted p value')
push('number-wrong', 'battery', 'The coating test reported OR = 1.35 (95% CI [0.84, 1.47]).', 'contradicted odds ratio without a quote')
push('number-wrong', 'coral', 'The authors estimate RR = 1.24 (95% CI [0.77, 1.38]) for fragment survival.', 'contradicted risk ratio without a quote')
push('number-wrong', 'minimumWage', 'The county study reports "raised restaurant wages by 6.4%" with p = .040.', 'correct quote, contradicted p value')
push('number-wrong', 'recommender', 'The reranking paper reports t(19) = 3.42 for training time.', 'contradicted t value without a quote')
push('number-wrong', 'canopy', 'The canopy program "added 4.5 hectares of shade over five years" across n = 24 districts.', 'correct quote, contradicted district count')
push('number-wrong', 'sorghum', 'The sorghum line yielded 7.8 tonnes per hectare with d = 0.80 under deficit irrigation.', 'correct yield, contradicted effect size')

// ── negated (7, contradicted) ───────────────────────────────────────────────
push('negated', 'battery', 'The coating "improve rate capability at 4.2 V" (OR = 1.11).', 'affirmative fragment of a sentence that failed to improve')
push('negated', 'coral', 'Herbivore exclusion "increase fragment survival on the exposed reef" (RR = 1.03).', 'affirmative fragment of a negated result')
push('negated', 'minimumWage', 'The policy "reduce restaurant employment in the first year" (RR = 0.99).', 'affirmative fragment of a null result')
push('negated', 'recommender', 'The baseline "improve calibration after temperature scaling" (OR = 1.04).', 'affirmative fragment of a null result')
push('negated', 'canopy', 'Tree planting "lower surface temperature in the parking-lot trial" (OR = 0.94).', 'affirmative fragment of a null result')
push('negated', 'sorghum', 'The sorghum line "increase grain protein content in the replicated field trial" (OR = 1.02).', 'affirmative fragment of a null result')
push('negated', 'vocabulary', 'Spacing "increase recall of low-frequency words at the four-week test" (OR = 1.06).', 'affirmative fragment of a null result')

// ── quote-mined (5, contradicted) ───────────────────────────────────────────
push('quote-mined', 'battery', 'Capacity fade "may be associated with" electrolyte oxidation, which proves that the coating causes degradation.', 'hedge sold as causal proof')
push('quote-mined', 'coral', 'Survival "could be linked to shading and wave exposure", so shading demonstrates control of survival.', 'hedge sold as demonstration')
push('quote-mined', 'minimumWage', 'The employment change "might reflect" seasonal migration, so the estimates confirm a policy effect.', 'hedge sold as confirmation')
push('quote-mined', 'recommender', 'Diversity "may be associated with the reranking strength", and the ablation confirms that diversity causes stronger reranking.', 'hedge sold as confirmation')
push('quote-mined', 'canopy', 'Cooling "seems tied to canopy density" proves that tree canopy causes cooler streets.', 'associational sentence sold as causal proof')

// ── insufficient (5, insufficient) ──────────────────────────────────────────
push('insufficient', 'battery', 'The cells passed a 1,000-cycle safety test at 60 °C.', 'the source does not report a safety test at 60 °C')
push('insufficient', 'coral', 'The coral nursery reduced restoration costs by 25%.', 'the source does not mention costs')
push('insufficient', 'minimumWage', 'The county policy reduced restaurant closures.', 'the source does not mention closures')
push('insufficient', 'canopy', 'The canopy program lowered household energy bills.', 'the source does not mention energy bills')
push('insufficient', 'vocabulary', 'Retrieval practice improved vocabulary recall for students with dyslexia.', 'the source does not mention dyslexia')

// ── checks ──────────────────────────────────────────────────────────────────
const fail = message => {
  console.error(`generate-claims-holdout: ${message}`)
  process.exit(1)
}
const sha256 = text => createHash(HASH_ALGORITHM).update(text, 'utf8').digest('hex')
const sentencesOf = text => text.trim().split(/(?<=[.!?])\s+/u).filter(sentence => sentence !== '')

if (cases.length !== 50) fail(`expected 50 cases, built ${cases.length}`)
const claimSet = new Set(cases.map(item => item.claim))
if (claimSet.size !== cases.length) fail('duplicate claim text in the held-out set')
const sourceKeys = Object.keys(SOURCES)
if (sourceKeys.length < 5 || sourceKeys.length > 8) fail(`expected 5-8 sources, found ${sourceKeys.length}`)
for (const [key, source] of Object.entries(SOURCES)) {
  const sentenceCount = sentencesOf(source).length
  if (sentenceCount < 3 || sentenceCount > 4) fail(`source ${key} has ${sentenceCount} sentences, expected 3-4`)
}

const byCategory = {}
const byVerdict = {}
for (const item of cases) {
  byCategory[item.category] = (byCategory[item.category] ?? 0) + 1
  byVerdict[item.expected.verdict] = (byVerdict[item.expected.verdict] ?? 0) + 1
}
for (const [category, expected] of Object.entries(EXPECTED_COUNTS)) {
  if (byCategory[category] !== expected) fail(`category ${category}: expected ${expected}, found ${String(byCategory[category])}`)
}

// No source paragraph or claim may be reused from the regression baseline.
const baselinePath = path.join(root, 'data', 'claims', 'cases.jsonl')
if (existsSync(baselinePath)) {
  const baselineCases = readFileSync(baselinePath, 'utf8')
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => JSON.parse(line))
  const baselineClaims = new Set(baselineCases.map(item => item.claim))
  const baselineSources = new Set(baselineCases.map(item => item.source))
  for (const item of cases) {
    if (baselineClaims.has(item.claim)) fail(`claim reused from data/claims: ${item.id}`)
    if (baselineSources.has(item.source)) fail(`source reused from data/claims: ${item.id}`)
  }
}

const sentenceCount = sourceKeys.reduce((total, key) => total + sentencesOf(SOURCES[key]).length, 0)
const casesText = `${cases.map(item => JSON.stringify(item)).join('\n')}\n`
const caseSha256 = sha256(casesText)
const summary = {
  dataset: 'claims-heldout',
  version: '0.1.0',
  heldOut: true,
  frozen: true,
  frozenAt: FROZEN_DATE,
  hashAlgorithm: HASH_ALGORITHM,
  caseSha256,
  total: cases.length,
  byCategory,
  byVerdict,
  labelSpace: { verdict: ['verified', 'unverified', 'insufficient', 'contradicted', 'disproven'] },
  synthetic: true,
  sourceCount: sourceKeys.length,
  sourceSentenceCount: sentenceCount,
  sourceTopics: sourceKeys,
  authoredFrom: 'rubric/CLAIMS.md',
  independence: 'Written by the same rubric author as data/claims and frozen before the first evaluation run; a temporal hold-out, not a fully blind external set.',
  note: 'Seven new synthetic sources; labels follow the category rule in rubric/CLAIMS.md and were frozen before any plugin prediction. Paraphrases are labelled insufficient by design: v0.1 claim checking is byte-level and does not do semantics.',
}
const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://raw.githubusercontent.com/PerryLink/dsh-research-bench/main/data/claims-heldout/schema.json',
  title: 'Held-out claim-support benchmark case',
  description: 'One frozen held-out claim case; the category fixes the expected verdict.',
  type: 'object',
  additionalProperties: false,
  required: ['id', 'category', 'claim', 'source', 'expected'],
  properties: {
    id: { type: 'string', pattern: '^claim-[0-9]{4}$' },
    category: { enum: Object.keys(CATEGORY_VERDICT) },
    claim: { type: 'string', minLength: 1, maxLength: 2000 },
    source: { type: 'string', minLength: 1, maxLength: 4000 },
    description: { type: 'string', maxLength: 500 },
    expected: {
      type: 'object',
      additionalProperties: false,
      required: ['verdict'],
      properties: { verdict: { enum: ['verified', 'unverified', 'insufficient', 'contradicted', 'disproven'] } },
    },
  },
  allOf: Object.entries(CATEGORY_VERDICT).map(([category, verdict]) => ({
    if: { properties: { category: { const: category } }, required: ['category'] },
    then: { properties: { expected: { properties: { verdict: { const: verdict } }, required: ['verdict'] } } },
  })),
}
const schemaText = `${JSON.stringify(schema, null, 2)}\n`
const summaryText = `${JSON.stringify(summary, null, 2)}\n`

// ── freeze guard ────────────────────────────────────────────────────────────
const refreeze = process.argv.slice(2).includes('--refreeze')
if (existsSync(summaryPath)) {
  const existingSummary = JSON.parse(readFileSync(summaryPath, 'utf8'))
  if (existingSummary.frozen === true) {
    if (!existsSync(casesPath)) fail('SUMMARY.json is frozen but data/claims-heldout/cases.jsonl is missing')
    const existingCasesText = readFileSync(casesPath, 'utf8')
    const existingSha256 = sha256(existingCasesText)
    if (existingSummary.caseSha256 !== existingSha256) {
      fail('frozen SUMMARY.json hash does not match cases.jsonl; restore the frozen cases or use --refreeze deliberately')
    }
    if (existingCasesText !== casesText && !refreeze) {
      fail('refusing to change an already-frozen held-out set; the generated cases differ. Use --refreeze only before the first evaluation run.')
    }
    if (existingCasesText !== casesText) {
      console.warn('generate-claims-holdout: WARNING: --refreeze replaces a frozen case set; this is only legitimate before evaluation.')
    }
  }
} else if (existsSync(casesPath) && !refreeze) {
  fail('data/claims-heldout/cases.jsonl exists without a frozen SUMMARY.json; use --refreeze to adopt it deliberately')
}

mkdirSync(outDir, { recursive: true })
writeFileSync(casesPath, casesText, 'utf8')
writeFileSync(schemaPath, schemaText, 'utf8')
writeFileSync(summaryPath, summaryText, 'utf8')

console.log(`claims-heldout: ${cases.length} cases -> data/claims-heldout/cases.jsonl`)
console.log(`sources: ${sourceKeys.length} (${sentenceCount} sentences)`)
console.log(`frozen: ${FROZEN_DATE} ${HASH_ALGORITHM}:${caseSha256}`)
console.log(JSON.stringify(byCategory), JSON.stringify(byVerdict))
