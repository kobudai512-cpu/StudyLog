import SharedDashboard from "@/components/shared-dashboard";
import { demoSnapshot } from "@/lib/demo";
import { toSharedStudy } from "@/lib/shared-study";
export const dynamic = "force-dynamic";
export default function DemoSharePage() {
  return (
    <SharedDashboard
      sample={toSharedStudy({ ...demoSnapshot(), mode: "demo", stale: false })}
    />
  );
}
