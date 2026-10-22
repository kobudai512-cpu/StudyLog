import {
  addDays,
  aggregate,
  daysInRange,
  monday,
  estimatedInterval,
  uniqueRecords,
  validDate,
  type StudyRecord,
} from "./study";

export const STUDY_LOG_URL =
  "https://app.notion.com/p/3fda1dd31af88004bae2ede705a4b58f";

export function shiftedWeek(today: string, offset: number) {
  const start = addDays(monday(today), Math.min(0, offset) * 7);
  return { start, end: offset >= 0 ? today : addDays(start, 6) };
}
export function shiftMonth(month: string, offset: number) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}
export function monthRange(month: string) {
  return {
    start: `${month}-01`,
    end: addDays(`${shiftMonth(month, 1)}-01`, -1),
  };
}
export function monthCalendar(
  records: StudyRecord[],
  month: string,
  subject = "all",
) {
  const range = monthRange(month);
  const daily = aggregate(records, range, subject).daily;
  const start = monday(range.start);
  const last = addDays(monday(range.end), 6);
  const byDate = new Map(daily.map((d) => [d.date, d]));
  return daysInRange({ start, end: last }).map((date) => ({
    date,
    inMonth: date.slice(0, 7) === month,
    recorded: byDate.get(date)?.recorded ?? false,
    total: byDate.get(date)?.total ?? 0,
  }));
}
export function goalProgress(actual: number, target: number) {
  if (!Number.isFinite(target) || target <= 0 || target > 10080) return null;
  return {
    percent: (actual / target) * 100,
    remaining: Math.max(0, target - actual),
  };
}

// Inferred continuous study interval: completion timestamp minus actual minutes.
export function hourlyStudy(
  records: StudyRecord[],
  date: string,
  subject = "all",
) {
  const summary = aggregate(records, { start: date, end: date }, subject);
  const subjects = summary.breakdown.map((s) => s.name);
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${hour}時`,
    total: 0,
    subjects: Object.fromEntries(subjects.map((s) => [s, 0])),
  }));
  let unknownMinutes = 0;
  let unknownRecords = 0;
  const midnight = Date.parse(`${date}T00:00:00+09:00`);
  for (const r of uniqueRecords(records)) {
    if (
      !validDate(r.date) ||
      !Number.isFinite(r.durationMinutes) ||
      r.durationMinutes < 0 ||
      (subject !== "all" && r.subject !== subject)
    )
      continue;
    const interval = estimatedInterval(r);
    if (!interval) {
      if (r.date === date) {
        unknownMinutes += r.durationMinutes;
        unknownRecords++;
      }
      continue;
    }
    for (const row of hours) {
      const left = midnight + row.hour * 3600000;
      const minutes =
        Math.max(
          0,
          Math.min(interval.end, left + 3600000) -
            Math.max(interval.start, left),
        ) / 60000;
      if (minutes === 0) continue;
      row.total += minutes;
      row.subjects[r.subject] = (row.subjects[r.subject] || 0) + minutes;
    }
  }
  return {
    hours,
    subjects: summary.breakdown,
    unknownMinutes,
    unknownRecords,
    knownMinutes: hours.reduce((sum, h) => sum + h.total, 0),
    total: summary.total,
  };
}
