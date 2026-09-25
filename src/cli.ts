import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { parseFixtures, parseCsv, buildReport, type Fixture } from "./congestion.ts";

const DEFAULT_WINDOW_DAYS = 14;

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function printReport(report: ReturnType<typeof buildReport>): void {
  console.log(`\n${report.team} — ${report.totalFixtures} fixtures found\n`);

  if (report.totalFixtures === 0) {
    console.log("No fixtures matched that team name. Check spelling against the source file.");
    return;
  }

  const { worstWindow, shortestRest, averageRestDays, windowDays } = report;

  if (worstWindow) {
    console.log(`Busiest ${windowDays}-day stretch: ${worstWindow.count} fixtures`);
    console.log(`  ${formatDate(worstWindow.start)} to ${formatDate(worstWindow.end)}`);
    for (const f of worstWindow.fixtures) {
      console.log(`  - ${formatDate(f.date)}  vs ${f.opponent} (${f.venue}, ${f.competition})`);
    }
  }

  if (shortestRest) {
    console.log(`\nShortest rest between matches: ${shortestRest.days} day(s)`);
    console.log(`  ${formatDate(shortestRest.before.date)} vs ${shortestRest.before.opponent}`);
    console.log(`  ${formatDate(shortestRest.after.date)} vs ${shortestRest.after.opponent}`);
  }

  if (averageRestDays !== null) {
    console.log(`\nAverage days between fixtures: ${averageRestDays.toFixed(1)}`);
  }
}

function main(argv: string[]): void {
  const [file, ...rest] = argv;

  let windowDays = DEFAULT_WINDOW_DAYS;
  const windowFlagIndex = rest.indexOf("--window");
  const teamArgs = windowFlagIndex === -1 ? rest : [...rest.slice(0, windowFlagIndex), ...rest.slice(windowFlagIndex + 2)];
  if (windowFlagIndex !== -1) {
    const value = Number(rest[windowFlagIndex + 1]);
    if (!Number.isFinite(value) || value <= 0) {
      console.error("--window must be a positive number of days");
      process.exitCode = 1;
      return;
    }
    windowDays = value;
  }

  if (!file || teamArgs.length === 0) {
    console.error("usage: fixture-congestion <fixtures.json> <team> [<team> ...] [--window <days>]");
    process.exitCode = 1;
    return;
  }

  let fixtures: Fixture[];
  try {
    const text = readFileSync(file, "utf8");
    const raw = extname(file).toLowerCase() === ".csv" ? parseCsv(text) : JSON.parse(text);
    fixtures = parseFixtures(raw);
  } catch (err) {
    console.error(`failed to load fixtures: ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }

  for (const team of teamArgs) {
    const report = buildReport(fixtures, team, windowDays);
    printReport(report);
  }
}

main(process.argv.slice(2));
