"use client";
import { useRef, useState } from "react";
import { Check, Copy, Link2, Share2, X } from "lucide-react";

type Settings = { enabled: boolean; path: string | null };
export default function ShareDialog({ demo = false }: { demo?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const sending = useRef(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [origin, setOrigin] = useState("");
  async function load(method: "GET" | "POST" | "DELETE") {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (demo) {
        setSettings((current) =>
          method === "GET"
            ? current || { enabled: false, path: null }
            : method === "POST"
              ? { enabled: true, path: "/demo/share" }
              : { enabled: false, path: null },
        );
      } else {
        const response = await fetch("/api/share", {
          method,
          cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "共有設定を取得できませんでした。");
        setSettings(result);
      }
      if (method === "DELETE")
        setMessage("共有を停止しました。以前のリンクは使えません。");
      if (method === "POST") setMessage("閲覧専用リンクを作成しました。");
    } catch (err) {
      setSettings(null);
      setError(err instanceof Error ? err.message : "接続を確認してください。");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  const url = settings?.path ? `${origin}${settings.path}` : "";
  return (
    <>
      <button
        className="record-shortcut"
        onClick={() => {
          setOrigin(window.location.origin);
          dialog.current?.showModal();
          void load("GET");
        }}
      >
        <Share2 size={16} />
        {demo ? "共有を試す" : "共有"}
      </button>
      <dialog
        ref={dialog}
        className="record-dialog share-dialog"
        aria-labelledby="share-dialog-title"
        onCancel={(e) => {
          if (sending.current) e.preventDefault();
        }}
      >
        <div className="record-dialog-heading">
          <div>
            <h2 id="share-dialog-title">閲覧専用リンク</h2>
            <p>友達や家族に、学びの積み重ねをシェア。</p>
          </div>
          <button
            className="dialog-close"
            aria-label="共有設定を閉じる"
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        {demo && (
          <p className="notice">
            デモ用のお試しです。実際の学習データは共有されません。
          </p>
        )}
        <div className="share-scope">
          <strong>共有するもの</strong>
          <p>学習時間・教科別の内訳・カレンダー・週の目標と達成率</p>
          <strong>自分だけに残すもの</strong>
          <p>勉強内容・単元・メモ・Notionへのリンク</p>
        </div>
        <p className="goal-form-note">
          リンクを知っている人はログインなしで閲覧できます。転送された相手も見られます。記録や目標の変更はできません。
        </p>
        {busy && <p role="status">共有設定を確認しています…</p>}
        {settings && (
          <>
            <p className="share-state">
              <span
                className={settings.enabled ? "share-dot enabled" : "share-dot"}
              />
              {settings.enabled
                ? "リンクを知っている人に共有中"
                : "共有はオフです"}
            </p>
            {url && (
              <div className="share-url">
                <label htmlFor="share-url">閲覧専用URL</label>
                <input
                  id="share-url"
                  readOnly
                  value={url}
                  onFocus={(e) => e.target.select()}
                />
                <div className="share-url-actions">
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(url);
                        setMessage("リンクをコピーしました。");
                      } catch {
                        setError(
                          "コピーできませんでした。URLを選択してコピーしてください。",
                        );
                      }
                    }}
                  >
                    <Copy size={15} />
                    リンクをコピー
                  </button>
                  <a href={settings.path!} target="_blank" rel="noreferrer">
                    <Link2 size={15} />
                    表示を確認 ↗
                  </a>
                </div>
              </div>
            )}
            {settings.enabled && !url && (
              <p className="notice">
                現在のリンクを取得できません。リンクを作り直すか、共有を停止できます。
              </p>
            )}
            <div className="share-manage">
              <button
                className={settings.enabled ? "refresh-button" : "primary"}
                disabled={busy}
                onClick={() => void load("POST")}
              >
                {settings.enabled
                  ? "新しいリンクに作り直す"
                  : "閲覧専用リンクを作成"}
              </button>
              {settings.enabled && (
                <button
                  className="share-stop"
                  disabled={busy}
                  onClick={() => void load("DELETE")}
                >
                  共有を停止
                </button>
              )}
            </div>
            {settings.enabled && (
              <p className="goal-form-note">
                作り直すと、以前のリンクは使えなくなります。共有ページは自動で更新されます。
              </p>
            )}
          </>
        )}
        {error && (
          <div className="notice error" role="alert">
            {error}
            <button
              className="refresh-button"
              disabled={busy}
              onClick={() => void load("GET")}
            >
              設定を再取得
            </button>
          </div>
        )}
        {message && (
          <p className="share-feedback" role="status">
            <Check size={16} />
            {message}
          </p>
        )}
      </dialog>
    </>
  );
}
