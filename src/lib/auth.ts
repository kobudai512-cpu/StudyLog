import { getServerSession, type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { allowedEmail, authConfigured } from "./auth-policy";
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: authConfigured()
    ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
      ]
    : [],
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  callbacks: {
    async signIn({ account, profile }) {
      return (
        account?.provider === "google" &&
        (profile as { email_verified?: boolean })?.email_verified === true &&
        allowedEmail(profile?.email)
      );
    },
    async jwt({ token, account, profile }) {
      if (account)
        token.verified =
          account.provider === "google" &&
          (profile as { email_verified?: boolean })?.email_verified === true;
      return token;
    },
    async session({ session, token }) {
      if (token.verified !== true || !allowedEmail(token.email))
        session.user = undefined;
      return session;
    },
  },
  logger: {
    error() {
      /* Never emit OAuth payloads or credentials. */
    },
    warn() {},
    debug() {},
  },
};
export async function authorized() {
  if (!authConfigured()) return false;
  const session = await getServerSession(authOptions);
  return allowedEmail(session?.user?.email);
}
