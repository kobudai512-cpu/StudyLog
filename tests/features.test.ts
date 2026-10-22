import { describe, expect, it } from "vitest";
import {
  goalProgress,
  hourlyStudy,
  monthCalendar,
  shiftedWeek,
  shiftMonth,
} from "@/lib/study-features";
import { normalizePages, type RawPage } from "@/lib/notion-schema";
import { aggregate, type StudyRecord } from "@/lib/study";
import { normalizeGoals, resolveGoalBindings } from "@/lib/goals";
const date = "2026-10-22";
const timed: StudyRecord = {
  id: "one",
  date,
  title: "学習",
  subject: "数学",
  durationMinutes: 90,
  startedAt: `${date}T08:30:00+09:00`,
  endedAt: `${date}T10:00:00+09:00`,
  updatedAt: "2026-10-22T10:00:00Z",
  notionUrl: "",
};
describe("週の移動・月間カレンダー・目標", () => {
  it("今週は今日まで、過去週は月曜〜日曜、年をまたぐ", () => {
    expect(shiftedWeek("2027-01-01", 0)).toEqual({
      start: "2026-12-28",
      end: "2027-01-01",
    });
    expect(shiftedWeek("2027-01-01", -1)).toEqual({
      start: "2026-12-21",
      end: "2026-12-27",
    });
  });
  it("月の移動は日数や閏年に影響されない", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2024-03", -1)).toBe("2024-02");
  });
  it("閏月の29日、月曜の列、ゼロ分の記録と未記録を区別", () => {
    const cells = monthCalendar(
      [
        {
          ...timed,
          date: "2024-02-29",
          endedAt: undefined,
          durationMinutes: 0,
        },
      ],
      "2024-02",
    );
    expect(cells[0].date).toBe("2024-01-29");
    expect(cells.filter((c) => c.inMonth)).toHaveLength(29);
    expect(cells.find((c) => c.date === "2024-02-29")).toMatchObject({
      recorded: true,
      total: 0,
    });
    expect(cells.find((c) => c.date === "2024-02-28")?.recorded).toBe(false);
  });
  it("教科フィルターと重複除去をカレンダーにも適用", () => {
    expect(
      monthCalendar([timed, timed], "2026-10").find((c) => c.date === date)
        ?.total,
    ).toBe(90);
    expect(
      monthCalendar([timed], "2026-10", "英語").find((c) => c.date === date)
        ?.recorded,
    ).toBe(false);
  });
  it("達成前・達成後と不正な目標", () => {
    expect(goalProgress(300, 600)).toEqual({ remaining: 300, percent: 50 });
    expect(goalProgress(900, 600)).toEqual({ remaining: 0, percent: 150 });
    for (const target of [0, -1, NaN, Infinity, 10081])
      expect(goalProgress(60, target)).toBeNull();
  });
});
describe("時間帯別集計", () => {
  it("時間の境目で30分と60分に分割し、終了ぴったりの枠に加算しない", () => {
    const result = hourlyStudy([timed, timed], date);
    expect(result.hours).toHaveLength(24);
    expect(result.hours[8].subjects["数学"]).toBe(30);
    expect(result.hours[9].total).toBe(60);
    expect(result.hours[10].total).toBe(0);
    expect(result.knownMinutes).toBe(90);
  });
  it("UTCの時刻を東京の時間帯へ", () => {
    const result = hourlyStudy(
      [
        {
          ...timed,
          startedAt: "2026-10-21T23:30:00Z",
          endedAt: "2026-10-22T01:00:00Z",
        },
      ],
      date,
    );
    expect(result.hours[8].total).toBe(30);
    expect(result.hours[9].total).toBe(60);
  });
  it("終了時刻と実績から逆算し、時刻なしだけ不明に残す", () => {
    const unknown = { ...timed, id: "missing", endedAt: undefined };
    const result = hourlyStudy([timed, unknown], date);
    expect(result.unknownRecords).toBe(1);
    expect(result.unknownMinutes).toBe(90);
    expect(result.knownMinutes + result.unknownMinutes).toBe(result.total);
  });
  it("2:31と31分は2:00〜2:31と推定", () => {
    const result = hourlyStudy(
      [{ ...timed, endedAt: `${date}T02:31:00+09:00`, durationMinutes: 31 }],
      date,
    );
    expect(result.hours[1].total).toBe(0);
    expect(result.hours[2].total).toBe(31);
    expect(result.total).toBe(31);
  });
  it("日付・週・年をまたいでも日別と時間帯の合計が一致", () => {
    const r = {
      ...timed,
      date: "2027-01-01",
      endedAt: "2027-01-01T00:10:00+09:00",
      durationMinutes: 40,
    };
    expect(hourlyStudy([r], "2026-12-31").hours[23].total).toBe(30);
    expect(hourlyStudy([r], "2027-01-01").hours[0].total).toBe(10);
    expect(
      aggregate([r], { start: "2026-12-31", end: "2027-01-01" }).total,
    ).toBe(40);
    expect(
      aggregate([r], { start: "2026-12-31", end: "2026-12-31" }).records[0],
    ).toMatchObject({ durationMinutes: 30, recordedDurationMinutes: 40 });
    const sunday = {
      ...r,
      date: "2026-10-26",
      endedAt: "2026-10-26T00:10:00+09:00",
    };
    expect(
      aggregate([sunday], { start: "2026-10-19", end: "2026-10-25" }).total,
    ).toBe(30);
  });
  it("別日と別教科は対象外、教科ごとに積み上げ", () => {
    const english = { ...timed, id: "english", subject: "英語" };
    const result = hourlyStudy(
      [
        timed,
        english,
        { ...timed, id: "other", date: "2026-10-21", endedAt: undefined },
      ],
      date,
    );
    expect(result.hours[9].total).toBe(120);
    expect(hourlyStudy([timed, english], date, "英語").total).toBe(90);
  });
  it("0分の有効記録も不明件数には残す", () => {
    const result = hourlyStudy(
      [{ ...timed, endedAt: undefined, durationMinutes: 0 }],
      date,
    );
    expect(result.unknownRecords).toBe(1);
    expect(result.total).toBe(0);
  });
});
describe("Notion日付の時刻保持", () => {
  const bindings = {
    title: "t",
    date: "d",
    subject: "s",
    duration: "m",
    unit: "u",
  };
  const page = (
    start: string,
    end: string | null,
    time_zone: string | null = null,
  ): RawPage => ({
    id: "n",
    url: "",
    last_edited_time: "2026-10-22T00:00:00Z",
    properties: {
      t: { id: "t", type: "title", title: [] },
      s: { id: "s", type: "select", select: null },
      u: { id: "u", type: "rich_text", rich_text: [] },
      m: { id: "m", type: "number", number: 90 },
      d: { id: "d", type: "date", date: { start, end, time_zone } },
    },
  });
  it("プロパティIDで開始終了を保持し、日付だけの記録に時刻を作らない", () => {
    expect(
      normalizePages([page(timed.startedAt!, timed.endedAt!)], bindings)
        .records[0],
    ).toMatchObject({ endedAt: timed.endedAt });
    expect(
      normalizePages([page(date, null)], bindings).records[0].endedAt,
    ).toBeUndefined();
  });
  it("Asia/Tokyoを明示したローカル時刻にも対応", () => {
    expect(
      normalizePages(
        [page(`${date}T08:30:00`, `${date}T10:00:00`, "Asia/Tokyo")],
        bindings,
      ).records[0].endedAt,
    ).toBe(timed.endedAt);
  });
  it("単一のNotion日時を終了時刻として正規化して逆算", () => {
    const p = page(`${date}T02:31:00+09:00`, null);
    p.properties.m.number = 31;
    const normalized = normalizePages([p], bindings);
    expect(normalized.records[0].endedAt).toBe(`${date}T02:31:00+09:00`);
    expect(hourlyStudy(normalized.records, date).hours[2].total).toBe(31);
  });
});

describe("Notionの週目標", () => {
  const bindings = { week: "w", target: "t", memo: "m" };
  const page = (id: string, week: string, target: number | null): RawPage => ({
    id,
    url: "https://app.notion.com/p/test",
    last_edited_time: "2026-10-22T00:00:00Z",
    properties: {
      renamedWeek: { id: "w", type: "date", date: { start: week } },
      renamedTarget: { id: "t", type: "number", number: target },
      renamedMemo: { id: "m", type: "rich_text", rich_text: [] },
    },
  });
  it("IDを保存して表示名変更に耐える", () => {
    expect(
      resolveGoalBindings(
        {
          x: { id: "w", name: "改名1", type: "date" },
          y: { id: "t", name: "改名2", type: "number" },
          z: { id: "m", name: "改名3", type: "rich_text" },
        },
        bindings,
      ),
    ).toEqual(bindings);
  });
  it("未入力は未設定、同週の別ページは重複検出用に保持、ページ重複は除去", () => {
    const result = normalizeGoals(
      [
        page("a", "2026-10-19", null),
        page("b", "2026-10-19", 600),
        page("b", "2026-10-19", 600),
      ],
      bindings,
    );
    expect(result.goals).toHaveLength(2);
    expect(result.goals[0].targetMinutes).toBeNull();
    expect(result.goalIssues).toEqual([]);
  });
  it("不正な週・単位・負数・小数・範囲外は拒否", () => {
    const result = normalizeGoals(
      [
        page("a", "2026-10-20", 600),
        ...[-1, 0, 1.5, 10081].map((v, i) => page(String(i), "2026-10-19", v)),
      ],
      bindings,
    );
    expect(result.goals).toHaveLength(0);
    expect(result.goalIssues).toHaveLength(5);
  });
});
