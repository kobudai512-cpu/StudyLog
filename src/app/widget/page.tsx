import { authorized } from "@/lib/auth";
import { widgetSettings } from "@/lib/widget";
import WidgetSetup from "@/components/widget-setup";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "スマホ連携 | Winkle Study",
  referrer: "no-referrer",
};
export default async function WidgetPage() {
  const authenticated = await authorized();
  let enabled: boolean | null = null;
  if (authenticated) {
    try {
      enabled = (await widgetSettings()).enabled;
    } catch {
      /* Client offers retry. */
    }
  }
  return <WidgetSetup authenticated={authenticated} initialEnabled={enabled} />;
}
