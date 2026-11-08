# Statistics benchmark — rubric (frozen for v0.1.0)

## What a case contains

- `text` — one synthetic sentence reporting a statistic and a p value.
- `expected.verdict` — `consistent` or `inconsistent`.
- `expected.issue` — `p-value`, `p-threshold`, `ci`, `format` or `df` for inconsistent cases; `null` otherwise.

## Ground truth

Critical values come from published tables: at the .05 (or .01) critical value,
the two-tailed probability for t/r/z and the upper-tail probability for F/χ²
equals .05 (.01). Consistent cases report exactly that probability. Inconsistent
cases change exactly one element:

| Issue | Construction |
|---|---|
| `p-value` | reported p differs from the recomputed p beyond rounding |
| `p-threshold` | `p < X` reported although the recomputed p is ≥ X |
| `ci` | p is significant at .05 but the reported 95% CI includes 0 |
| `format` | `p = .000` (an exact zero cannot follow from a finite statistic) or `p > 1` |
| `df` | degrees of freedom outside the distribution's domain |

## Rounding rule

A reported `p = x` is consistent when `|recomputed − x| ≤ 0.5 × 10^-decimals +
0.001`. The extra 0.001 absorbs the fact that the statistic itself is reported
rounded (e.g. `t = 2.50`, p ≈ .01855, reported .019).

## Metrics

- **Inconsistent detection**: TP/FP/FN over `verdict == inconsistent`; precision, recall, F1.
- **Clean false-positive rate**: share of `consistent` cases predicted inconsistent.
- **Issue accuracy when flagged**: share of true positives whose `issue` matches.
- **Exact accuracy**: verdict matches and, for inconsistent cases, the issue matches too.

An `unparsed` prediction counts as "not flagged" (a missed detection for an
inconsistent case, and not a false positive for a consistent one).

## Known biases

- Sentences are clean English with one statistic each; spacing variants and
  adjacent statistics are barely exercised.
- Only two-tailed t/r/z and upper-tail F/χ² conventions are represented.
- Fractional Welch df, one-sided reports and multi-model tables are absent.
- The dataset is small (30) and balanced by construction.
