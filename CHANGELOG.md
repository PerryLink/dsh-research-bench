# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-08

### Added

- `data/citations` v0.1.0: 100 synthetic cases across 8 categories, each with
  frozen Crossref/PubMed/arXiv provider responses; generator, JSON Schema,
  rubric, deterministic regeneration and a validator.
- Scoring contract (existence, field, update-notice, clean FPR, exact match)
  that plugin adapters implement.
- CI check that regeneration does not change committed data.

### Notes

- All works/DOIs/venues are fictional; provider responses are constructed
  fixtures, not recordings.
- Remaining datasets (stats, claims, repro, manuscripts, figures) ship with
  their consumer plugins.
