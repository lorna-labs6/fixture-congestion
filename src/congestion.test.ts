import { test } from "node:test";
import assert from "node:assert/strict";
import { worstWindow, shortestRest, type Fixture } from "./congestion.ts";

let counter = 0;

function fixture(date: string): Fixture {
  counter++;
  return {
    date: new Date(date),
    team: "Test FC",
    opponent: `Opponent ${counter}`,
    competition: "League",
    venue: "home",
  };
}

test("worstWindow returns null for an empty list", () => {
  assert.equal(worstWindow([], 14), null);
});

test("worstWindow on a single fixture is a window of one", () => {
  const sorted = [fixture("2026-08-01")];
  const result = worstWindow(sorted, 14);
  assert.equal(result?.count, 1);
  assert.equal(result?.fixtures.length, 1);
});

test("worstWindow includes a fixture exactly windowDays apart (inclusive boundary)", () => {
  const sorted = [fixture("2026-08-01"), fixture("2026-08-15")];
  const result = worstWindow(sorted, 14);
  assert.equal(result?.count, 2);
});

test("worstWindow excludes a fixture one day beyond the window", () => {
  const sorted = [fixture("2026-08-01"), fixture("2026-08-16")];
  const result = worstWindow(sorted, 14);
  assert.equal(result?.count, 1);
});

test("worstWindow finds the busiest stretch even when it isn't at the end of the list", () => {
  const sorted = [
    fixture("2026-08-01"),
    fixture("2026-08-03"),
    fixture("2026-08-05"),
    fixture("2026-09-01"),
  ];
  const result = worstWindow(sorted, 7);
  assert.equal(result?.count, 3);
  assert.equal(result?.start.toISOString().slice(0, 10), "2026-08-01");
  assert.equal(result?.end.toISOString().slice(0, 10), "2026-08-05");
});

test("worstWindow with two fixtures on the same day counts both", () => {
  const sorted = [fixture("2026-08-01"), fixture("2026-08-01")];
  const result = worstWindow(sorted, 14);
  assert.equal(result?.count, 2);
});

test("shortestRest returns null with fewer than two fixtures", () => {
  assert.equal(shortestRest([]), null);
  assert.equal(shortestRest([fixture("2026-08-01")]), null);
});

test("shortestRest handles same-day fixtures as a zero-day gap", () => {
  const sorted = [fixture("2026-08-01"), fixture("2026-08-01")];
  const result = shortestRest(sorted);
  assert.equal(result?.days, 0);
});

test("shortestRest picks the smallest of several gaps, not the first or last", () => {
  const sorted = [
    fixture("2026-08-01"),
    fixture("2026-08-10"),
    fixture("2026-08-12"),
    fixture("2026-08-25"),
  ];
  const result = shortestRest(sorted);
  assert.equal(result?.days, 2);
  assert.equal(result?.before.date.toISOString().slice(0, 10), "2026-08-10");
  assert.equal(result?.after.date.toISOString().slice(0, 10), "2026-08-12");
});
