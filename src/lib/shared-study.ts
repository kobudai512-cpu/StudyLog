import {
  aggregate,
  estimatedInterval,
  tokyoDate,
  uniqueRecords,
  validDate,
  type StudyResponse,
} from "./study";

export type SharedStudy = {
  days: { date: string; subject: string; minutes: number }[];
  goals: { weekStart: string; targetMinutes: number | null }[];
  syncedAt: string;
  stale: boolean;
};

// Explicit allowlist: no Notion IDs/URLs, record titles, units, memos, timestamps or provider errors.
export function toSharedStudy(data: StudyResponse): SharedStudy {
  const days = new Map<string, SharedStudy["days"][number]>();
  for (const record of uniqueRecords(data.records)) {
    if (
      !validDate(record.date) ||
      !Number.isFinite(record.durationMinutes) ||
      record.durationMinutes < 0
    )
      continue;
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
        }));
  return {
    days: [...days.values()].sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.subject.localeCompare(b.subject),
    ),
    goals,
    syncedAt: data.syncedAt,
    stale: data.stale,
  };
}
