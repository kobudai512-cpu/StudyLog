export type StudyRecord = {
  id: string;
  date: string;
  subject: string;
  material?: string;
  unit?: string;
  title: string;
  durationMinutes: number;
  notionUrl: string;
  updatedAt: string;
  startedAt?: string;
  endedAt?: string;
  recordedDurationMinutes?: number;
};
export type WeeklyStudyGoal = {
  id: string;
  weekStart: string;
  targetMinutes: number | null;
  notionUrl: string;
  memo?: string;
};
export type DataIssue = { id: string; reason: string; weekStart?: string };
export type Snapshot = {
  records: StudyRecord[];
  issues: DataIssue[];
  duplicates: number;
  syncedAt: string;
  goals?: WeeklyStudyGoal[];
  goalIssues?: DataIssue[];
  goalError?: string;
};
export type StudyResponse = Snapshot & {
  mode: "demo" | "live";
  stale: boolean;
  error?: string;
};
export type Period = "today" | "week" | "month" | "custom";
export type Range = { start: string; end: string };

export const SUBJECT_COLORS: Record<string, string> = {
  数学: "#4f83c4",
  英語: "#9782c7",
  国語: "#d47c8b",
  化学: "#53a68d",
  物理: "#d69a52",
  世界史: "#a78367",
  地理: "#b2a241",
  その他: "#788493",
  未分類: "#9aa2ac",
};
export function subjectColor(subject: string) {
  if (SUBJECT_COLORS[subject]) return SUBJECT_COLORS[subject];
  let hash = 0;
  for (const c of subject) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 38% 48%)`;
}
export function tokyoDate(value: Date | string = new Date()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}
export function studyDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return validDate(value) ? value : null;
  if (
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !validDate(value.slice(0, 10)) ||
    !Number.isFinite(Date.parse(value))
  )
    return null;
  return tokyoDate(value);
}
export function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function monday(date: string) {
  return addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));
}
export function daysInRange(range: Range) {
  if (
    !validDate(range.start) ||
    !validDate(range.end) ||
    range.end < range.start
  )
    throw new Error("開始日と終了日を確認してください。");
  const count =
    Math.round((Date.parse(range.end) - Date.parse(range.start)) / 86400000) +
    1;
  if (count > 366) throw new Error("表示期間は366日以内で指定してください。");
  return Array.from({ length: count }, (_, i) => addDays(range.start, i));
}
export function periodRange(
  period: Period,
  today: string,
  custom?: Range,
): Range {
  if (period === "custom") {
    if (!custom) throw new Error("期間を指定してください。");
    daysInRange(custom);
    return custom;
  }
  return {
    start:
      period === "today"
        ? today
        : period === "week"
          ? monday(today)
          : `${today.slice(0, 7)}-01`,
    end: today,
  };
}
export const minutesLabel = (n: number) =>
  `${Math.floor(n / 60)}時間 ${Number((n % 60).toFixed(1))}分`;
export function uniqueRecords(records: StudyRecord[]) {
  const map = new Map<string, StudyRecord>();
  for (const r of records)
    if (!map.has(r.id) || r.updatedAt > map.get(r.id)!.updatedAt)
      map.set(r.id, r);
  return [...map.values()];
}
// The Notion date's timestamp is the completion time, never the creation time.
export function estimatedInterval(record: StudyRecord) {
  const value = record.endedAt;
  if (
    !value?.includes("T") ||
    !studyDate(value) ||
    !Number.isFinite(record.durationMinutes) ||
    record.durationMinutes < 0
  )
    return null;
  const end = Date.parse(value);
  const start = end - record.durationMinutes * 60000;
  if (!Number.isFinite(start) || !Number.isFinite(new Date(start).getTime()))
    return null;
  return { start, end };
}
function recordDays(record: StudyRecord, range: Range) {
  const interval = estimatedInterval(record);
  if (!interval)
    return record.date >= range.start && record.date <= range.end
      ? [{ date: record.date, minutes: record.durationMinutes }]
      : [];
  if (record.durationMinutes === 0)
    return record.date >= range.start && record.date <= range.end
      ? [{ date: record.date, minutes: 0 }]
      : [];
  return daysInRange(range).flatMap((date) => {
    const left = Date.parse(`${date}T00:00:00+09:00`);
    const minutes =
      Math.max(
        0,
        Math.min(interval.end, left + 86400000) -
          Math.max(interval.start, left),
      ) / 60000;
    return minutes > 0 ? [{ date, minutes }] : [];
  });
}
export function aggregate(
  records: StudyRecord[],
  range: Range,
  subject = "all",
) {
  const days = daysInRange(range);
  const filtered = uniqueRecords(records).filter(
    (r) =>
      validDate(r.date) &&
      Number.isFinite(r.durationMinutes) &&
      r.durationMinutes >= 0 &&
      recordDays(r, range).length > 0 &&
      (subject === "all" || r.subject === subject),
  );
  const subjects = [...new Set(filtered.map((r) => r.subject))].sort();
  const portions = filtered.flatMap((r) =>
    recordDays(r, range).map((d) => ({ ...d, record: r })),
  );
  const total = portions.reduce((sum, r) => sum + r.minutes, 0);
  const daily = days.map((date) => {
    const entries = portions.filter((r) => r.date === date);
    return {
      date,
      label: `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`,
      recorded: entries.length > 0,
      total: entries.reduce((sum, r) => sum + r.minutes, 0),
      ...Object.fromEntries(
        subjects.map((s) => [
          s,
          entries
            .filter((r) => r.record.subject === s)
            .reduce((sum, r) => sum + r.minutes, 0),
        ]),
      ),
    };
  });
  const breakdown = subjects
    .map((name) => {
      const minutes = portions
        .filter((r) => r.record.subject === name)
        .reduce((sum, r) => sum + r.minutes, 0);
      return {
        name,
        minutes,
        share: total === 0 ? 0 : (minutes / total) * 100,
        color: subjectColor(name),
      };
    })
    .sort((a, b) => b.minutes - a.minutes);
  const weekly = new Map<
    string,
    { date: string; minutes: number; recorded: boolean }
  >();
  for (const d of daily) {
    const key = monday(d.date);
    const week = weekly.get(key) ?? { date: key, minutes: 0, recorded: false };
    week.minutes += d.total;
    week.recorded ||= d.recorded;
    weekly.set(key, week);
  }
  return {
    total,
    recordedDays: daily.filter((d) => d.recorded).length,
    calendarDays: days.length,
    daily,
    breakdown,
    weekly: [...weekly.values()],
    records: filtered
      .map((r) => {
        const minutes = portions
          .filter((p) => p.record.id === r.id)
          .reduce((sum, p) => sum + p.minutes, 0);
        return minutes === r.durationMinutes
          ? r
          : {
              ...r,
              durationMinutes: minutes,
              recordedDurationMinutes: r.durationMinutes,
            };
      })
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          b.updatedAt.localeCompare(a.updatedAt),
      ),
  };
}
export function weekComparison(
  records: StudyRecord[],
  today: string,
  subject = "all",
) {
  const range = periodRange("week", today);
  const previous = { start: addDays(range.start, -7), end: addDays(today, -7) };
  const current = aggregate(records, range, subject);
  const prior = aggregate(records, previous, subject);
  return {
    current,
    previous,
    priorTotal: prior.total,
    difference: current.total - prior.total,
    percent:
      prior.total === 0
        ? null
        : ((current.total - prior.total) / prior.total) * 100,
  };
}
