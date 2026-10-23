import type { Metadata } from "next";
import SharedDashboard from "@/components/shared-dashboard";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "学習の記録を共有 | Winkle Study",
  referrer: "no-referrer",
  robots: { index: false, follow: false, noarchive: true },
};
export default async function SharedPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <SharedDashboard token={(await params).token} />;
}
