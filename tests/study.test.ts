import { describe, expect, it } from "vitest";
import {
  addDays,
  aggregate,
  monday,
  periodRange,
  studyDate,
  tokyoDate,
  weekComparison,
  type StudyRecord,
} from "@/lib/study";
const record = (
  id: string,
  date: string,
  minutes = 60,
  subject = "数学",
  updatedAt = "2026-10-01T00:00:00Z",
): StudyRecord => ({
  id,
  date,
  durationMinutes: minutes,
  subject,
  updatedAt,
  title: "test",
  notionUrl: "",
});
describe("東京時間と期間", () => {
  it("UTC深夜前を東京の日付にする", () =>
    expect(tokyoDate("2026-10-21T15:00:00Z")).toBe("2026-10-22"));
  it("日付だけを移動しない", () =>
    expect(studyDate("2026-10-21")).toBe("2026-10-21"));
  it("時刻付きは東京の日付", () =>
    expect(studyDate("2026-10-21T23:30:00-07:00")).toBe("2026-10-22"));
  it.each(["2026-02-30", "bad", "2026-10-21T10:00:00", null])(
    "不正・タイムゾーン不明の日付を拒否 %s",
    (value) => expect(studyDate(value)).toBeNull(),
  );
  it("月曜始まり、日曜は同じ週", () =>
    expect(monday("2026-10-25")).toBe("2026-10-19"));
  it("年越し", () => expect(monday("2027-01-01")).toBe("2026-12-28"));
  it("閏日", () => expect(addDays("2024-02-28", 1)).toBe("2024-02-29"));
  it("月範囲は今日まで", () =>
    expect(periodRange("month", "2026-10-22")).toEqual({
      start: "2026-10-01",
      end: "2026-10-22",
    }));
  it("今日範囲", () =>
    expect(periodRange("today", "2026-10-22")).toEqual({
      start: "2026-10-22",
      end: "2026-10-22",
    }));
  it.each([
    { start: "2026-10-23", end: "2026-10-22" },
    { start: "2025-01-01", end: "2026-10-22" },
    { start: "2026-02-30", end: "2026-03-01" },
  ])("逆転・過大・不正期間を拒否", (r) =>
    expect(() => aggregate([], r)).toThrow(),
  );
});
describe("集計", () => {
  const range = { start: "2026-10-19", end: "2026-10-22" };
  it("日付と教科で絞り込む", () => {
    const result = aggregate(
      [
        record("1", range.start, 60),
        record("2", range.end, 90, "英語"),
        record("3", "2026-10-18", 120),
      ],
      range,
      "数学",
    );
    expect(result.total).toBe(60);
    expect(result.recordedDays).toBe(1);
    expect(result.calendarDays).toBe(4);
  });
  it("同一IDは最新編集の内容だけを集計", () =>
    expect(
      aggregate(
        [
          record("1", range.start, 100),
          record("1", range.start, 30, "数学", "2026-10-20T00:00:00Z"),
        ],
        range,
      ).total,
    ).toBe(30));
  it("空白日は未記録、明示0分は記録あり", () => {
    const a = aggregate([record("1", range.start, 0)], range);
    expect(a.daily[0].recorded).toBe(true);
    expect(a.daily[1].recorded).toBe(false);
    expect(a.recordedDays).toBe(1);
  });
  it("小数分を保持し負数・NaNを除外", () =>
    expect(
      aggregate(
        [
          record("1", range.start, 1.5),
          record("2", range.start, -1),
          record("3", range.start, NaN),
        ],
        range,
      ).total,
    ).toBe(1.5));
  it("内訳と日別と週別の合計が一致", () => {
    const a = aggregate(
      [record("1", range.start, 60), record("2", range.end, 90, "英語")],
      range,
    );
    expect(a.breakdown.reduce((s, r) => s + r.minutes, 0)).toBe(150);
    expect(a.daily.reduce((s, r) => s + r.total, 0)).toBe(150);
    expect(a.weekly[0].minutes).toBe(150);
    expect(a.breakdown.reduce((s, r) => s + r.share, 0)).toBe(100);
  });
  it("比較は前週の同じ曜日まで、金曜は含めない", () => {
    const w = weekComparison(
      [
        record("1", "2026-10-19", 100),
        record("2", "2026-10-12", 60),
        record("3", "2026-10-16", 120),
      ],
      "2026-10-22",
    );
    expect(w.previous).toEqual({ start: "2026-10-12", end: "2026-10-15" });
    expect(w.difference).toBe(40);
    expect(w.priorTotal).toBe(60);
  });
  it("前週0分の率はnull", () =>
    expect(weekComparison([], "2026-10-22").percent).toBeNull());
});
