import {
  studyDate,
  type DataIssue,
  type Snapshot,
  type StudyRecord,
} from "./study";
export const SOURCE_ID = "3fda1dd3-1af8-805d-a7f0-000b32970193";
export const NOTION_VERSION = "2026-03-11";
export const FIELDS = {
  title: { name: "学習内容", type: "title" },
  date: { name: "日付", type: "date" },
  subject: { name: "科目", type: "select" },
  duration: { name: "学習時間（分）", type: "number" },
  unit: { name: "単元", type: "rich_text" },
} as const;
export type Field = keyof typeof FIELDS;
export type Bindings = Record<Field, string>;
export type SchemaProperty = { id: string; name: string; type: string };
export function resolveBindings(
  properties: Record<string, SchemaProperty>,
  saved?: Partial<Bindings>,
  overrides?: Partial<Bindings>,
): Bindings {
  const entries = Object.values(properties);
  return Object.fromEntries(
    Object.entries(FIELDS).map(([key, field]) => {
      const id = overrides?.[key as Field] ?? saved?.[key as Field];
      const property = id
        ? entries.find((p) => p.id === id)
        : entries.find((p) => p.name === field.name);
      if (!property || property.type !== field.type)
        throw new Error(
          `Notionの「${field.name}」の型またはIDが一致しません。プロパティ対応を確認してください。`,
        );
      return [key, property.id];
    }),
  ) as Bindings;
}
// Runtime validation is deliberate: malformed records never become zero-minute entries.
type Property = {
  id: string;
  type: string;
  title?: { plain_text: string }[];
  rich_text?: { plain_text: string }[];
  date?: {
    start: string;
    end?: string | null;
    time_zone?: string | null;
  } | null;
  select?: { name: string } | null;
  number?: number | null;
};
export type RawPage = {
  id: string;
  url: string;
  last_edited_time: string;
  properties: Record<string, Property>;
  archived?: boolean;
  is_archived?: boolean;
  in_trash?: boolean;
};
export function normalizePages(
  pages: RawPage[],
  bindings: Bindings,
): Omit<Snapshot, "syncedAt"> {
  const records: StudyRecord[] = [];
  const issues: DataIssue[] = [];
  const unique = new Map<string, RawPage>();
  for (const p of pages)
    if (
      !unique.has(p.id) ||
      p.last_edited_time > unique.get(p.id)!.last_edited_time
    )
      unique.set(p.id, p);
  for (const page of unique.values()) {
    if (page.archived || page.is_archived || page.in_trash) continue;
    const get = (field: Field) =>
      Object.values(page.properties).find((p) => p.id === bindings[field]);
    const invalidType = (Object.keys(FIELDS) as Field[]).find(
      (f) => get(f)?.type !== FIELDS[f].type,
    );
    if (invalidType) {
      issues.push({
        id: page.id,
        reason: `${FIELDS[invalidType].name}の型が不正`,
      });
      continue;
    }
    const rawDate = get("date")?.date;
    // Notion also supports local timestamps with an explicit IANA zone.
    // This dashboard uses Tokyo; unknown local zones stay invalid instead of guessing.
    const zoned = (value?: string | null) =>
      value &&
      rawDate?.time_zone === "Asia/Tokyo" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)
        ? `${value}+09:00`
        : value;
    const start = zoned(rawDate?.start);
    const date = studyDate(start);
    const duration = get("duration")?.number;
    const end = zoned(rawDate?.end);
    if (!date || (end && studyDate(end) !== date)) {
      issues.push({
        id: page.id,
        reason: "学習日が未入力・不正、または複数日にまたがる記録",
      });
      continue;
    }
    if (
      typeof duration !== "number" ||
      !Number.isFinite(duration) ||
      duration < 0
    ) {
      issues.push({ id: page.id, reason: "実績時間が未入力・不正・負数" });
      continue;
    }
    records.push({
      id: page.id,
      date,
      subject: get("subject")?.select?.name?.trim() || "未分類",
      unit: get("unit")
        ?.rich_text?.map((t) => t.plain_text)
        .join(""),
      title:
        get("title")
          ?.title?.map((t) => t.plain_text)
          .join("") || "無題の記録",
      durationMinutes: duration,
      notionUrl: page.url,
      updatedAt: page.last_edited_time,
      ...(start?.includes("T") && studyDate(start) ? { startedAt: start } : {}),
      ...(end?.includes("T") && studyDate(end) ? { endedAt: end } : {}),
    });
  }
  return { records, issues, duplicates: pages.length - unique.size };
}
