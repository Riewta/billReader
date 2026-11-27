# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

SlipSense: reads Thai bank-transfer slips (OCR) → parses fields → (later) categorizes and shows an expense dashboard. Currently in **Phase 1**: comparing OCR engines and building a baseline parser, measured per field on a hand-labeled slip set. `api/` and `web/` are Phase 2 placeholders (FastAPI, Next.js PWA).

The owner writes in Thai and wants answers in Thai, with the *reasoning* behind each decision explained, one phase at a time. Code comments and docstrings are in Thai.

## Commands

macOS has no `python` command. The venv lives **outside the repo** at `~/.venvs/billreader` (create: `python3 -m venv ~/.venvs/billreader && ~/.venvs/billreader/bin/pip install -e "ml[dev]"`). Don't create it inside the repo: the repo is on iCloud-synced Desktop, which sets the `hidden` flag on files under `.venv/`, and Python 3.13 skips hidden `.pth` files, so the editable install stops importing (`ModuleNotFoundError`). Run everything from the repo root.

```bash
~/.venvs/billreader/bin/python -m pytest -q                                   # all tests (pytest.ini sets pythonpath=ml)
~/.venvs/billreader/bin/python -m pytest tests/test_parser.py::test_kbank_all_fields -q   # single test
~/.venvs/billreader/bin/python -m slipsense_ml.eval.validate_labels [--assign-splits]     # check data/labels.jsonl
~/.venvs/billreader/bin/python -m slipsense_ml.eval.run_ocr --engine tesseract            # stage 1: OCR → data/ocr_cache/<engine>/<id>.json
~/.venvs/billreader/bin/python -m slipsense_ml.eval.run_qr                               # stage 1b: QR payloads → data/ocr_cache/_qr/ (needs extra `qr`)
~/.venvs/billreader/bin/python -m slipsense_ml.eval.score --engines tesseract easyocr     # stage 2: parse + score (dev split by default; adds <engine>+qr tables if _qr cache exists)
```

OCR engines and QR decoding are optional extras in `ml/pyproject.toml` (`tesseract`, `easyocr`, `paddle`, `typhoon`, `gcv`, `qr`); install only what you run. PaddleOCR may need Python 3.11/3.12. CI (`.github/workflows/ci.yml`) only installs pytest: core code (`schema`, `parsing`, `eval`) must stay **stdlib-only**.

## Architecture

Package `ml/slipsense_ml/`; Phase 2 API is meant to import it directly.

- `schema.py`: shared contract. `SlipFields` (bank, amount as `Decimal`, paid_at Gregorian at minute precision, receiver_name, ref) and `OCRResult` (text, lines, latency). `FIELDS` drives metrics and tables.
- `ocr/`: adapter pattern. Every engine exposes `run(path) -> OCRResult` plus `is_cloud` and `cost_per_1k_usd`. `ENGINES` maps names to classes and imports lazily, so heavy deps load only when used. `_group_by_row` merges boxes on the same y-line, because parsers rely on label and value sharing a line.
- `parsing/`: `normalize.py` handles Thai digits, `ํา`→`ำ`, month abbreviations with or without dots, Buddhist-era years (2-digit ≥60 means BE). `parser.py` = generic labels + per-bank `BankTemplate` overrides, anchored on labels rather than line positions. `detect_bank` picks the bank keyword that appears *earliest* (the sender/app is at the top). The per-bank labels in `TEMPLATES` are unverified guesses until real slips are benchmarked.
- `parsing/qr.py` (stdlib): slip QR payload is TLV `00{00 06 000001, 01 03 <bank code>, 02 nn <ref>} 51 02 TH 91 04 <CRC16>`. CRC is checked, so a decoded ref is exact; `parse_slip(text, qr_payload)` takes ref and bank from QR over OCR. Image decoding (`ocr/qr_image.py`, opencv) stays outside core.
- Confidence: `parse_slip_detailed` returns `ParsedSlip(fields, confident, source)` matching `FieldValue` in `web/src/lib/types.ts`. Rule: unconfident-and-wrong is fine, confident-and-wrong is not. `score` prints a calibration table (precision when confident + coverage); `errors_*.jsonl` marks `"confident": true` misses, which are the ones to fix first. Bank/ref from OCR are never confident. When running `python -m` from a git worktree, set `PYTHONPATH=ml`, or the editable install imports the main checkout's code.
- Receiver on K+/make has no label: it is the first name-like line after the first masked account line (`xxx-x-x1234-x`). `normalize_text` keeps runs of spaces as two spaces so `_clean_name` can split off Tesseract column junk; EasyOCR output has Latin text lowercased.
- `eval/`: two-stage pipeline. `run_ocr` caches raw OCR, so parser iterations never re-run OCR. `score` scores each field at two levels: **OCR recall** (does the gold value appear in the OCR text) and **end-to-end accuracy** (parser output == label). High recall with low e2e accuracy means a parser bug. Names use fuzzy matching (≥0.85, prefix-stripped); a gold field of `null` is excluded from the denominator.

## Data rules (important)

- Real slips (`data/raw/`), `data/labels.jsonl`, `data/*.bak` and `data/ocr_cache/` are gitignored and must never be committed. Only `labels.example.jsonl` (fake data) and aggregate `results/` are committed. Label format: `data/README.md`.
- **dev/test split**: tune the parser only on `dev`. `score` defaults to `--split dev` and writes `results/errors_<engine>.jsonl` only for dev. Never read test-set errors, and never move a slip from `test` to `dev`. `assign_splits` is stratified per bank, uses a hash of the id (stable), and never touches existing splits. A slip with no `split` is *unassigned*, not dev: `score` refuses to run until every slip has one, because looking at errors before splitting would let already-seen slips land in test.
- Cloud engines skip slips with `"cloud_ok": false` (owner did not consent to sending the image off-device).
- `amount` in labels is a string (`"150.00"`) to avoid float.

## Git workflow

Short-lived branches with an area prefix (`data/…`, `ml/…`, `design/…`, `frontend/…`, `api/…`, `infra/…`, `docs/…`) off `main` → PR into `main` (CI must pass) → squash-merge → delete branch → rebase other open branches. `gh` is installed and authenticated.
