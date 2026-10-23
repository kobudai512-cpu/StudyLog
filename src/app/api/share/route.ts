import { authorized } from "@/lib/auth";
import { sameOrigin } from "@/lib/auth-policy";
import { shareSettings, changeSharing } from "@/lib/sharing";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function GET() {
  if (!(await authorized()))
    return json({ error: "ログインが必要です。" }, 401);
  try {
    return json(await shareSettings());
  } catch {
    return json({ error: "共有設定を取得できませんでした。" }, 503);
  }
}
async function change(request: Request, enabled: boolean) {
  if (!(await authorized()))
    return json({ error: "ログインが必要です。" }, 401);
  if (!sameOrigin(request))
    return json({ error: "送信元を確認できませんでした。" }, 403);
  try {
    return json(await changeSharing(enabled));
  } catch {
    return json(
      {
        error: "共有設定を保存できませんでした。少し待って再試行してください。",
      },
      503,
    );
  }
}
export const POST = (request: Request) => change(request, true);
export const DELETE = (request: Request) => change(request, false);
