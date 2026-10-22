import { authorized } from "@/lib/auth";
import { sameOrigin } from "@/lib/auth-policy";
import { recordSchema, writingEnabled } from "@/lib/notion-write";
import { submitRecord } from "@/lib/record-writer";
import { RecordError } from "@/lib/record-input";
import { invalidateStudy } from "@/lib/sync";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
const json = (data: unknown, status = 200, retryAfter?: number) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
    },
  });
export async function GET() {
  if (!(await authorized()))
    return json({ error: "ログインが必要です。" }, 401);
  try {
    const {
      bindings: _bindings,
      subjectIds: _ids,
      ...options
    } = await recordSchema();
    void _bindings;
    void _ids;
    return json(options);
  } catch {
    return json({ error: "Notionの入力項目を取得できませんでした。" }, 503);
  }
}
async function body(request: Request) {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new RecordError("JSON形式で送信してください。", 415);
  if (!request.body) throw new RecordError("入力がありません。");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8192) {
        await reader.cancel();
        throw new RecordError("入力が大きすぎます。", 413);
      }
      chunks.push(value);
    }
    const all = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      all.set(chunk, offset);
      offset += chunk.length;
    }
    try {
      return JSON.parse(new TextDecoder().decode(all));
    } catch {
      throw new RecordError("入力形式を確認してください。");
    }
  } finally {
    reader.releaseLock();
  }
}
export async function POST(request: Request) {
  if (!(await authorized()))
    return json({ error: "ログインが必要です。" }, 401);
  if (!sameOrigin(request))
    return json({ error: "送信元を確認できませんでした。" }, 403);
  if (!writingEnabled())
    return json({ error: "Notionへの保存は設定待ちです。" }, 503);
  try {
    const result = await submitRecord(
      await body(request),
      request.headers.get("idempotency-key") || "",
    );
    const refreshed = await invalidateStudy().catch(() => false);
    return json({ ...result, refreshPending: !refreshed }, 201);
  } catch (e) {
    return e instanceof RecordError
      ? json(
          { error: e.message, uncertain: e.uncertain },
          e.status,
          e.retryAfter,
        )
      : json(
          {
            error:
              "保存処理を開始できませんでした。接続設定を確認してください。",
          },
          503,
        );
  }
}
