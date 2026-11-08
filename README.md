# dsh-research-bench

**Open, synthetic, frozen benchmarks for the DSH research plugin family.**

*Data + rubric + a scoring contract — not a plugin. A detector's README may only quote numbers produced by this repository.*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

English · [简体中文](README-zh.md)

---

## Why this exists

Every plugin in the family claims to *verify* something. A claim without a measurement is marketing, so:

- the datasets are **synthetic and frozen** (no copyrighted PDFs, no personal data, no scraped corpora);
- the labels come from a **generator's rubric**, never from a plugin's output;
- every plugin that wants to publish accuracy must ship an **adapter** that reads these files and prints a confusion matrix;
- numbers in a plugin README must name the dataset version and the exact command.

## Datasets

| Dataset | Cases | Status | Consumer |
|---|---:|---|---|
| `data/citations` | **100** | ✅ frozen | `dsh-cite-verify` |
| `data/stats` | **30** | ✅ frozen | `dsh-statcheck` |
| `data/claims` | **50** | ✅ frozen | `dsh-claim-check` |
| `data/repro` | 10 | 🚧 with `dsh-repro-audit` (W2) | `dsh-repro-audit` |
| `data/manuscripts` | 10 | 🚧 with `dsh-manuscript-check` (W3) | `dsh-manuscript-check` |
| `data/figures` | 100 pairs | 🚧 with `dsh-image-integrity` (W4) | `dsh-image-integrity` |

### `data/claims` (v0.1.0, frozen)

50 claims over five synthetic paragraphs: 15 supported (`verified`), 10
paraphrases (**`insufficient` by design** — v0.1 does not do semantics), 8
number-wrong (`disproven`), 7 negation-flips and 5 quote-mines (`contradicted`),
5 absent-content (`insufficient`). Schema:
[`schema/claim-case.schema.json`](schema/claim-case.schema.json); rules and the
validity caveat: [`rubric/CLAIMS.md`](rubric/CLAIMS.md).

> **Validity caveat.** The v0.1 claim cases were written from the same rubric as
> `dsh-claim-check`'s rules and one rule was corrected after a supported case
> failed. The 1.0 numbers on this set are a **regression baseline, not an
> unbiased estimate** of real-manuscript accuracy. A held-out set authored
> without reference to the implementation is still planned.

### `data/stats` (v0.1.0, frozen)

30 synthetic sentences around published critical values: 10 consistent (the
reported p is the probability that the reported critical statistic corresponds
to) and 20 inconsistent (wrong p, wrong threshold, CI contradicts a significant
p, `p = .000`, `p > 1`). Labels come from the critical-value tables — not from
the plugin. Format: [`schema/stat-case.schema.json`](schema/stat-case.schema.json);
rules: [`rubric/STATS.md`](rubric/STATS.md).

### `data/citations` (v0.1.0, frozen)

100 cases, eight categories, each with the **frozen provider responses** the plugin would have received:

| Category | Cases | What is wrong |
|---|---:|---|
| `correct` | 30 | nothing — must not be flagged |
| `wrong-author` | 20 | first author altered / extra author cited |
| `wrong-year` | 15 | year off by 1, 2 or 10 years |
| `wrong-doi` | 15 | 8 unresolvable DOIs, 7 DOIs pointing at a different work |
| `retracted` | 8 | the record carries a retraction notice |
| `correction` | 6 | the record carries a correction notice |
| `preprint` | 4 | arXiv + published DOI agree |
| `disagreement` | 2 | PubMed and Crossref titles disagree |

Every work, DOI (`10.5555/...`), author and venue is **fictional**. The fixture responses are constructed by the generator, so the benchmark measures a plugin's *checking logic*, not the availability of Crossref.

Format: one JSON object per line, schema in [`schema/citation-case.schema.json`](schema/citation-case.schema.json). See [`rubric/CITATIONS.md`](rubric/CITATIONS.md) for label definitions and the metric contract.

## Scoring contract

A plugin adapter is a script in the plugin repository that:

1. Reads `cases.jsonl` (path from `BENCH_DIR`, else `../dsh-research-bench`).
2. Runs the plugin's own pipeline against the case's frozen provider fixtures (no network).
3. Produces, per case, a prediction:
   ```json
   { "exists": true, "mismatch_fields": ["title"], "update_notice": false }
   ```
4. Computes the metrics below and writes a JSON report plus a Markdown table.

### Metrics (micro-averaged)

| Metric | Definition |
|---|---|
| existence precision / recall | predicted `exists=false` vs labelled `exists=false` |
| field precision / recall / F1 | over `(case, field)` pairs in `mismatch_fields` |
| update-notice precision / recall | over `update_notice` |
| clean false-positive rate | share of `correct` cases with any flagged field, `update_notice`, or a `not_found` verdict |
| case exact match | share of cases where existence **and** the field set **and** the notice flag all match |

A plugin README must report all of the above (or explicitly state which it does not report and why), with the dataset version and the command that produced them.

## Reproduce

```sh
npm run generate        # deterministic; rewrites data/citations, data/stats and data/claims
npm run validate        # structure + counts + categories + label space + SUMMARY agreement
```

CI runs both and fails if regeneration changes a committed file — the dataset cannot silently drift.

## Licensing and provenance

- Code and data: Apache-2.0.
- No third-party corpus, no paper PDFs, no real citations, no personal data.
- Provider responses are synthetic fixtures shaped like the real APIs; they are **not** recorded from the live services and must never be presented as evidence about a real paper.

## Limitations

- Synthetic works have clean, English, well-formed metadata; real bibliographies contain transliteration, name particles, superscripts and venue abbreviations that this set does not exercise.
- Frozen fixtures cannot catch provider-side format changes; those are covered by the plugins' own tests.
- The labels encode the rubric of *this* repository. A disagreement between a plugin and a label is a finding to review, not automatically a plugin bug.
- Citations, stats and claims are frozen at v0.1.0. The repro, manuscripts and figures datasets are still planned and will be versioned independently.
- The claims v0.1 set is a co-designed regression baseline (see the caveat above); it is not a held-out test set.

## Versioning

`0.x` while datasets are being added. A dataset version (`dataset`, `version`, `total`) lives in each `SUMMARY.json`; changing labels or cases for a frozen dataset requires a version bump and a note in [`CHANGELOG.md`](CHANGELOG.md).
