export function allowedEmail(
  email: unknown,
  allowlist = process.env.ALLOWED_EMAILS ?? "",
): boolean {
  return (
    typeof email === "string" &&
    allowlist
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .includes(email.toLowerCase())
  );
}
export function authConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.NEXTAUTH_SECRET &&
    process.env.NEXTAUTH_URL &&
    process.env.ALLOWED_EMAILS?.trim(),
  );
}
export function sameOrigin(request: Request) {
  const expected = process.env.NEXTAUTH_URL;
  return Boolean(
    expected &&
    request.headers.get("origin") === new URL(expected).origin &&
    request.headers.get("sec-fetch-site") !== "cross-site",
  );
}
