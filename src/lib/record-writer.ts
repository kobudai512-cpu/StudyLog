import { createHash } from "node:crypto";
import { configuredStore } from "./store";
import type { CacheStore } from "./cache-types";
import {
  createNotionRecord,
  recordSchema,
  writingEnabled,
} from "./notion-write";
import {
  parseRecordInput,
  RecordError,
  type CreatedRecord,
} from "./record-input";
const WEEK = 7 * 86400000;
function retrySeconds(e: unknown) {
  const headers = (e as { headers?: Headers | Record<string, unknown> })
    .headers;
  const raw =
    headers instanceof Headers
      ? headers.get("retry-after")
      : Object.entries(headers ?? {}).find(
          ([key]) => key.toLowerCase() === "retry-after",
        )?.[1];
  const seconds = Number(raw);
  if (raw !== null && raw !== undefined && Number.isFinite(seconds))
    return Math.max(1, Math.ceil(seconds));
  const timestamp = typeof raw === "string" ? Date.parse(raw) : NaN;
  return Number.isFinite(timestamp)
    ? Math.max(1, Math.ceil((timestamp - Date.now()) / 1000))
    : 30;
}
export async function submitRecord(
  value: unknown,
  key: string,
  store: CacheStore = configuredStore("record-submissions"),
  schemaLoad = recordSchema,
  create = createNotionRecord,
): Promise<CreatedRecord> {
  if (!writingEnabled())
    throw new RecordError("Notionへの保存は設定待ちです。", 503);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      key,
    )
  )
    throw new RecordError("送信IDを確認してください。");
  const input = parseRecordInput(value);
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const lease = await store.lock();
  if (!lease)
    throw new RecordError(
      "別の記録を保存中です。少し待って再試行してください。",
      429,
      10,
    );
  try {
    const state = await store.read();
    const submissions = Object.fromEntries(
      Object.entries(state.submissions ?? {}).filter(
        ([, v]) => Date.now() - v.at < WEEK,
      ),
    );
    const prior = submissions[key];
    if (prior) {
      if (prior.hash !== hash)
        throw new RecordError(
          "同じ送信IDの内容が変わっています。フォームを開き直してください。",
          409,
        );
      if (prior.status === "created")
        return { id: prior.id!, notionUrl: prior.notionUrl! };
      if (prior.status !== "rejected")
        throw new RecordError(
          "保存結果が未確定です。重複を避けるため、Notionで記録を確認してください。",
          409,
          undefined,
          true,
        );
    }
    if (state.retryNotBefore && state.retryNotBefore > Date.now())
      throw new RecordError(
        "Notionの呼び出し制限中です。少し待ってください。",
        429,
        Math.ceil((state.retryNotBefore - Date.now()) / 1000),
      );
    if (state.lastAttempt && Date.now() - state.lastAttempt < 10000)
      throw new RecordError("保存は10秒に1回までです。", 429, 10);
    if (Object.keys(submissions).length >= 1000)
      throw new RecordError(
        "送信履歴の上限に達しました。しばらく待ってください。",
        429,
        3600,
      );
    const schema = await schemaLoad();
    if (!schema.subjects.includes(input.subject))
      throw new RecordError(
        "教科の選択肢が変わりました。フォームを開き直してください。",
      );
    if (input.unit && !schema.hasUnit)
      throw new RecordError("単元を空にして保存してください。");
    const pending = { hash, status: "pending" as const, at: Date.now() };
    submissions[key] = pending;
    state.submissions = submissions;
    state.lastAttempt = Date.now();
    await lease.write(state);
    let result: CreatedRecord;
    try {
      result = await create(input, schema);
    } catch (e) {
      const code = (e as { status?: number }).status;
      const definite =
        (e instanceof RecordError && !e.uncertain) ||
        code === 400 ||
        code === 401 ||
        code === 403 ||
        code === 404 ||
        code === 429;
      submissions[key] = {
        ...pending,
        status: definite ? "rejected" : "unknown",
      };
      const retry = code === 429 ? retrySeconds(e) : undefined;
      if (retry) state.retryNotBefore = Date.now() + retry * 1000;
      try {
        await lease.write(state);
      } catch {
        throw new RecordError(
          "保存結果を確定できません。再送せずNotionを確認してください。",
          409,
          undefined,
          true,
        );
      }
      throw new RecordError(
        definite
          ? "保存されませんでした。Notionの挿入権限・入力内容を確認してください。"
          : "保存結果を確認できません。再送せず、Notionを確認してください。",
        definite ? (code === 429 ? 429 : 503) : 409,
        retry,
        !definite,
      );
    }
    submissions[key] = { ...pending, status: "created", ...result };
    try {
      await lease.write(state);
    } catch {
      throw new RecordError(
        "保存後の確認に失敗しました。再送せず、Notionを確認してください。",
        409,
        undefined,
        true,
      );
    }
    return result;
  } finally {
    await lease().catch(() => {});
  }
}
