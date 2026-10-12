# How the Visa map engine reads data/visamap.yaml (assets/js/visamap.js)

The reader gives nationality + age (required) and optional details. The page then shows,
row by row, the options reachable from the visa they are standing on. An option is either
OPEN (clickable, shown by default) or BLOCKED (hidden behind a "show N" button, with a reason).

## next
`next:` on visa X is the list of visas offered as the reader's next step from X.
Items are either a bare code (`- F-2-3`) or a map (`- {to: E-7-1, abroad: true, note: {...}}`).
Everything NOT listed in `next` is unreachable from X: the page will never offer it.
A target already used earlier on the path can be offered again; `again:` then replaces `note:`.

## abroad / abroadFor
`abroad: true` on a move = the reader must leave Korea and get a new visa at a consulate
(shown as a plane icon). No flag = change of status inside Korea.
`abroadFor: <group>` = from abroad only for that group's nationalities.
`abroad: true` on the whole visa = every move out of it is from abroad.
Moves out of `NONE` (no Korean visa yet) are always treated as from abroad.

## Gating (what makes an option BLOCKED)
- `age: [min]` or `[min, max]`, `ageByCountry: {ISO: [min,max]}` - hard age gate on the target visa.
- `countries:` on the target visa - a group name from `groups:` or a list of ISO codes. Not in it = blocked.
- `needs:` - either one map `{fact: value}` (ALL must hold) or a LIST of such maps (ANY ONE is enough).
  A move's own `needs:` REPLACES the target visa's `needs:` for that move. `needs: {}` (empty) on a
  move lifts the visa's requirements for that move.
- Facts: korean (true = ethnic Korean), spouse (none|korean|f5|foreigner|abroad|exKorean),
  koreanChild (true), parent (none|korean|f5|foreigner, only for readers under 19),
  edu / koreanEdu (1 high school, 2 college, 3 bachelor, 4 master, 5 doctorate; koreanEdu = Korean school),
  stem (true), rank (1 top-500, 2 top-200, 3 top-100 QS), experience (years),
  invest (1 = KRW 100M, 2 = 300M, 3 = 700M ~ USD 500K, 4 = 1B, 5 = 1.5B, 6 = 3B),
  ageUnder (age below N), countries (group or ISO list), notAfter (visas that may NOT be the
  status held immediately before the status this move leaves from).
- A fact the reader left empty is UNKNOWN: it NEVER blocks the option (result "maybe").
  So `needs` only ever filters readers who explicitly answered.
- `lang: {topik: N, kiip: N}` (either suffices) is only a hint, never blocks.

## gives
`gives:` on visa X = facts that holding X implies for LATER steps (e.g. D-2-2 gives
`{edu: 3, koreanEdu: 3}` - i.e. "once you have been on D-2-2 you have a Korean bachelor's").
For level facts (edu, koreanEdu, rank, experience, invest) a `gives` value raises the
reader's own level if they answered, or acts as a minimum if they left it empty.
Note the engine applies `gives` for every visa on the path BEFORE the current step, so a
`gives` must represent what a person has after COMPLETING that visa, not merely entering it.

## Goals
Any code starting `F-5` is a goal (the path ends there). F-5 visas therefore have no `next`.

## notes
`notes:` on a visa = extra lines for specific nationalities. `abroad: true` on a note means it
is shown only on steps where the reader applies from abroad.
