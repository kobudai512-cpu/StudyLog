import { validWidgetToken, widgetSummary } from "@/lib/widget";
import { synchronize } from "@/lib/sync";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    },
  });
export async function GET(request: Request) {
  const token =
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  try {
    if (!(await validWidgetToken(token)))
      return json({ error: "連携キーが無効です。" }, 401);
    const study = await synchronize(false);
    if (!(await validWidgetToken(token)))
      return json({ error: "連携が解除されました。" }, 401);
    return json(widgetSummary(study));
  } catch {
    return json({ error: "更新できませんでした。" }, 503);
  }
}
