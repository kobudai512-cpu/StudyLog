import {
  GOALS_SOURCE_ID,
  resolveGoalBindings,
  normalizeGoals,
  type GoalBindings,
} from "./goals";
import { Client, LogLevel } from "@notionhq/client";
import type { QueryDataSourceParameters } from "@notionhq/client/build/src/api-endpoints";
import {
  NOTION_VERSION,
  SOURCE_ID,
  resolveBindings,
  normalizePages,
  type Bindings,
  type RawPage,
  type SchemaProperty,
} from "./notion-schema";
import type { Snapshot } from "./study";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// The SDK's own retries are disabled so Retry-After is never capped or retried twice.
export function retryingFetch(
  base: typeof fetch = fetch,
  wait: (ms: number) => Promise<unknown> = sleep,
): typeof fetch {
  return async (input, init) => {
    for (let attempt = 0; ; attempt++) {
      const response = await base(input, init);
      if (
        ![429, 500, 502, 503, 504, 529].includes(response.status) ||
        attempt >= 3
      )
        return response;
      if (response.status === 429) {
        const body = await response
          .clone()
          .json()
          .catch(() => null);
        if (
          body?.additional_data?.rate_limit_reason ===
          "public_api_request_blocked"
        )
          return response;
      }
      const retryAfter = response.headers.get("retry-after");
      const seconds = retryAfter === null ? NaN : Number(retryAfter);
      const delay = Number.isFinite(seconds)
        ? Math.max(0, seconds * 1000)
        : Math.min(1000 * 2 ** attempt, 30000);
      // Do not retry early if a hosting request budget cannot accommodate the delay.
      if (delay > 60000) return response;
      await response.body?.cancel();
      await wait(delay + Math.random() * 200);
    }
  };
}

export type QueryResult = {
  results: unknown[];
  has_more: boolean;
  next_cursor: string | null;
  request_status?: { type: string };
};
type Query = (args: QueryDataSourceParameters) => Promise<QueryResult>;
// Partition by creation timestamp ONLY for retrieval completeness; aggregation uses study date.
export async function queryAll(
  query: Query,
  sourceId: string,
  ids: string[],
  from = 0,
  to = Date.now() + 86400000,
  depth = 0,
): Promise<RawPage[]> {
  const rows: unknown[] = [];
  let cursor: string | undefined;
  const cursors = new Set<string>();
  do {
    const result = await query({
      data_source_id: sourceId,
      page_size: 100,
      start_cursor: cursor,
      filter_properties: ids,
      filter: {
        and: [
          {
            timestamp: "created_time",
            created_time: { on_or_after: new Date(from).toISOString() },
          },
          {
            timestamp: "created_time",
            created_time: { before: new Date(to).toISOString() },
          },
        ],
      },
    });
    if (
      result.request_status?.type === "incomplete" ||
      rows.length + result.results.length >= 10000
    ) {
      if (to - from <= 1 || depth >= 48)
        throw new Error("Notionのクエリ上限を安全に分割できませんでした。");
      const middle = Math.floor((from + to) / 2);
      return [
        ...(await queryAll(query, sourceId, ids, from, middle, depth + 1)),
        ...(await queryAll(query, sourceId, ids, middle, to, depth + 1)),
      ];
    }
    rows.push(...result.results);
    if (!result.has_more) break;
    if (!result.next_cursor || cursors.has(result.next_cursor))
      throw new Error("Notionのページ取得が完了しませんでした。");
    cursors.add(result.next_cursor);
    cursor = result.next_cursor;
  } while (cursor);
  return rows.filter(
    (r): r is RawPage =>
      typeof r === "object" && r !== null && "properties" in r && "id" in r,
  );
}
export async function fetchNotion(
  saved?: Bindings,
  savedGoals?: GoalBindings,
): Promise<{
  snapshot: Snapshot;
  bindings: Bindings;
  goalBindings?: GoalBindings;
}> {
  if (!process.env.NOTION_TOKEN)
    throw new Error(
      "Notion接続が未設定です。サーバーの環境変数を設定してください。",
    );
  const notion = new Client({
    auth: process.env.NOTION_TOKEN,
    notionVersion: NOTION_VERSION,
    retry: false,
    timeoutMs: 240000,
    logLevel: LogLevel.ERROR,
    logger: () => {},
    fetch: retryingFetch(),
  });
  const sourceId = process.env.NOTION_DATA_SOURCE_ID || SOURCE_ID;
  const source = await notion.dataSources.retrieve({
    data_source_id: sourceId,
  });
  if (!("properties" in source))
    throw new Error("Notionスキーマを確認できませんでした。");
  let overrides: Partial<Bindings> | undefined;
  if (process.env.NOTION_PROPERTY_IDS)
    overrides = JSON.parse(process.env.NOTION_PROPERTY_IDS);
  const bindings = resolveBindings(
    source.properties as Record<string, SchemaProperty>,
    saved,
    overrides,
  );
  const pages = await queryAll(
    (args) => notion.dataSources.query(args),
    sourceId,
    Object.values(bindings).filter(Boolean),
  );
  let goalData: Pick<Snapshot, "goals" | "goalIssues" | "goalError">;
  let goalBindings: GoalBindings | undefined;
  try {
    const goalSourceId =
      process.env.NOTION_GOALS_DATA_SOURCE_ID || GOALS_SOURCE_ID;
    const goalSource = await notion.dataSources.retrieve({
      data_source_id: goalSourceId,
    });
    if (!("properties" in goalSource)) throw new Error();
    goalBindings = resolveGoalBindings(
      goalSource.properties as Record<string, SchemaProperty>,
      savedGoals,
      process.env.NOTION_GOALS_PROPERTY_IDS
        ? JSON.parse(process.env.NOTION_GOALS_PROPERTY_IDS)
        : undefined,
    );
    const goalPages = await queryAll(
      (args) => notion.dataSources.query(args),
      goalSourceId,
      Object.values(goalBindings),
    );
    goalData = normalizeGoals(goalPages, goalBindings);
  } catch {
    goalData = {
      goalError:
        "週の目標を同期できません。Notionの読み取り接続・プロパティ対応を確認し、更新してください。",
    };
  }
  return {
    snapshot: {
      ...normalizePages(pages, bindings),
      ...goalData,
      syncedAt: new Date().toISOString(),
    },
    bindings,
    goalBindings,
  };
}
