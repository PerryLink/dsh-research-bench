# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- CI now regenerates citations, stats and claims before the drift check (it
  previously regenerated only citations, so stats/claims drift was invisible).
- `scripts/validate.mjs` now requires all three frozen datasets, validates
  counts, categories, fields, SUMMARY totals/count maps and the claim
  category→verdict rule; a missing dataset fails instead of passing as zero.
- DATASET-CARD/README no longer claim stats is planned or that only citations
  are frozen; they record that claims v0.1 is a co-designed regression
  baseline, not an unbiased held-out set.

## [0.1.0] - 2026-11-08

### Added

- `data/citations` v0.1.0: 100 synthetic cases across 8 categories, each with
  frozen Crossref/PubMed/arXiv provider responses; generator, JSON Schema,
  rubric, deterministic regeneration and a validator.
- Scoring contract (existence, field, update-notice, clean FPR, exact match)
  that plugin adapters implement.
- CI check that regeneration does not change committed data.

- `data/stats` v0.1.0: 30 synthetic sentences around published critical values
  (10 consistent, 20 inconsistent) with labels from the critical-value tables;
  generator, schema, rubric and validator coverage.
- `data/claims` v0.1.0: 50 labelled claim/source pairs across six construction
  categories; generator, schema, rubric and validator coverage. The set is a
  co-designed regression baseline (see the rubric's validity caveat).

### Notes

- All works/DOIs/venues are fictional; provider responses are constructed
  fixtures, not recordings.
- Remaining datasets (repro, manuscripts, figures) ship with their consumer
  plugins.
