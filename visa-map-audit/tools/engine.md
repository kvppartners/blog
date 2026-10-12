# How the Visa map engine reads data/visamap.yaml

The rules live in `assets/js/visa/rules.js` (no page code, so the tests and the audit scripts
run the same code as the page). `assets/js/visamap.js` draws them; `layouts/visa-map.html`
embeds the data. The header comment of `data/visamap.yaml` lists every field.

The reader gives nationality + age (required) and optional details. The page then shows,
row by row, the options reachable from the visa they are standing on. An option is OPEN,
NOT YET (open, marked ⏳ with what is missing) or BLOCKED (hidden behind a "show N" button,
with a reason).

## next
`next:` on visa X is the list of visas offered as the reader's next step from X.
Items are either a bare code (`- F-2-3`) or a map (`- {to: E-7-1, abroad: true, note: {...}}`).
Everything NOT listed in `next` is unreachable from X: the page will never offer it.
A target already used earlier on the path can be offered again; `again:` then replaces `note:`.
A move's `note` REPLACES the target's `how` text for that move, so it must be complete.
`startOnly` lists visas the map never offers as a next step on purpose (H-2, F-2-16, G-1-5).

## abroad / abroadFor
`abroad: true` on a move = the reader must leave Korea and get a new visa at a consulate.
No flag = change of status inside Korea. `abroadFor: <group>` = from abroad only for that
group's nationalities. Moves out of `NONE` (no Korean visa yet) are always from abroad.

## Time along the path
`years: [shortest, longest]` on a visa says how long it can be held (none = can be extended
without limit). The current visa adds [0, its limit] (it is already running); every later visa
adds at least its shortest length; time abroad before a first visa adds nothing. From this:
- the reader's age at each step is a range, so age gates are checked against the age the
  reader can have when they get there (`age: [19]` on F-5-1 is "not yet: from 19" for a
  17-year-old who can stay on their current visa, but open after a Korean bachelor's);
- years of work (`work: true` visas) add to the reader's answered experience;
- `stay: {years, in}` needs years on the listed visas (a `statusGroups` name or a list).

## Gating (BLOCKED vs NOT YET)
- `age`, `ageByCountry`, `countries` on the target visa: hard gates.
- `needs:` - one map `{fact: value}` (ALL must hold) or a LIST of maps (ANY ONE is enough).
  A move's own `needs:` REPLACES the target's. `needs: {}` lifts them for that move.
- Facts: korean, spouse, koreanChild, parent, edu, koreanEdu, stem, rank, experience, invest,
  ageUnder, countries, notAfter, stay. A fact the reader left empty is UNKNOWN and never
  blocks ("maybe").
- `experience` and `stay` the path can still provide are "later" (NOT YET), not blocked.
  `stay` only blocks a path that starts with no visa (history before a current visa is unknown).
- `notAfter` looks at the visa before the status the move leaves from, skipping sub-statuses
  of that status (D-10-1 > D-10-2 > D-10-1 doesn't hide an earlier E-9).
- `lang: {topik, kiip, koreanEdu}` (any one is enough): a lower level the reader gave is NOT YET.
- When every alternative fails, the reasons shown are those of the alternatives the reader can
  change (education, experience), not of narrow ones they never can (nationality, age).

## Income
`income:` on a visa or a move: `{gni: N}` (× `gni.krw`, the GNI per person immigration applies)
or `{krw: N}`; `household`, `ownHalf`, `sponsor`, `cuts` (from `incomeCuts`), `floor`, `assets`.
The engine computes the amount for this reader: the smallest `factor` among the reductions whose
`when` holds (reductions don't add up), listing those it can't decide as "may be lower". With
the reader's income answered: enough, NOT YET, or unknown (household income, sponsor income).
Income never blocks an option.

## gives
`gives:` on visa X = facts that holding X implies for LATER steps (D-2-2 gives a Korean
bachelor's). Level facts raise the reader's own level or act as a minimum when it is unknown;
other facts only fill a gap (so F-6-1 must NOT give a spouse: it would close F-6-2/F-6-3 for
readers who left the spouse question blank).

## Goals
Any code starting `F-5` is a goal (the path ends there). F-5 visas therefore have no `next`.

## notes
`notes:` on a visa = extra lines for specific nationalities. `abroad: true` on a note means it
is shown only on steps where the reader applies from abroad.
