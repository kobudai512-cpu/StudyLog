import { authorized } from "@/lib/auth";
import { sameOrigin } from "@/lib/auth-policy";
import { SyncError, synchronize } from "@/lib/sync";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
function json(body: unknown, status = 200, retryAfter?: number) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
    },
  });
}
async function run(force: boolean) {
  try {
    return json(await synchronize(force));
  } catch (e) {
    return json(
      {
        error:
          e instanceof SyncError
            ? e.message
            : "接続またはキャッシュの設定を確認してください。",
      },
      e instanceof SyncError ? e.status : 503,
      e instanceof SyncError ? e.retryAfter : undefined,
    );
  }
}
export async function GET() {
  if (!(await authorized()))
    return json({ error: "ログインが必要です。" }, 401);
  return run(false);
}
export async function POST(request: Request) {
  if (!(await authorized()))
    return json({ error: "ログインが必要です。" }, 401);
  if (!sameOrigin(request))
    return json({ error: "送信元を確認できませんでした。" }, 403);
  return run(true);
}
