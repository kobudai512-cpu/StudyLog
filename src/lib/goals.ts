import {
  monday,
  validDate,
  type DataIssue,
  type WeeklyStudyGoal,
} from "./study";
import type { RawPage, SchemaProperty } from "./notion-schema";
export const GOALS_SOURCE_ID = "0b01476e-9a67-4dfc-9f42-0928d2cab422";
export const GOALS_URL =
  "https://app.notion.com/p/a75680e131c1474baa69a123d845dce8";
const FIELDS = {
  week: { name: "週の開始日", type: "date" },
  target: { name: "目標時間（分）", type: "number" },
  memo: { name: "メモ", type: "rich_text" },
};
export type GoalBindings = Record<keyof typeof FIELDS, string>;
export function resolveGoalBindings(
  properties: Record<string, SchemaProperty>,
  saved?: GoalBindings,
  overrides?: Partial<GoalBindings>,
): GoalBindings {
  return Object.fromEntries(
    Object.entries(FIELDS).map(([key, field]) => {
      const id =
        overrides?.[key as keyof GoalBindings] ||
        saved?.[key as keyof GoalBindings];
      const property = Object.values(properties).find((p) =>
        id
          ? p.id === id
          : p.name === field.name || (key === "memo" && p.name === "テキスト"),
      );
      if (!property || property.type !== field.type)
        throw new Error("週の目標のプロパティ対応を確認してください。");
      return [key, property.id];
    }),
  ) as GoalBindings;
}
export function normalizeGoals(pages: RawPage[], bindings: GoalBindings) {
  const goals: WeeklyStudyGoal[] = [];
  const goalIssues: DataIssue[] = [];
  const unique = new Map<string, RawPage>();
  for (const page of pages)
    if (
      !unique.has(page.id) ||
      page.last_edited_time > unique.get(page.id)!.last_edited_time
    )
      unique.set(page.id, page);
  for (const page of unique.values()) {
    if (page.archived || page.is_archived || page.in_trash) continue;
    const get = (key: keyof GoalBindings) =>
      Object.values(page.properties).find((p) => p.id === bindings[key]);
    const weekStart = get("week")?.date?.start;
    if (
      get("week")?.type !== "date" ||
      !weekStart ||
      !validDate(weekStart) ||
      monday(weekStart) !== weekStart ||
      get("week")?.date?.end
    ) {
      goalIssues.push({
        id: page.id,
        reason: "週の開始日は月曜日の日付のみで入力してください。",
      });
      continue;
    }
    const target = get("target")?.number;
    if (
      get("target")?.type !== "number" ||
      (target !== null &&
        (!Number.isInteger(target) || target! < 1 || target! > 10080)) ||
      get("memo")?.type !== "rich_text"
    ) {
      goalIssues.push({
        id: page.id,
        weekStart,
        reason: "目標時間は1〜10080分の整数で入力してください。",
      });
      continue;
    }
    goals.push({
      id: page.id,
      weekStart,
      targetMinutes: target!,
      notionUrl: page.url,
      memo: get("memo")
        ?.rich_text?.map((t) => t.plain_text)
        .join(""),
    });
  }
  return { goals, goalIssues };
}
