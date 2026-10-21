import { authorized } from "@/lib/auth";
import { authConfigured } from "@/lib/auth-policy";
import Dashboard from "@/components/dashboard";
export const dynamic = "force-dynamic";
export default async function Page() {
  return (
    <Dashboard
      mode="live"
      authenticated={await authorized()}
      authReady={authConfigured()}
    />
  );
}
