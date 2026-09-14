# fixture-congestion

Answers one question: given a team's fixture list, what is the worst
stretch of games they have to play, and how little rest did they get
around it?

Fixture congestion (a run of matches packed into a short span, often
across league and cup competitions at once) is a real problem for
lower-budget teams with thin squads. A league table or a plain calendar
doesn't surface it — you have to look at the gaps between dates. This
tool does that one calculation and stops there.

## Usage

Fixtures live in a JSON file, one object per match:

```json
{ "date": "2026-08-26", "team": "Kingsview FC", "opponent": "Marsh Lane FC", "competition": "Cup", "venue": "away" }
```

Or a CSV file with the same fields as headers:

```csv
date,team,opponent,competition,venue
2026-08-26,Kingsview FC,Marsh Lane FC,Cup,away
```

The format is picked from the file extension (`.csv` vs anything else,
which is treated as JSON). `competition` and `venue` are optional in
both (`venue` defaults to `"home"`).

Run it against the sample data (requires Node 22.6+ for native
TypeScript support, or compile with `tsc` first if you have it
installed):

```
node --experimental-strip-types src/cli.ts data/sample-fixtures.json "Kingsview FC" --window 14
```

Output:

```
Kingsview FC — 9 fixtures found

Busiest 14-day stretch: 4 fixtures
  2026-08-23 to 2026-09-02
  - 2026-08-23  vs Fenwick Athletic (home, League)
  - 2026-08-26  vs Marsh Lane FC (away, Cup)
  - 2026-08-30  vs Old Colliery (home, League)
  - 2026-09-02  vs Northgate Rovers (home, Cup)

Shortest rest between matches: 2 day(s)
  2026-08-30 vs Old Colliery
  2026-09-02 vs Northgate Rovers

Average days between fixtures: 7.9
```

`--window` sets the size of the rolling window in days (default 14).
Team name matching is case-insensitive and must be exact otherwise —
this tool does not try to guess at fuzzy matches.

## How it works

`src/congestion.ts` holds the logic:

- `parseFixtures` turns raw parsed objects (from JSON or CSV) into typed,
  date-validated fixtures.
- `parseCsv` turns CSV text into the same raw shape `parseFixtures`
  expects, so both formats share one validation path.
- `worstWindow` sorts a team's fixtures by date and slides a window
  across them with two pointers, tracking the most matches seen in
  any `windowDays`-wide span. This is O(n), not O(n^2).
- `shortestRest` walks consecutive fixtures and finds the smallest gap.

`src/cli.ts` is just argument parsing and printing.

## Status

Early skeleton. No tests, no build output committed. See the source for
what's there.
