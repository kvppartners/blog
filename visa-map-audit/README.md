# Visa map audit, October 2026

An audit of `data/visamap.yaml` and `assets/js/visamap.js`, prompted by the report that the map
"makes lots of mistakes, especially when recommending next possible visa types", then extended to
cover the per-visa requirements and the F-2 / F-5 GNI income rules.

**Read `verified-by-review.md` first.** Everything in it was checked by hand against primary
sources or proven by running the engine's own logic. `findings.md` holds the machine-generated
research, most of which has not been verified yet.

## State of the work

| | |
|---|---|
| Edges in the graph | 626, across 114 visa nodes |
| Findings raised by research agents | 195 |
| ...confirmed by an independent verifier | 28 |
| ...refuted by verifiers | 2 |
| ...**not yet verified** | 165 |
| Requirements / GNI / discount research | launched, **no results saved** - it was still running |

The session ended mid-verification. The 165 unverified findings are **leads, not facts**. That
distinction is not pedantic: two confident-sounding findings were already killed by checking, and
two of my own early suspicions were wrong too (see "Checked and found correct" in
`verified-by-review.md`). The data is better than a first skim suggests, so a finding that has not
survived a source check should not be applied.

## What is solid today

From `verified-by-review.md`, in rough order of impact:

1. **TOPIK / KIIP never blocks anything.** `lang` is a hint by design, so a reader who answers
   "KIIP: none" is still offered F-5-1, F-5-16, F-2-99 and F-2-R as clickable options. KIIP 5 is an
   outright requirement for F-5-1/2/4/10/16/18/28 and F-5-6R, KIIP 4 for F-2-99, KIIP 3 for F-2-R.
2. **Nothing on the path ever grants work experience.** Only 12 of 113 visas have `gives`, and only
   D-2-1..D-2-4 grant a level. A reader who answers "0 years" and walks `NONE > E-7-1 > F-2-7` is
   still treated as having 0 years, so F-2-T stays blocked the whole way - although standing on
   F-2-7 already implies about 3 years of professional work.
3. **E-2 has no `countries` gate** although its own text restricts English instructors to 7
   countries, so the map offers E-2 to Uzbek and Russian readers.
4. **`notAfter` is dead code** - implemented in the engine, validated by the Hugo template,
   documented in the YAML header, used by no visa and no edge.
5. **The D-10 "80+ points" note is over-applied**: the floor is for notified-country nationals on
   B-1/B-2/C-1/C-3/C-4/D-3/E-9/E-10/G-1, but the data also attaches it to moves from D-4-1, D-4-2,
   D-4-6, D-4-7, D-2-5 and F-3.
6. **Unreachable statuses**: F-2-13, F-2-16, F-2-81, F-2-T1 have no in-edges, so F-5-19, F-5-22,
   F-5-28, F-5-29 and F-5-T1 can never be reached by any path. Also unreachable: D-4-2, E-6-2,
   E-7-Y, F-1, G-1-5, G-1-6, H-2.
7. **G-1 is missing the D-10-1 route** although G-1 is in the official list of statuses allowed to
   change to D-10.
8. **F-2-2 dead-ends for an adult holder** - its only next step, F-5-3, is gated `age: [0, 18]`.
9. **No duration modelling at all.** Every F-5 note states a residence period and none is checked,
   so a two-step `NONE > D-7 > F-5-1` is drawable.
10. **The systemic one**: a 25-year-old Uzbek who fills in only nationality and age sees 56 of 61
    first-visa options as valid, including F-5-5, F-5-11, F-2-7 and E-1. That is documented
    behaviour ("empty keeps all options open"), but combined with 52 of 113 visas having no gate at
    all it is the most likely source of the "lots of mistakes" impression.

The 28 verifier-confirmed findings cluster in two places: **D-8 / D-9 are badly under-connected**
(no D-8 or D-9 status offers E-7-1, F-6-1 or F-2-3; D-8-1/2/3 have almost no in-edges), and
**several statuses are missing a `gives`** so their own advertised exits are blocked for the very
readers they are for (D-2-7, D-4-3, D-7).

## How to pick this up

```sh
# refresh findings.json / findings.md from the workflow journals, including verdicts
# that arrived after this was written
ruby visa-map-audit/tools/collect.rb
```

The two workflow runs, whose journals `collect.rb` reads:

| run id | what it covered |
|---|---|
| `wf_afb34694-7ce` | 19 auditors over slices of the graph: edges, `abroad` flags, gating, notes |
| `wf_a12d9bc3-b5b` | 10 researchers: per-visa requirements, F-2/F-5 GNI rules, every income discount, `needs` expressiveness, engine path memory |

Both wrote their scripts to
`~/.claude/projects/-Users-tillo-gurufin-Desktop-code-self-kvppartners-blog/<session>/workflows/scripts/`.
They can be relaunched with `Workflow({scriptPath, resumeFromRunId})`, which replays completed
agents from cache and only re-runs what changed. If the journals are gone, the scripts are
self-contained and can simply be run again.

Suggested order of work:
1. Apply the items in `verified-by-review.md` - they need no further research.
2. Re-run `collect.rb` and apply the findings marked `SURVIVED`.
3. Re-run the requirements/GNI workflow, which never reported. The F-2/F-5 income discounts are the
   part of the brief that is still entirely open.
4. Only then look at the `UNVERIFIED` findings, and verify each before acting.

## The tools

All under `tools/`. They are analysis aids, not part of the site build.

| file | what it is |
|---|---|
| `engine.md` | how the page interprets every field in `data/visamap.yaml`. Written for the research agents; the most useful summary of the engine's semantics. |
| `graph.txt` | the whole visa graph dumped compactly, English only: every node with its gating, notes and `next` list. |
| `money.txt` | every money / income / GNI / asset / points / years statement in the data, 316 lines, each tagged with its exact location. The input for the GNI audit. |
| `visadocs-targets.txt` | which official KIS document lists exist per visa, from `data/visadocs.yaml`. In-repo ground truth: a visa with no `change` list is one the manual does not document an in-Korea status change to. |
| `sim.mjs` | a faithful port of the engine's option logic. Lets you ask "what would the page actually offer this reader?" without a browser. Needs `js-yaml`. Keep it in sync with `assets/js/visamap.js`. |
| `reach.mjs` | walks the open options for several personas to find starts that can never reach an F-5, and dead ends. |
| `canon.mjs` | builds the minimal reader who legitimately holds each visa, then reports which of that visa's own `next` targets are blocked for them. Suspect edges surface here. |
| `memory.mjs` | demonstrates what the engine does and does not carry forward from the reader's answers and the chosen path. |
| `collect.rb` | regenerates `findings.json` and `findings.md` from the workflow journals. |

```sh
cd visa-map-audit/tools && npm install js-yaml && node reach.mjs
```

## Checks that passed, so nobody re-opens them

- `hugo` builds with no data warnings: every `next` target exists, every fact name is known, every
  country and group reference resolves, all four languages have names and `how` notes.
- No duplicate edges, no self-loops.
- Every in-Korea edge targets a visa that has a `change` document list in `data/visadocs.yaml`, and
  every `abroad` edge targets one with an `abroad` list - except F-5-14, F-5-27 and F-5-6R, which
  have no `visadocs.yaml` entry at all.
- Country groups: no unknown ISO codes, no overlap between `visaWaiver` and `visaFree`,
  `h1NoChange` is a subset of `h1`.
- The per-edge notes are genuinely differentiated by source status, not copy-pasted (D-10-1 has 5
  distinct notes, F-2-7 has 6).
- `B-1`/`B-2`/`C-3-*`/`C-4` -> `D-10-1` as an in-Korea change is **correct** - the manual lists
  those statuses explicitly. Do not "fix" it.
- The short-term -> `F-2-3` edges correctly carry `abroad: true`, and `H-1` -> `E-*` correctly
  carries `abroadFor: h1NoChange`.
- `openMap` restores the answers and the path faithfully and re-validates each step, and the
  sensitive-answer handling really does keep Korean descent out of report links.
