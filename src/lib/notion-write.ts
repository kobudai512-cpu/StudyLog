import { Client, LogLevel } from "@notionhq/client";
import {
  NOTION_VERSION,
  SOURCE_ID,
  resolveBindings,
  type SchemaProperty,
} from "./notion-schema";
import type { Bindings } from "./notion-schema";
import { configuredStore } from "./store";
import {
  RecordError,
  type RecordInput,
  type RecordOptions,
  type CreatedRecord,
} from "./record-input";
export function writingEnabled() {
  return process.env.NOTION_WRITE_ENABLED === "true";
}
function client() {
  // A creation POST must never be retried automatically after an ambiguous response.
  return new Client({
    auth: process.env.NOTION_WRITE_TOKEN || process.env.NOTION_TOKEN,
    notionVersion: NOTION_VERSION,
    retry: false,
    timeoutMs: 20000,
    logLevel: LogLevel.ERROR,
    logger() {},
  });
}
export async function recordSchema(): Promise<
  RecordOptions & { bindings: Bindings; subjectIds: Record<string, string> }
> {
  const source = await client().dataSources.retrieve({
    data_source_id: process.env.NOTION_DATA_SOURCE_ID || SOURCE_ID,
  });
  if (!("properties" in source))
    throw new RecordError("Study Logの項目を取得できません。", 503);
  const bindings = resolveBindings(
    source.properties as Record<string, SchemaProperty>,
    (await configuredStore().read()).bindings,
    process.env.NOTION_PROPERTY_IDS
      ? JSON.parse(process.env.NOTION_PROPERTY_IDS)
      : undefined,
  );
  const subject = Object.values(source.properties).find(
    (p) => p.id === bindings.subject,
  );
  if (!subject || subject.type !== "select")
    throw new RecordError("教科の設定を確認してください。", 503);
  return {
    enabled: writingEnabled(),
    subjects: subject.select.options.map((o) => o.name),
    subjectIds: Object.fromEntries(
      subject.select.options.map((o) => [o.name, o.id]),
    ),
    hasUnit: Boolean(bindings.unit),
    bindings,
  };
}
export async function createNotionRecord(
  input: RecordInput,
  schema: Awaited<ReturnType<typeof recordSchema>>,
): Promise<CreatedRecord> {
  if (!schema.subjects.includes(input.subject))
    throw new RecordError("Notionに存在する教科を選んでください。");
  if (input.unit && !schema.hasUnit)
    throw new RecordError(
      "Notionに単元の項目がありません。単元を空にして保存してください。",
    );
  const b = schema.bindings;
  const page = await client().pages.create({
    parent: {
      type: "data_source_id",
      data_source_id: process.env.NOTION_DATA_SOURCE_ID || SOURCE_ID,
    },
    properties: {
      [b.title]: { title: [{ text: { content: input.title } }] },
      [b.subject]: { select: { id: schema.subjectIds[input.subject] } },
      [b.date]: { date: { start: input.endedAt } },
      [b.duration]: { number: input.durationMinutes },
      ...(b.unit
        ? {
            [b.unit]: {
              rich_text: input.unit ? [{ text: { content: input.unit } }] : [],
            },
          }
        : {}),
    },
  });
  if (!("url" in page))
    throw new RecordError(
      "保存結果を確認できませんでした。Notionを確認してください。",
      409,
      undefined,
      true,
    );
  return { id: page.id, notionUrl: page.url };
}
