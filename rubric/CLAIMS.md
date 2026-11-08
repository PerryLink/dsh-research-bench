# Claim-support benchmark — rubric (frozen for v0.1.0)

## What a case contains

- `claim` — what an author would write, including any quoted span.
- `source` — the synthetic paragraph it cites.
- `expected.verdict` — `verified`, `insufficient`, `contradicted` or `disproven`.
- `category` — the construction rule used to build the case.

## Category rules

| Category | Cases | Verdict | Construction |
|---|---:|---|---|
| `supported` | 15 | `verified` | the claim quotes a span that occurs verbatim in the source and its numbers agree |
| `paraphrase` | 10 | `insufficient` | the claim restates the source **without a verbatim span** |
| `number-wrong` | 8 | `disproven` | a labelled value (`d`, `t`, `p`, `OR`) contradicts the source value with the same label |
| `negated` | 7 | `contradicted` | an affirmative claim is built on a fragment of a negated sentence |
| `quote-mined` | 5 | `contradicted` | a hedged/associational sentence is sold as a causal result |
| `insufficient` | 5 | `insufficient` | the source says nothing about what the claim asserts |

`paraphrase → insufficient` is a deliberate product decision: v0.1 claim checking is byte-level and must not call a paraphrase "supported". A detector that returns `verified` for a paraphrase is scored as an **over-claim**, the most costly error for this plugin.

## Metrics

- **Verdict accuracy** — exact verdict match over 50 cases.
- **Per-verdict precision / recall** — one-vs-rest for each verdict.
- **Over-claim rate** — share of non-`verified` cases predicted `verified`. Target: 0.
- **False-alarm rate on supported claims** — share of `verified` cases not predicted `verified`. Target: 0.

## Important validity caveat

The v0.1 cases were written from this rubric at the same time as the detector's
rules, and one rule (polarity only for directional quotes) was corrected after a
supported case failed. **These numbers are a regression baseline, not an
unbiased estimate of real-manuscript accuracy.** Before a public release the
plan of record is a held-out set authored without reference to the
implementation and reported separately.

## Known biases

- English, clean, one claim per paragraph.
- Quotes are explicit; indirect quotation and citation-in-parentheses are absent.
- Only four labelled types appear (`d`, `t`, `p`, `OR`); tables and multi-model
  results are absent.
- Each category is small (5–15); per-category accuracies are coarse.
