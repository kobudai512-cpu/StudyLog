import { Client, LogLevel } from "@notionhq/client";
import { GOALS_SOURCE_ID, resolveGoalBindings } from "./goals";
import { NOTION_VERSION, type SchemaProperty } from "./notion-schema";
import { configuredStore } from "./store";
import { RecordError } from "./record-input";
import { parseGoalInput } from "./goal-input";

export async function goalSchema() {
  const notion = new Client({
    auth: process.env.NOTION_WRITE_TOKEN || process.env.NOTION_TOKEN,
    notionVersion: NOTION_VERSION,
    retry: false,
    timeoutMs: 20000,
    logLevel: LogLevel.ERROR,
    logger() {},
  });
  const sourceId = process.env.NOTION_GOALS_DATA_SOURCE_ID || GOALS_SOURCE_ID;
  const source = await notion.dataSources.retrieve({
    data_source_id: sourceId,
  });
  if (!("properties" in source))
    throw new RecordError("週の目標の接続を確認してください。", 503);
  const bindings = resolveGoalBindings(
    source.properties as Record<string, SchemaProperty>,
    (await configuredStore().read()).goalBindings,
    process.env.NOTION_GOALS_PROPERTY_IDS
      ? JSON.parse(process.env.NOTION_GOALS_PROPERTY_IDS)
      : undefined,
  );
  const title = Object.values(source.properties).find(
    (p) => p.type === "title",
  )?.id;
  if (!title) throw new RecordError("目標名の項目がありません。", 503);
  return { notion, sourceId, bindings, title };
}

export async function saveNotionGoal(
  input: ReturnType<typeof parseGoalInput>,
  schema: Awaited<ReturnType<typeof goalSchema>>,
) {
  const { notion, sourceId, bindings: b, title } = schema;
  const existing = await notion.dataSources.query({
    data_source_id: sourceId,
    filter: { property: b.week, date: { equals: input.weekStart } },
    page_size: 2,
  });
  if (existing.has_more || existing.results.length > 1)
    throw new RecordError(
      "同じ週の目標が複数あります。Notionで1件にまとめてから保存してください。",
      409,
    );
  if (existing.request_status?.type === "incomplete")
    throw new RecordError(
      "目標を確認できませんでした。時間をおいて再試行してください。",
      503,
    );
  const properties = { [b.target]: { number: input.targetMinutes } };
  // Only modify the target of an existing page; preserve its title and memo.
  const page = existing.results.length
    ? await notion.pages.update({ page_id: existing.results[0].id, properties })
    : await notion.pages.create({
        parent: { type: "data_source_id", data_source_id: sourceId },
        properties: {
          ...properties,
          [b.week]: { date: { start: input.weekStart } },
          [title]: {
            title: [{ text: { content: `${input.weekStart} の週の目標` } }],
          },
        },
      });
  if (!("url" in page) || typeof page.url !== "string")
    throw new RecordError(
      "保存結果を確認できません。Notionで目標を確認してください。",
      409,
      undefined,
      true,
    );
  return { id: page.id, notionUrl: page.url };
}
