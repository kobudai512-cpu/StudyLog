import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { authConfigured } from "@/lib/auth-policy";
export const dynamic = "force-dynamic";
const handler = NextAuth(authOptions);
const unavailable = () =>
  Response.json({ error: "Google認証が未設定です。" }, { status: 503 });
export const GET = authConfigured() ? handler : unavailable;
export const POST = authConfigured() ? handler : unavailable;
