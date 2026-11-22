# makefun-csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/willdinata/makefun-csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/willdinata/makefun-csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A fast drop-in replacement for make.fun's csv-reader 1.0.0. `solve.js` exports `run(input)`, which returns
csv-reader's exact reading of a case's `{text, header}` — `{columns, rows, errors}` — with every quirk of
its broken-row policy kept: the dropped BOM, stray CRs dropped outside quotes, CR and CRLF inside quotes
read as LF, doubled quotes, junk after a closing quote appended as it stands, a quote that never closes
read again as an unquoted field, and short/long rows padded or cut to the first record's width with their
`short_row` / `long_row` records. Where csv-reader walks one character at a time and builds each field a
character at a time, this reader scans each run of ordinary characters in one tight loop and cuts the
field out of the text with a single slice; only a field that actually meets a stray CR, an escaped quote
or a CR inside quotes is assembled from pieces. The readings are the same; only the walking differs.
`main.ts` is the harness driver: it reads every case from `/input/cases.json`, answers each with `run`,
and writes `/output/answers.json`.

## Run

Requires Node 22. No dependencies; nothing to install.

```sh
MAKEFUN_INPUT_DIR=practice/input MAKEFUN_OUTPUT_DIR=out node main.ts
```

The default directories are `/input` and `/output`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=63p7zf8z&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards.</sub>
