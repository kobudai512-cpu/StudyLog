import { monday, validDate } from "./study";
import { RecordError } from "./record-input";

export function parseGoalInput(value: unknown) {
  const v = value as { weekStart?: unknown; targetMinutes?: unknown } | null;
  if (
    !v ||
    typeof v.weekStart !== "string" ||
    !validDate(v.weekStart) ||
    monday(v.weekStart) !== v.weekStart
  )
    throw new RecordError("目標の週は月曜日の日付を指定してください。");
  if (
    typeof v.targetMinutes !== "number" ||
    !Number.isInteger(v.targetMinutes) ||
    v.targetMinutes < 1 ||
    v.targetMinutes > 10080
  )
    throw new RecordError("目標は1分〜168時間で入力してください。");
  return { weekStart: v.weekStart, targetMinutes: v.targetMinutes };
}
