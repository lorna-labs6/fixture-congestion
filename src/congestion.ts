// Core question this tool answers: in a given season, what's the worst
// stretch of fixtures a team has to play, and how little rest did they get
// going into it? Everything else (parsing, CLI output) exists to feed this.

export interface Fixture {
  date: Date;
  team: string;
  opponent: string;
  competition: string;
  venue: "home" | "away";
}

export interface CongestionWindow {
  windowDays: number;
  count: number;
  start: Date;
  end: Date;
  fixtures: Fixture[];
}

export interface RestGap {
  before: Fixture;
  after: Fixture;
  days: number;
}

export interface CongestionReport {
  team: string;
  totalFixtures: number;
  windowDays: number;
  worstWindow: CongestionWindow | null;
  shortestRest: RestGap | null;
  averageRestDays: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

/** Raw fixture as it might come out of JSON: everything is a string or missing. */
export interface RawFixture {
  date: string;
  team: string;
  opponent: string;
  competition?: string;
  venue?: string;
}

export function parseFixtures(raw: unknown): Fixture[] {
  if (!Array.isArray(raw)) {
    throw new Error("fixture file must contain a JSON array of fixtures");
  }

  return raw.map((entry, index) => {
    const r = entry as RawFixture;
    if (typeof r?.date !== "string" || typeof r?.team !== "string" || typeof r?.opponent !== "string") {
      throw new Error(`fixture at index ${index} is missing date, team, or opponent`);
    }
    const date = new Date(r.date);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`fixture at index ${index} has an unparseable date: "${r.date}"`);
    }
    const venue = r.venue === "away" ? "away" : "home";
    return {
      date,
      team: r.team,
      opponent: r.opponent,
      competition: r.competition ?? "unknown",
      venue,
    };
  });
}

export function fixturesForTeam(fixtures: Fixture[], team: string): Fixture[] {
  const needle = team.toLowerCase();
  return fixtures
    .filter((f) => f.team.toLowerCase() === needle)
    .slice()
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Slides a window of `windowDays` across the sorted fixture list and finds
 * the window that contains the most matches. Each fixture is tried as the
 * start of a window; since the list is sorted, the window's members are a
 * contiguous slice, so this is O(n) with two pointers rather than O(n^2).
 */
export function worstWindow(sorted: Fixture[], windowDays: number): CongestionWindow | null {
  if (sorted.length === 0) return null;

  let best: CongestionWindow | null = null;
  let left = 0;

  for (let right = 0; right < sorted.length; right++) {
    const rightFixture = sorted[right]!;
    while (daysBetween(sorted[left]!.date, rightFixture.date) > windowDays) {
      left++;
    }
    const count = right - left + 1;
    if (!best || count > best.count) {
      best = {
        windowDays,
        count,
        start: sorted[left]!.date,
        end: rightFixture.date,
        fixtures: sorted.slice(left, right + 1),
      };
    }
  }

  return best;
}

export function shortestRest(sorted: Fixture[]): RestGap | null {
  if (sorted.length < 2) return null;

  let shortest: RestGap | null = null;
  for (let i = 1; i < sorted.length; i++) {
    const before = sorted[i - 1]!;
    const after = sorted[i]!;
    const days = daysBetween(before.date, after.date);
    if (!shortest || days < shortest.days) {
      shortest = { before, after, days };
    }
  }
  return shortest;
}

export function buildReport(fixtures: Fixture[], team: string, windowDays: number): CongestionReport {
  const sorted = fixturesForTeam(fixtures, team);
  const rest = shortestRest(sorted);
  const avg = sorted.length >= 2 ? daysBetween(sorted[0]!.date, sorted[sorted.length - 1]!.date) / (sorted.length - 1) : null;

  return {
    team,
    totalFixtures: sorted.length,
    windowDays,
    worstWindow: worstWindow(sorted, windowDays),
    shortestRest: rest,
    averageRestDays: avg,
  };
}
