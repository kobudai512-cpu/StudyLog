import { authorized } from "@/lib/auth";
import { sameOrigin } from "@/lib/auth-policy";
import { recordSchema, writingEnabled } from "@/lib/notion-write";
import { submitRecord } from "@/lib/record-writer";
import { RecordError } from "@/lib/record-input";
import { invalidateStudy } from "@/lib/sync";
import { requestJson } from "@/lib/request-json";
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
export async function POST(request: Request) {
  if (!(await authorized()))
    return json({ error: "ログインが必要です。" }, 401);
  if (!sameOrigin(request))
    return json({ error: "送信元を確認できませんでした。" }, 403);
  if (!writingEnabled())
    return json({ error: "Notionへの保存は設定待ちです。" }, 503);
  try {
    const result = await submitRecord(
      await requestJson(request),
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
