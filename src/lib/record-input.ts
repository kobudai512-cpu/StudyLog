import { studyDate, tokyoDate } from "./study";
export type RecordInput = {
  title: string;
  subject: string;
  endedAt: string;
  durationMinutes: number;
  unit: string;
};
export type RecordOptions = {
  enabled: boolean;
  subjects: string[];
  hasUnit: boolean;
};
export type CreatedRecord = { id: string; notionUrl: string };
export class RecordError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly retryAfter?: number,
    readonly uncertain = false,
  ) {
    super(message);
  }
}
export function parseRecordInput(
  value: unknown,
  now = Date.now(),
): RecordInput {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new RecordError("入力内容を確認してください。");
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).some(
      (k) =>
        !["title", "subject", "endedAt", "durationMinutes", "unit"].includes(k),
    )
  )
    throw new RecordError("未対応の項目が含まれています。");
  if (
    typeof v.title !== "string" ||
    !v.title.trim() ||
    v.title.trim().length > 160
  )
    throw new RecordError("勉強内容は1〜160文字で入力してください。");
  if (typeof v.subject !== "string" || !v.subject || v.subject.length > 100)
    throw new RecordError("教科を選んでください。");
  if (
    !Number.isInteger(v.durationMinutes) ||
    (v.durationMinutes as number) < 1 ||
    (v.durationMinutes as number) > 1440
  )
    throw new RecordError("実績時間は1〜1440分の整数で入力してください。");
  if (
    typeof v.endedAt !== "string" ||
    v.endedAt.length > 40 ||
    !v.endedAt.includes("T") ||
    !studyDate(v.endedAt) ||
    studyDate(v.endedAt)! < "2000-01-01" ||
    Date.parse(v.endedAt) > now + 300000
  )
    throw new RecordError(
      "終了日時を確認してください。未来の学習は記録できません。",
    );
  if (
    v.unit !== undefined &&
    (typeof v.unit !== "string" || v.unit.trim().length > 200)
  )
    throw new RecordError("単元は200文字以内で入力してください。");
  return {
    title: v.title.trim(),
    subject: v.subject,
    endedAt: new Date(v.endedAt).toISOString(),
    durationMinutes: v.durationMinutes as number,
    unit: (v.unit as string | undefined)?.trim() || "",
  };
}
export function tokyoDateTimeInput(now = new Date()) {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return `${tokyoDate(now)}T${time}`;
}
