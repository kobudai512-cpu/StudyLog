import {
  aggregate,
  estimatedInterval,
  tokyoDate,
  uniqueRecords,
  validDate,
  type StudyRecord,
  type StudyResponse,
} from "./study";

export type SharedStudy = {
  records: Pick<
    StudyRecord,
    | "date"
    | "subject"
    | "durationMinutes"
    | "title"
    | "material"
    | "unit"
    | "memo"
  >[];
  days: { date: string; subject: string; minutes: number }[];
  goals: { weekStart: string; targetMinutes: number | null; memo?: string }[];
  syncedAt: string;
  stale: boolean;
};

// Keep private Notion metadata outside the share payload.
export function toSharedStudy(data: StudyResponse): SharedStudy {
  const records: SharedStudy["records"] = [];
  const days = new Map<string, SharedStudy["days"][number]>();
  for (const record of uniqueRecords(data.records)) {
    if (
      !validDate(record.date) ||
      !Number.isFinite(record.durationMinutes) ||
      record.durationMinutes < 0
    )
      continue;
    const { date, subject, durationMinutes, title, material, unit, memo } =
      record;
    records.push({
      date,
      subject,
      durationMinutes,
      title,
      material,
      unit,
      memo,
    });
    const interval = estimatedInterval(record);
    const start = interval ? tokyoDate(new Date(interval.start)) : record.date;
    const end = interval ? tokyoDate(new Date(interval.end)) : record.date;
    for (const day of aggregate([record], { start, end }).daily) {
      if (!day.recorded) continue;
      const key = JSON.stringify([day.date, record.subject]);
      const value = days.get(key) || {
        date: day.date,
        subject: record.subject,
        minutes: 0,
      };
      value.minutes += day.total;
      days.set(key, value);
    }
  }
  const goals = data.goalError
    ? []
    : (data.goals ?? [])
        .filter(
          (goal) =>
            (data.goals ?? []).filter((g) => g.weekStart === goal.weekStart)
              .length === 1 &&
            !(data.goalIssues ?? []).some(
              (i) => !i.weekStart || i.weekStart === goal.weekStart,
            ),
        )
        .map((g) => ({
          weekStart: g.weekStart,
          targetMinutes: g.targetMinutes,
          memo: g.memo,
        }));
  return {
    records: records.sort((a, b) => b.date.localeCompare(a.date)),
    days: [...days.values()].sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.subject.localeCompare(b.subject),
    ),
    goals,
    syncedAt: data.syncedAt,
    stale: data.stale,
  };
}
