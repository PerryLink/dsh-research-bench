# Citation benchmark — rubric (frozen for v0.1.0)

## What a case contains

- `input` — what a user would write: identifiers (`doi`/`pmid`/`arxiv`/`bibtex`) and/or the fields as cited.
- `providers` — the **frozen** responses a provider client would receive, keyed by URL substring.
- `expected` — the ground truth from the generator:
  - `exists`: whether at least one provider has a record.
  - `mismatch_fields`: fields a correct checker must flag (`title`, `authors`, `year`, `venue`, `pages`, `version`).
  - `update_notice`: whether the resolved record carries an update notice (retraction/correction).

## Label rules

| Category | `exists` | `mismatch_fields` | `update_notice` |
|---|---|---|---|
| `correct` | true | — | false |
| `wrong-author` | true | `authors` | false |
| `wrong-year` | true | `year` | false |
| `wrong-doi` (404) | false | — | false |
| `wrong-doi` (different work) | true | `title`,`authors`,`year`,`venue` | false |
| `retracted` | true | — | true |
| `correction` | true | — | true |
| `preprint` | true | — | false |
| `disagreement` | true | `version` | false |

A plugin may report a *superset* of the expected fields only if the extra field is genuinely wrong; extra flags on `correct` cases count as false positives.

## Metric definitions (micro)

For a set of cases `C`:

- **Existence**: `TP = |{c : pred.exists=false ∧ gt.exists=false}|`, `FP = |{pred.exists=false ∧ gt.exists=true}|`, `FN = |{pred.exists=true ∧ gt.exists=false}|`; precision `TP/(TP+FP)`, recall `TP/(TP+FN)`.
- **Fields**: over pairs `(c, f)` where `f ∈ labelSpace`:
  `TP = |{(c,f) : f ∈ pred ∧ f ∈ gt}|`, `FP = |{f ∈ pred ∧ f ∉ gt}|`, `FN = |{f ∈ gt ∧ f ∉ pred}|`; report micro precision/recall/F1.
- **Update notice**: same TP/FP/FN formulas on `update_notice`.
- **Clean FPR**: `|{c ∈ correct : pred flags any field ∨ not_found ∨ update_notice}| / |correct|`.
- **Exact match**: `|{c : pred.exists = gt.exists ∧ pred.mismatch_fields = gt.mismatch_fields ∧ pred.update_notice = gt.update_notice}| / |C|`.

## Adapter obligations

1. No network: every HTTP call must be answered from the case's `providers`.
2. No tuning against this dataset: the dataset is a **test** split; plugins may not use it for development decisions. If a plugin's behavior changes, re-run and report both numbers.
3. Report the dataset version (`data/citations/SUMMARY.json`).
4. Publish the raw per-case predictions alongside the aggregate, so a reviewer can recompute.

## Known biases

- Titles are English and clean; transliteration and punctuation edge cases are absent.
- Authors are simple `Family, Given` pairs; particles and mononyms are absent.
- Year errors are coarse (±1/±2/±10); ambiguous online-first cases are absent.
- Only Crossref/PubMed/arXiv responses are represented; other providers are out of scope.
- The synthetic works are deliberately easy to distinguish, so field detection is measured on a *clean* signal — real-world precision will be lower.
