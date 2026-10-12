# Findings I verified myself (deterministic checks + primary sources)

## Confirmed WRONG

### 1. E-2 has no `countries` gate (high)
data/visamap.yaml E-2 `how` says "English teachers: citizens of the US, UK, Canada, South Africa,
New Zealand, Australia or Ireland" but the visa has no `countries:` key, so the map offers E-2 to
every nationality, including Uzbek and Russian readers (the site's main audience). E-2-1 (회화강사)
requires nationality of a country where the language is native AND a degree from that country.
Confirmed: 7 designated countries.
Fix: add a `designatedEnglish: [US, GB, CA, ZA, NZ, AU, IE]` group and `countries: designatedEnglish`
on E-2, or split E-2 into E-2-1 (gated) and E-2-2 (assistant teacher, other languages).

### 2. The D-10 80-point note is applied to statuses the rule does not cover (medium)
The note "60+ points (80+ for citizens of the 21 notified countries)" is attached to D-10-1 moves from
B-1, B-2, C-3-1, C-3-4, C-3-8, C-3-9, C-4, D-3, E-9, E-10 (correct) but also from
D-2-5, D-4-1, D-4-2, D-4-6, D-4-7 and F-3 (not correct). The manual applies the 80-point floor only to
notified-country nationals holding B-1, B-2, C-1, C-3, C-4, D-3, E-9, E-10 or G-1; everyone else
lawfully in Korea with a bachelor's uses the normal 60-point rule.
Fix: give the D-4-*/D-2-5/F-3 moves the plain 60-point note.

### 3. G-1 is missing the D-10-1 route (medium, missing-edge)
G-1 is in the official list of statuses allowed to change to D-10 (at 80 points for notified-country
nationals), but neither G-1-5 nor G-1-6 offers D-10-1.

### 4. F-2-2 is a dead end for an adult holder (low)
F-2-2 (minor child of a Korean citizen) has exactly one next step, F-5-3, which is gated `age: [0, 18]`.
The start form accepts ages 14-99 and does not gate the starting visa, so any F-2-2 holder aged 19+ is
shown "no options fit". Needs a route for the F-2-2 holder who reaches adulthood.

### 5. Four "family of X" residence codes are unreachable (medium, missing-edge)
In-degree 0: F-2-13 (family of public-interest investor), F-2-81 (child of tourism/resort investor),
F-2-T1 (Top-Tier family), F-2-16 (special contributor). F-1 and F-3 are the nodes that carry the
analogous F-2-71 (family of points-based resident) edge, so F-1/F-3 should carry these too.
Consequence today: F-5-19, F-5-22, F-5-28, F-5-29 and F-5-T1 can never be reached by any path.

### 6. Unreachable statuses, for the record (low)
Never offered as a next step by any path (usable only by typing them into the search box):
D-4-2, E-6-2, E-7-Y, F-1, F-2-13, F-2-16, F-2-81, F-2-T1, G-1-5, G-1-6, H-2.
Most are consistent with data/visadocs.yaml (extend-only, so no change route exists) - D-4-2, E-6-2,
E-7-Y, F-1, F-2-81, F-2-T1, G-1-5, G-1-6 - and H-2 is closed. F-2-13 and F-2-16 have no visadocs entry
at all. Worth a deliberate decision rather than an accident.

## Systemic, by design but the main reason the map looks wrong

### 7. Unanswered details never block, so the default map recommends almost everything
A 25-year-old Uzbek who fills in only nationality and age sees 56 of 61 first-visa options as OPEN,
including F-5-5 (large investor PR), F-5-11 (outstanding ability PR), F-2-7, F-2-T, E-1 (professor),
E-5 (licensed professional), E-7-S1/E-7-S2. Only B-1, B-2, H-1 (nationality) D-4-3 and F-2-2 (age) are
blocked. This is documented behaviour ("anything left empty keeps all options open") but it is what a
reader experiences as "the mapping makes lots of mistakes".

### 8. 52 of 113 visas have no gate at all (no needs, no age, no countries)
So they stay open even for a reader who answered every question. The ones where that is clearly wrong:
- E-5 Licensed professional - no degree or licence requirement
- E-4 Technical instructor - no experience requirement
- E-7-2 Semi-professional, E-7-S1 High-income professional, E-7-S2 High-tech professional
- F-2-7 Points-based resident (reachable from 26 statuses, always open)
- F-2-99 Long-term resident (only a `lang` hint, which never blocks)
- F-5-11 Outstanding ability (reachable from NONE and 6 work statuses)
- D-7 Intra-company transferee - no experience requirement despite the 1-year parent-company rule
- D-8-2 Venture founder - no investment or IP requirement while D-8-1/D-8-3 are invest-gated
- D-2-7 and D-4-7 - no `edu` floor while their sibling D-2-* / D-4-1 codes have one

## Checked and found CORRECT (do not "fix" these)

- B-1/B-2/C-3-*/C-4 -> D-10-1 as an in-Korea change: correct. The manual explicitly lists B-1, B-2,
  C-1, C-3, C-4, D-3, E-9, E-10 and G-1 as statuses allowed to change to D-10, at 80 points for
  notified-country nationals. The note on these edges matches.
- B-1/B-2/C-3-* -> F-2-3 is marked `abroad: true`, which matches the rule that short-term statuses
  cannot change to F-2-3 in Korea.
- H-1 -> E-1..E-5, E-7-1 correctly carry `abroadFor: h1NoChange`, matching the 8-country list.
- All 626 edges point at visas that exist; no duplicate edges, no self-loops; the Hugo build emits no
  data warnings.
- Edge/document cross-check: every in-Korea edge targets a visa that has a `change` document list in
  data/visadocs.yaml, and every `abroad` edge targets one with an `abroad` list, except F-5-14, F-5-27
  and F-5-6R, which have no visadocs entry at all.
- Country groups: no unknown ISO codes, no overlap between visaWaiver and visaFree, h1NoChange is a
  subset of h1, eps has 17 members, notified has 21.
- The per-edge notes are carefully differentiated (D-10-1 has 5 distinct notes by source status,
  F-2-7 has 6), not copy-pasted.

# Round 2: does it remember the input data and the path? (verified with the engine simulator)

## It does remember, partly - education works

A reader who answers "bachelor's, not from Korea" and then walks NONE > D-2-2 > D-2-3 has E-3
(researcher, needs a master's) unlocked at step 3, because D-2-2 gives edu:3/koreanEdu:3 and D-2-3 gives
edu:4/koreanEdu:4 and factsAt() raises the reader's own level with Math.max. That part is correct.

## Gap 1 (high): TOPIK / KIIP never blocks anything, but KIIP is a hard legal requirement

`lang` is documented as "a hint, never blocks" and assess() only adds a tag. So a reader who explicitly
answers "TOPIK: none" and "KIIP: none" is still offered, as clickable options:
  from E-7-1:  F-5-1, F-2-99, F-2-R   (only a small "needs KIIP 5" tag)
  from F-2-7:  F-5-16, F-5-1
  from F-2-99: F-5-1
KIIP level 5 is an outright requirement for F-5-1, F-5-2, F-5-4, F-5-10, F-5-16, F-5-18, F-5-28 and
F-5-6R; KIIP 4 for F-2-99; KIIP 3 or TOPIK 3 for F-2-R and F-5-T. This is the most consequential
requirement on the whole PR side of the map and the one requirement the engine refuses to apply.
Fix: let `lang` block (or add a separate blocking field) when the reader has answered a level below the
requirement, keeping the current hint behaviour when they left it blank.

## Gap 2 (high): nothing on the path ever grants work experience

Only 12 of 113 visas have `gives`, and only D-2-1..D-2-4 grant a level. Nothing grants experience,
invest, rank, stem, spouse or koreanChild. Proven: a reader aged 24 who answers "0 years experience"
and then plots NONE > E-7-1 > F-2-7 is still treated as having 0 years at every later step, so F-2-T
(needs {edu:4,rank:3} or {experience:5}) stays blocked with "you need more experience" the whole way.
The same reader who answers "5 years" at the start gets F-2-T immediately.
This is wrong in both directions: F-2-7 itself requires about 3 years of professional work, so by the
time the reader is standing on it the path has already proved the experience the engine denies.
Fix: give the work statuses and the residence statuses that imply a period a `gives`, e.g.
F-2-7 gives {experience: 3}, F-2-99 gives {experience: 5}, E-7-4 gives {experience: 4}.

## Gap 3 (medium): `notAfter` is dead code

The engine implements it (checkFact), the Hugo template validates it, and the comment at the top of
data/visamap.yaml documents it with the example `[D-4, E-9]` - but no visa and no edge uses it anywhere
in the file. So path-dependent exclusions are only prose today. The clearest case the data already
states in words is on E-7-4 -> F-2-99: "After 5 years on E-7 (E-9 years do not count)". That is exactly
a notAfter rule and should be machine-readable.
Also worth confirming the implemented semantics are the intended ones: facts.previous is
path[level - 2], the visa held before the one the move leaves from, and it returns 'maybe' (never
blocks) on the first step.

## Gap 4 (medium): no duration anywhere

Every F-5 'how' note states a residence period ("5+ years on D-7-E-7 or F-2", "2+ years on F-6",
"3+ years on F-2-7") and nothing checks any of them, because the data has no way to express years in a
status. A one-step path NONE > D-7 > F-5-1 is drawable today. Either model years, or make the notes
carry the period prominently enough that the picture is not misleading.

## Gap 5 (low, product decision): answering "single" closes every family route permanently

Blank means unknown and keeps options open, but an honest "spouse: none" blocks F-6-1, F-6-2, F-2-3 and
F-3 for ever, and nothing on the path can later grant a spouse, so F-5-2 and F-5-4 become unreachable.
A reader planning ten years ahead has no way to say "not married yet, but might be".

## Confirmed sound (do not change)

- The shared-link replay in openMap faithfully restores the answers and re-validates the path, dropping
  steps that no longer pass; saveMap uses replaceState so it does not retrigger openMap.
- The sensitive-answer handling is correct: `korean` is in RADIOS, so mapParams(SENSITIVE) really does
  leave it out of the report link, and profileLine skips it because person.korean is cleared.
