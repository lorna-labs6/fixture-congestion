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
    const competition = r.competition?.trim() ? r.competition.trim() : "unknown";
    return {
      date,
      team: r.team,
      opponent: r.opponent,
      competition,
      venue,
    };
  });
}

/**
 * Splits one CSV line into cells, honoring double-quoted fields (so a
 * quoted value can contain commas) and "" as an escaped quote inside one.
 */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

/**
 * Turns CSV text (header row + one row per fixture) into the same raw shape
 * parseFixtures expects from JSON, so both formats share one validation path.
 */
export function parseCsv(text: string): RawFixture[] {
  const lines = text.split(/\r\n|\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const header = parseCsvLine(lines[0]!).map((h) => h.trim());
  return lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line);
    if (cells.length !== header.length) {
      throw new Error(`CSV row ${index + 2} has ${cells.length} field(s), expected ${header.length}`);
    }
    const row: Record<string, string> = {};
    header.forEach((key, i) => {
      row[key] = cells[i]!.trim();
    });
    return row as unknown as RawFixture;
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
