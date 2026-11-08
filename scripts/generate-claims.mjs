// Deterministic claim-support benchmark generator.
//
// Five synthetic source paragraphs; 50 claims labelled by category. Ground truth
// is the category rule below, never a plugin's output:
//   supported   -> verified      (verbatim span + numbers agree)
//   paraphrase  -> insufficient  (no verbatim span: v0.1 does not do semantics)
//   number-wrong-> disproven     (a labelled value contradicts the source)
//   negated     -> contradicted  (a negation-flip of the cited sentence)
//   quote-mined -> contradicted  (a hedged sentence sold as a causal result)
//   insufficient-> insufficient  (the source says nothing about it)
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'data', 'claims')
mkdirSync(outDir, { recursive: true })

const S1 = 'In this synthetic trial the treatment group improved (t(28) = 2.50, p = .018), with a standardized effect of d = 0.45.'
const S2 = 'The intervention did not reduce readmission rates (OR = 0.98, 95% CI [0.72, 1.33]).'
const S3 = 'Symptoms may be associated with sleep quality, but the evidence is preliminary.'
const S4 = 'There was no significant difference between groups (p = .62).'
const S5 = 'The authors report that the effect was not significant after adjustment for baseline (p = .09).'

const cases = []
let sequence = 0
const push = (category, verdict, claim, source, description) => {
  sequence += 1
  cases.push({
    id: `claim-${String(sequence).padStart(4, '0')}`,
    category,
    claim,
    source,
    expected: { verdict },
    description,
  })
}

// ── supported (15, verified) ────────────────────────────────────────────────
push('supported', 'verified', 'The trial reports "the treatment group improved (t(28) = 2.50, p = .018)".', S1, 'verbatim span with matching statistics')
push('supported', 'verified', 'The trial reports "a standardized effect of d = 0.45".', S1, 'verbatim span with a matching labelled value')
push('supported', 'verified', 'The trial reports "the treatment group improved" with t(28) = 2.50.', S1, 'verbatim span plus a matching labelled value')
push('supported', 'verified', 'The study reports "did not reduce readmission rates (OR = 0.98, 95% CI [0.72, 1.33])".', S2, 'verbatim negative result with matching numbers')
push('supported', 'verified', 'The study reports an OR of 0.98 ("95% CI [0.72, 1.33]").', S2, 'quoted interval does not assert a direction')
push('supported', 'verified', 'The study reports "did not reduce readmission rates".', S2, 'verbatim negative fragment')
push('supported', 'verified', 'The authors note that symptoms "may be associated with sleep quality".', S3, 'verbatim hedged fragment without overclaiming')
push('supported', 'verified', 'The evidence is described as "preliminary".', S3, 'verbatim hedge')
push('supported', 'verified', 'Symptoms "may be associated with sleep quality".', S3, 'verbatim associational fragment')
push('supported', 'verified', 'The authors report "no significant difference between groups (p = .62)".', S4, 'verbatim null result with matching p')
push('supported', 'verified', 'The result was "no significant difference between groups".', S4, 'verbatim null fragment')
push('supported', 'verified', 'The authors report "p = .62".', S4, 'verbatim labelled value')
push('supported', 'verified', 'The authors report "not significant after adjustment for baseline (p = .09)".', S5, 'verbatim adjusted null result')
push('supported', 'verified', 'The adjusted analysis was "not significant after adjustment for baseline".', S5, 'verbatim adjusted fragment')
push('supported', 'verified', 'The report gives "p = .09".', S5, 'verbatim labelled value without direction words')

// ── paraphrase (10, insufficient) ───────────────────────────────────────────
push('paraphrase', 'insufficient', 'Treatment improved outcomes with an effect size of 0.45.', S1, 'paraphrase with a number but no verbatim span')
push('paraphrase', 'insufficient', 'The trial found a significant effect.', S1, 'paraphrase without a verbatim span')
push('paraphrase', 'insufficient', 'Readmission rates were unaffected by the intervention (OR = 0.98).', S2, 'paraphrase with a number')
push('paraphrase', 'insufficient', 'The intervention showed no benefit.', S2, 'paraphrase of a negative result')
push('paraphrase', 'insufficient', 'Sleep quality and symptoms are related.', S3, 'paraphrase of an association')
push('paraphrase', 'insufficient', 'The evidence about sleep quality is limited.', S3, 'paraphrase of a hedge')
push('paraphrase', 'insufficient', 'The groups did not differ (p = .62).', S4, 'paraphrase with a number')
push('paraphrase', 'insufficient', 'There was no difference between the groups.', S4, 'paraphrase of a null result')
push('paraphrase', 'insufficient', 'The effect disappeared after adjustment (p = .09).', S5, 'paraphrase with a number')
push('paraphrase', 'insufficient', 'Adjustment removed the effect.', S5, 'paraphrase without a verbatim span')

// ── number-wrong (8, disproven) ─────────────────────────────────────────────
push('number-wrong', 'disproven', 'The trial reports "the treatment group improved (t(28) = 2.50, p = .018)" and d = 0.80.', S1, 'correct quote, contradicted effect size')
push('number-wrong', 'disproven', 'The trial reports "the treatment group improved (t(28) = 2.50, p = .018)" with t(28) = 3.10.', S1, 'correct quote, contradicted t value')
push('number-wrong', 'disproven', 'The trial reports "the treatment group improved (t(28) = 2.50, p = .018)" with p = .040.', S1, 'correct quote, contradicted p value')
push('number-wrong', 'disproven', 'The study reports "did not reduce readmission rates (OR = 0.98, 95% CI [0.72, 1.33])" with OR = 1.50.', S2, 'correct quote, contradicted odds ratio')
push('number-wrong', 'disproven', 'The study reports "did not reduce readmission rates" with OR = 1.50.', S2, 'verbatim fragment, contradicted odds ratio')
push('number-wrong', 'disproven', 'The authors report "no significant difference between groups (p = .62)" with p = .01.', S4, 'correct quote, contradicted p value')
push('number-wrong', 'disproven', 'The authors report "no significant difference between groups" with p = .01.', S4, 'verbatim fragment, contradicted p value')
push('number-wrong', 'disproven', 'The authors report "not significant after adjustment for baseline (p = .09)" with p = .30.', S5, 'correct quote, contradicted p value')

// ── negated (7, contradicted) ───────────────────────────────────────────────
push('negated', 'contradicted', 'The intervention "reduce readmission rates" (OR = 0.98).', S2, 'affirmative claim built on a negated sentence')
push('negated', 'contradicted', 'The intervention "reduce readmission rates".', S2, 'affirmative fragment from a negated sentence')
push('negated', 'contradicted', 'The study shows the intervention "reduce readmission rates" is effective (OR = 0.98).', S2, 'explicit effectiveness claim on a null result')
push('negated', 'contradicted', 'The authors found a "significant difference between groups" (p = .62).', S4, 'affirmative fragment from a null result')
push('negated', 'contradicted', 'The authors found a "significant difference between groups".', S4, 'affirmative fragment from a null result')
push('negated', 'contradicted', 'The effect was "significant after adjustment for baseline" (p = .09).', S5, 'affirmative fragment from an adjusted null result')
push('negated', 'contradicted', 'The effect was "significant after adjustment for baseline".', S5, 'affirmative fragment from an adjusted null result')

// ── quote-mined (5, contradicted) ───────────────────────────────────────────
push('quote-mined', 'contradicted', 'Sleep quality "associated with sleep quality" proves that symptoms have a cause.', S3, 'hedged fragment sold as causal')
push('quote-mined', 'contradicted', 'The data "may be associated with sleep quality" demonstrates a causal pathway.', S3, 'hedge sold as demonstration')
push('quote-mined', 'contradicted', 'Symptoms "associated with sleep quality" confirms the mechanism.', S3, 'association sold as mechanism')
push('quote-mined', 'contradicted', 'The evidence "may be associated with sleep quality" proves causation.', S3, 'hedge sold as proof')
push('quote-mined', 'contradicted', 'Sleep and symptoms are "associated" proves the link.', S3, 'association sold as proof')

// ── insufficient (5) ───────────────────────────────────────────────────────
push('insufficient', 'insufficient', 'The trial reduced mortality at 12 months.', S1, 'the source does not mention mortality')
push('insufficient', 'insufficient', 'The intervention lowered costs by 30%.', S2, 'the source does not mention costs')
push('insufficient', 'insufficient', 'Sleep quality improved after treatment.', S3, 'the source does not test treatment on sleep')
push('insufficient', 'insufficient', 'The effect remained significant at follow-up.', S5, 'the source has no follow-up analysis')
push('insufficient', 'insufficient', 'Adverse events were rare.', S4, 'the source does not report adverse events')

const byCategory = {}
const byVerdict = {}
for (const item of cases) {
  byCategory[item.category] = (byCategory[item.category] ?? 0) + 1
  byVerdict[item.expected.verdict] = (byVerdict[item.expected.verdict] ?? 0) + 1
}
const summary = {
  dataset: 'claims',
  version: '0.1.0',
  generatedAt: '2026-11-08',
  total: cases.length,
  byCategory,
  byVerdict,
  labelSpace: { verdict: ['verified', 'unverified', 'insufficient', 'contradicted', 'disproven'] },
  synthetic: true,
  note: 'Five synthetic sources; labels follow the category rule in rubric/CLAIMS.md. Paraphrases are labelled insufficient by design: v0.1 claim checking is byte-level and does not do semantics.',
}

writeFileSync(path.join(outDir, 'cases.jsonl'), `${cases.map(item => JSON.stringify(item)).join('\n')}\n`, 'utf8')
writeFileSync(path.join(outDir, 'SUMMARY.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
console.log(`claims: ${cases.length} cases -> data/claims/cases.jsonl`)
console.log(JSON.stringify(byCategory), JSON.stringify(byVerdict))
