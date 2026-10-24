import { aggregate, type Range, type StudyRecord } from "./study";
export type MaterialSort =
  "time-desc" | "time-asc" | "count" | "days" | "recent" | "name";
export function filterMaterial(records: StudyRecord[], selection: string) {
  return selection === "all"
    ? records
    : records.filter((r) =>
        selection === "unset"
          ? !r.material
          : `book:${r.material}` === selection,
      );
}
export function materialRanking(
  records: StudyRecord[],
  range: Range,
  subject: string,
  sort: MaterialSort,
) {
  const selected = aggregate(records, range, subject).records;
  const names = [...new Set(selected.map((r) => r.material || ""))];
  const result = names.map((name) => {
    const entries = records.filter((r) => (r.material || "") === name);
    const summary = aggregate(entries, range, subject);
    return {
      name,
      minutes: summary.total,
      count: summary.records.length,
      days: summary.recordedDays,
      lastDate: summary.daily.filter((d) => d.recorded).at(-1)?.date || "",
      share: 0,
    };
  });
  const total = result.reduce((sum, r) => sum + r.minutes, 0);
  for (const row of result) row.share = total ? (row.minutes / total) * 100 : 0;
  return result.sort(
    (a, b) =>
      (sort === "time-asc"
        ? a.minutes - b.minutes
        : sort === "count"
          ? b.count - a.count
          : sort === "days"
            ? b.days - a.days
            : sort === "recent"
              ? b.lastDate.localeCompare(a.lastDate)
              : sort === "name"
                ? 0
                : b.minutes - a.minutes) || a.name.localeCompare(b.name, "ja"),
  );
}
