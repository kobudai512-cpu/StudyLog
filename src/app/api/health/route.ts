export const dynamic = "force-dynamic";

// Liveness only: this endpoint never returns private records or configuration.
export function GET() {
  return Response.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
