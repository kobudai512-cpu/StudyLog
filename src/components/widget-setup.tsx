"use client";
import { useSessionRenewal } from "./use-session-renewal";
import { useRef, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function WidgetSetup({
  authenticated,
  initialEnabled,
}: {
  authenticated: boolean;
  initialEnabled: boolean | null;
}) {
  useSessionRenewal(authenticated);
  const [enabled, setEnabled] = useState<boolean | null>(initialEnabled);
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function request(method = "GET") {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/widget/settings", {
        method,
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "操作に失敗しました。");
      setEnabled(data.enabled);
      setToken(data.token || "");
      if (method === "DELETE")
        setMessage(
          "連携を解除しました。端末に保存済みの表示は、次の通信時に消えます。",
        );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "通信できませんでした。");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="widget-setup">
      <Link href="/" className="widget-back">
        ← 学習ノートに戻る
      </Link>
      <header>
        <h1>スマホ連携</h1>
      </header>
      <div
        className="widget-preview"
        aria-label="ウィジェットの表示例。実際の学習データではありません。"
      >
        <span className="widget-preview-heading">
          THIS WEEK <span aria-hidden="true">↻</span>
        </span>
        <strong>12h 40m</strong>
        <span>/ 15h</span>
        <div className="widget-preview-track">
          <i />
        </div>
      </div>
      <section>
        <h2>1. Androidアプリを入れる</h2>
        <p>
          Android
          12以降に対応。更新する場合も、同じアプリに上書きインストールできます。Chromeでダウンロードし、APKを開いてインストールしてください。初回はChromeからのインストール許可が必要です。
        </p>
        <a
          className="widget-primary"
          href="/downloads/winkle-study.apk"
          download
        >
          Androidアプリをダウンロード
        </a>
        <p className="widget-note">
          バージョン 1.3.0 · このサイトから配布する専用アプリです。
        </p>
      </section>
      <section>
        <h2>ホーム画面のアイコンも、このアプリに</h2>
        <p>
          インストール後、アプリ一覧にある「Winkle
          Study」をホーム画面へ置いてください。アイコンをタップすると独立したアプリ画面で学習サイトを開きます。
        </p>
        <p>
          Android専用の単色アイコンを使用します。ウィジェット設定はアイコンの長押しから開けます。既に連携済みなら、上書き更新で連携キーを引き継ぎます。
        </p>
      </section>
      <section>
        <h2>2. 学習ノートと連携する</h2>
        <p>
          キーを発行し、アプリアイコンを長押し
          →「ウィジェット設定」の入力欄へ貼り付けます。渡すのは今週の学習時間と目標だけ。記録の本文やNotionの認証情報は渡しません。
        </p>
        {!authenticated ? (
          <button
            className="widget-primary"
            onClick={() => signIn("google", { callbackUrl: "/widget" })}
          >
            ログインして連携する
          </button>
        ) : (
          <>
            <p>
              {enabled === null
                ? "連携設定を確認"
                : enabled
                  ? "連携キーは有効です。再発行すると以前のキーは無効になります。"
                  : "現在、連携している端末はありません。"}
            </p>
            <div className="widget-actions">
              <button
                className="widget-primary"
                disabled={busy}
                onClick={() =>
                  request(enabled ? "POST" : enabled === null ? "GET" : "POST")
                }
              >
                {busy
                  ? "処理中…"
                  : enabled === null
                    ? "再読み込み"
                    : enabled
                      ? "キーを再発行"
                      : "連携キーを発行"}
              </button>
              {enabled && (
                <button disabled={busy} onClick={() => request("DELETE")}>
                  連携を解除
                </button>
              )}
            </div>
            {token && (
              <div className="widget-key">
                <label htmlFor="widget-token">
                  連携キー（この画面で一度だけ表示）
                </label>
                <input
                  id="widget-token"
                  readOnly
                  value={token}
                  autoComplete="off"
                  spellCheck={false}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(token);
                      setMessage(
                        "コピーしました。Androidアプリへ貼り付けてください。",
                      );
                    } catch {
                      setMessage("キーを選択して手動でコピーしてください。");
                    }
                  }}
                >
                  キーをコピー
                </button>
                <p>
                  このキーを知っている人は週次集計を取得できます。他の人に送らないでください。
                </p>
              </div>
            )}
          </>
        )}
        <p role="status" aria-live="polite">
          {message}
        </p>
      </section>
      <section>
        <h2>3. ホーム画面に置く</h2>
        <p>
          アプリアイコンを長押し
          →「ウィジェット設定」を開き、「ホーム画面にウィジェットを追加」を押します。2×2を基本に、サイズは自由に調整できます。以前のウィジェットが3×3のままなら、ホーム画面からウィジェットだけを削除して追加し直してください。アプリの削除やキーの再発行は不要です。
        </p>
        <p>
          ダーク時は黒地に白、ライト時は白地に黒。通常は約30分ごとに更新し、表示の更新アイコンでも取得できます。省電力設定や通信状況で更新が遅れる場合は、前回の値と時刻を表示します。
        </p>
        <p>
          ホーム画面の単色アイコンは、Nothingの「テーマアイコン」を有効にしてください。アイコンの最終的な配色はランチャーが決めます。
        </p>
      </section>
    </main>
  );
}
