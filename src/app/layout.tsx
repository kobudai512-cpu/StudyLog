import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Winkle Study — 学びの積み重ねを、見える形に。",
  description: "Notionの学習記録を振り返る、あなただけの勉強ダッシュボード。",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
