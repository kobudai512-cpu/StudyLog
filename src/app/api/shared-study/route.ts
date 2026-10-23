import { validShareToken } from "@/lib/sharing";
import { synchronize } from "@/lib/sync";
import { toSharedStudy } from "@/lib/shared-study";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Referrer-Policy": "no-referrer",
    },
  });
export async function GET(request: Request) {
  const token =
    request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  try {
    if (!(await validShareToken(token)))
      return json(
        { error: "この共有リンクは無効か、共有が停止されています。" },
        404,
      );
    const study = await synchronize(false);
    // Recheck after a potentially long Notion request, so revocation during sync takes effect.
    if (!(await validShareToken(token)))
      return json(
        { error: "この共有リンクは無効か、共有が停止されています。" },
        404,
      );
    return json(toSharedStudy(study));
  } catch {
    return json(
      {
        error:
          "学習データを取得できませんでした。時間をおいて再試行してください。",
      },
      503,
    );
  }
}
