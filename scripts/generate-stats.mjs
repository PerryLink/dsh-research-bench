// Deterministic statistics benchmark generator.
//
// Ground truth comes from published critical-value tables, not from the plugin:
// at the .05 critical value the two-tailed (t/r/z) or upper-tail (F/chi-square)
// probability is .05. Cases are synthetic sentences; no manuscript is copied.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'data', 'stats')
mkdirSync(outDir, { recursive: true })

const cases = []
let sequence = 0
const push = (verdict, issue, text) => {
  sequence += 1
  cases.push({ id: `stat-${String(sequence).padStart(4, '0')}`, text: `Results: ${text}.`, expected: { verdict, issue } })
}

// ── 10 consistent ────────────────────────────────────────────────────────────
// Each statistic below is the published .05 (or .01) critical value; the reported
// p is the probability that value corresponds to.
push('consistent', null, 'The effect was significant, t(28) = 2.048, p = .050')
push('consistent', null, 'A second sample replicated it, t(10) = 2.228, p = .050')
push('consistent', null, 'A larger sample agreed, t(60) = 2.000, p = .050')
push('consistent', null, 'The omnibus test was significant, F(2, 27) = 3.354, p = .050')
push('consistent', null, 'The one-way test was significant, F(1, 30) = 4.171, p = .050')
push('consistent', null, 'The association was significant, χ²(1) = 3.841, p = .050')
push('consistent', null, 'The three-level test was significant, χ²(2) = 5.991, p = .050')
push('consistent', null, 'The correlation was significant, r(28) = .361, p = .050')
push('consistent', null, 'The standardized difference was significant, z = 1.960, p = .050')
push('consistent', null, 'The effect was significant, t(28) = 2.500, p = .019')

// ── 20 inconsistent ──────────────────────────────────────────────────────────
push('inconsistent', 'p-value', 'The effect was significant, t(28) = 2.048, p = .010')
push('inconsistent', 'p-value', 'The effect was significant, t(10) = 2.228, p = .001')
push('inconsistent', 'p-value', 'The omnibus test was significant, F(2, 27) = 3.354, p = .010')
push('inconsistent', 'p-value', 'The association was significant, χ²(1) = 3.841, p = .010')
push('inconsistent', 'p-value', 'The correlation was significant, r(28) = .361, p = .010')
push('inconsistent', 'p-value', 'The standardized difference was significant, z = 1.960, p = .010')
push('inconsistent', 'p-value', 'The effect was significant, t(28) = 2.500, p = .050')
push('inconsistent', 'p-value', 'The three-group test was significant, F(3, 40) = 2.84, p = .010')
push('inconsistent', 'p-value', 'The four-level test was significant, χ²(3) = 7.815, p = .010')
push('inconsistent', 'p-value', 'The correlation was significant, r(40) = .304, p = .010')
push('inconsistent', 'p-value', 'A null effect was reported as significant, z = 0.500, p = .050')
push('inconsistent', 'p-value', 'A null effect was reported as significant, t(28) = 0.500, p = .010')
push('inconsistent', 'p-value', 'A null effect was reported as significant, F(2, 27) = 1.000, p = .010')
push('inconsistent', 'p-value', 'A null effect was reported as significant, χ²(1) = 1.000, p = .010')
push('inconsistent', 'ci', 'The effect was significant, t(28) = 2.200, p = .036, 95% CI [-0.10, 0.80]')
push('inconsistent', 'ci', 'The effect was significant, t(28) = 2.500, p = .019, 95% CI [-0.05, 0.85]')
push('inconsistent', 'p-value', 'The association was significant, χ²(1) = 3.841, p = .500')
push('inconsistent', 'format', 'The effect was significant, t(28) = 2.048, p = .000')
push('inconsistent', 'format', 'The effect was significant, F(2, 27) = 3.354, p = 1.20')
push('inconsistent', 'p-threshold', 'The effect was significant, t(28) = 2.048, p < .010')

const byVerdict = {}
const byIssue = {}
for (const item of cases) {
  byVerdict[item.expected.verdict] = (byVerdict[item.expected.verdict] ?? 0) + 1
  const issue = item.expected.issue ?? 'none'
  byIssue[issue] = (byIssue[issue] ?? 0) + 1
}
const summary = {
  dataset: 'stats',
  version: '0.1.0',
  generatedAt: '2026-11-08',
  total: cases.length,
  byVerdict,
  byIssue,
  labelSpace: { verdict: ['consistent', 'inconsistent'], issue: ['p-value', 'p-threshold', 'ci', 'format', 'df'] },
  synthetic: true,
  groundTruth: 'published critical values: at the .05 (or .01) critical value the reported probability is .05 (.01); inconsistency labels are constructed by changing exactly one thing.',
}

writeFileSync(path.join(outDir, 'cases.jsonl'), `${cases.map(item => JSON.stringify(item)).join('\n')}\n`, 'utf8')
writeFileSync(path.join(outDir, 'SUMMARY.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
console.log(`stats: ${cases.length} cases -> data/stats/cases.jsonl`)
console.log(JSON.stringify(byVerdict), JSON.stringify(byIssue))
