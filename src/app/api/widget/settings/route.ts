import { authorized } from "@/lib/auth";
import { sameOrigin } from "@/lib/auth-policy";
import { widgetSettings, changeWidget } from "@/lib/widget";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
export async function GET() {
  if (!(await authorized()))
    return json({ error: "ログインが必要です。" }, 401);
  try {
    return json(await widgetSettings());
  } catch {
    return json({ error: "設定を取得できませんでした。" }, 503);
  }
}
async function change(request: Request, enabled: boolean) {
  if (!(await authorized()))
    return json({ error: "ログインが必要です。" }, 401);
  if (!sameOrigin(request))
    return json({ error: "送信元を確認できませんでした。" }, 403);
  try {
    return json(await changeWidget(enabled));
  } catch {
    return json(
      { error: "保存できませんでした。少し待って再試行してください。" },
      503,
    );
  }
}
export const POST = (request: Request) => change(request, true);
export const DELETE = (request: Request) => change(request, false);
