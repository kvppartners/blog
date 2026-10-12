# Round 2 (cloud session, 2026-10-12): raw results

Machine-generated results of the second audit round, saved as they arrived so they survive the
session. Each file is one agent's structured answer:

- `research_*.json`: research on income, GNI, reductions, residence periods (R1 GNI and asset
  baselines, R3 reductions and edge cases, R4b other F-2 codes, R6 residence periods and what each
  status implies). Each rule has a source, a Korean quote, `primary` and `confidence`.
- `verify_<slice>_<first index>.json`: verdicts on the UNVERIFIED and split-vote findings of
  `../findings.json` (confirmed / partly / refuted / unverifiable, with a corrected fix).

Caveat: the agents could only use WebSearch (WebFetch had no network), and the shared budget of
200 searches per turn ran out partway, so later agents leaned on the manual text transcribed in
`data/visadocs.yaml`. Treat `unverifiable` and low-confidence items as leads.
