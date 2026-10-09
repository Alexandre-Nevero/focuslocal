import assert from "node:assert/strict";
import {test} from "node:test";
import {buckets, clockSpan, dayKey, parseDayKey, parsePeriodMode, periodRange, periodShort, periodTitle, shiftPeriod} from "./period.ts";

const oct9 = new Date(2026, 9, 9);

test("day keys round-trip and reject dates that do not exist", () => {
    assert.equal(dayKey(oct9), "2026-10-09");
    assert.equal(parseDayKey("2026-10-09")?.getTime(), oct9.getTime());
    assert.equal(parseDayKey("2026-02-30"), null);
    assert.equal(parseDayKey("2026-1-9"), null);
    assert.equal(parseDayKey(undefined), null);
    assert.equal(parsePeriodMode("week"), "week");
    assert.equal(parsePeriodMode("year"), null);
});

test("a month runs from the first to the first of the next month", () => {
    const {start, end} = periodRange({mode: "month", anchor: oct9});
    assert.equal(dayKey(new Date(start)), "2026-10-01");
    assert.equal(dayKey(new Date(end)), "2026-11-01");
    assert.equal(buckets({mode: "month", anchor: oct9}).length, 31);
});

test("a week starts on Monday", () => {
    const {start, end} = periodRange({mode: "week", anchor: oct9});
    assert.equal(dayKey(new Date(start)), "2026-10-05");
    assert.equal(dayKey(new Date(end)), "2026-10-12");
    assert.deepEqual(buckets({mode: "week", anchor: oct9}).map((b) => b.tick), ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    assert.equal(periodShort({mode: "week", anchor: oct9}), "Oct 5–11, 2026");
});

test("a day has 24 hourly columns, ticked every four hours", () => {
    const hours = buckets({mode: "day", anchor: oct9});
    assert.equal(hours.length, 24);
    assert.deepEqual(hours.filter((b) => b.tick != null).map((b) => b.tick), ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"]);
});

test("month ticks mark the first, every seventh, and the last day", () => {
    const ticks = buckets({mode: "month", anchor: oct9})
        .filter((b) => b.tick != null)
        .map((b) => b.tick);
    assert.deepEqual(ticks, ["Oct 1", "Oct 7", "Oct 14", "Oct 21", "Oct 28", "Oct 31"]);
});

test("stepping a month from the 31st lands in the next month, not two ahead", () => {
    const next = shiftPeriod({mode: "month", anchor: new Date(2026, 0, 31)}, 1);
    assert.equal(dayKey(next.anchor), "2026-02-01");
    assert.equal(dayKey(shiftPeriod({mode: "day", anchor: oct9}, -1).anchor), "2026-10-08");
    assert.equal(dayKey(shiftPeriod({mode: "week", anchor: oct9}, 1).anchor), "2026-10-16");
});

test("titles name the period in words", () => {
    assert.equal(periodTitle({mode: "month", anchor: oct9}), "October 2026");
    assert.equal(periodTitle({mode: "day", anchor: oct9}), "Friday, October 9");
    assert.equal(periodTitle({mode: "week", anchor: oct9}), "Week of Oct 5–11, 2026");
});

test("the day's clock widens to keep night sessions visible", () => {
    const at = (h: number, m = 0) => new Date(2026, 9, 9, h, m).getTime();
    assert.deepEqual(clockSpan([], oct9), {from: 6, to: 22});
    assert.deepEqual(clockSpan([{start: at(9, 2), end: at(9, 25)}], oct9), {from: 6, to: 22});
    assert.deepEqual(clockSpan([{start: at(2, 30), end: at(3)}, {start: at(22, 40), end: at(23, 10)}], oct9), {from: 2, to: 24});
});
