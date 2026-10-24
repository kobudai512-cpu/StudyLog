import { expect, it } from "vitest";
import { filterMaterial, materialRanking } from "@/lib/materials";
import { parseRecordInput } from "@/lib/record-input";
import { toSharedStudy } from "@/lib/shared-study";
import { normalizePages, type RawPage } from "@/lib/notion-schema";
import type { StudyRecord } from "@/lib/study";
const row = (
  id: string,
  date: string,
  material: string,
  minutes: number,
  subject = "数学",
): StudyRecord => ({
  id,
  date,
  material,
  subject,
  durationMinutes: minutes,
  title: "test",
  notionUrl: "",
  updatedAt: "",
});
it("時間・回数・日数・平均・最近の日付を教材別に集計し並べ替える", () => {
  const records = [
    row("1", "2026-10-22", "A", 90),
    row("2", "2026-10-23", "B", 10),
    row("3", "2026-10-24", "B", 20),
    row("4", "2026-10-24", "", 5),
    row("5", "2026-10-24", "A", 40, "英語"),
  ];
  const range = { start: "2026-10-19", end: "2026-10-25" };
  const results = materialRanking(records, range, "数学", "time-desc");
  expect(results[0]).toMatchObject({
    name: "A",
    minutes: 90,
    count: 1,
    days: 1,
    lastDate: "2026-10-22",
  });
  expect(results[1]).toMatchObject({
    name: "B",
    minutes: 30,
    count: 2,
    days: 2,
    lastDate: "2026-10-24",
  });
  expect(results.reduce((sum, r) => sum + r.share, 0)).toBeCloseTo(100);
  expect(materialRanking(records, range, "数学", "count")[0].name).toBe("B");
  expect(materialRanking(records, range, "数学", "days")[0].name).toBe("B");
  expect(materialRanking(records, range, "数学", "time-asc")[0].name).toBe("");
  expect(filterMaterial(records, "book:A")).toHaveLength(2);
  expect(filterMaterial(records, "unset")).toHaveLength(1);
  expect(filterMaterial(records, "all")).toHaveLength(5);
});
it("日付をまたいだ教材の記録は期間内の分数・日数を正しく比較する", () => {
  const record = {
    ...row("1", "2026-10-24", "教材", 90),
    endedAt: "2026-10-24T00:30:00+09:00",
  };
  expect(
    materialRanking(
      [record],
      { start: "2026-10-23", end: "2026-10-24" },
      "all",
      "time-desc",
    )[0],
  ).toMatchObject({ minutes: 90, count: 1, days: 2 });
  expect(
    materialRanking(
      [record],
      { start: "2026-10-23", end: "2026-10-23" },
      "all",
      "time-desc",
    )[0],
  ).toMatchObject({ minutes: 60, count: 1, days: 1 });
  const shared = toSharedStudy({
    records: [record],
    mode: "live",
    stale: false,
    syncedAt: "2026-10-24T00:00:00Z",
    issues: [],
    duplicates: 0,
  });
  expect(JSON.stringify(shared)).not.toContain("教材");
});
it("教材の保存入力を検証し、既存の教材なし入力との互換性を保つ", () => {
  const input = {
    title: "演習",
    subject: "数学",
    endedAt: "2026-10-22T02:31:00+09:00",
    durationMinutes: 31,
    unit: "",
  };
  expect(parseRecordInput({ ...input, material: "  参考書  " }).material).toBe(
    "参考書",
  );
  expect(parseRecordInput(input)).not.toHaveProperty("material");
  expect(parseRecordInput({ ...input, material: "" })).not.toHaveProperty(
    "material",
  );
  for (const material of [123, "a,b", "x".repeat(101)])
    expect(() => parseRecordInput({ ...input, material })).toThrow();
});
it("教材をプロパティIDで読み取り、未選択の記録も取り込む", () => {
  const p: RawPage = {
    id: "1",
    url: "",
    last_edited_time: "",
    properties: {
      t: { id: "t", type: "title", title: [] },
      d: { id: "d", type: "date", date: { start: "2026-10-24" } },
      s: { id: "s", type: "select", select: { name: "数学" } },
      m: { id: "m", type: "number", number: 60 },
      b: { id: "b", type: "select", select: { name: "教材" } },
    },
  };
  const bindings = {
    title: "t",
    date: "d",
    subject: "s",
    duration: "m",
    unit: "",
    material: "b",
  };
  expect(normalizePages([p], bindings).records[0].material).toBe("教材");
  p.properties.b.select = null;
  expect(normalizePages([p], bindings).records[0].material).toBe("");
});
