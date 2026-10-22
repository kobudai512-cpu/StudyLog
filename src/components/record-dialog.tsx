"use client";
import { useRef, useState } from "react";
import { ExternalLink, Plus, X } from "lucide-react";
import { STUDY_LOG_URL } from "@/lib/study-features";
import {
  estimatedInterval,
  minutesLabel,
  SUBJECT_COLORS,
  tokyoDate,
  type StudyRecord,
} from "@/lib/study";
import {
  parseRecordInput,
  tokyoDateTimeInput,
  type RecordOptions,
} from "@/lib/record-input";

export default function RecordDialog({
  mode,
  onSaved,
}: {
  mode: "live" | "demo";
  onSaved: (record?: StudyRecord) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const sending = useRef(false);
  const requestId = useRef("");
  const sentPayload = useRef("");
  const [options, setOptions] = useState<RecordOptions | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [endedAt, setEndedAt] = useState("");
  const [duration, setDuration] = useState("");
  const [unit, setUnit] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<{ url: string; pending: boolean } | null>(
    null,
  );
  async function open() {
    dialog.current?.showModal();
    if (!endedAt) setEndedAt(tokyoDateTimeInput());
    if (uncertain || saved) return;
    setLoading(true);
    setError("");
    try {
      if (mode === "demo") {
        setOptions({
          enabled: true,
          subjects: Object.keys(SUBJECT_COLORS).filter((s) => s !== "未分類"),
          hasUnit: true,
        });
        return;
      }
      const response = await fetch("/api/records", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "入力項目を取得できませんでした。");
      setOptions(result);
    } catch (e) {
      setOptions(null);
      setError(e instanceof Error ? e.message : "接続を確認してください。");
    } finally {
      setLoading(false);
    }
  }
  const end = Date.parse(`${endedAt}+09:00`);
  const start = end - Number(duration) * 60000;
  const preview =
    endedAt &&
    Number(duration) > 0 &&
    Number(duration) <= 1440 &&
    Number.isFinite(start)
      ? `${new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(start))} 〜 ${new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(end))}`
      : "終了日時と実績時間を入力すると表示します";
  return (
    <>
      <button
        type="button"
        className="record-shortcut"
        onClick={() => void open()}
      >
        <Plus size={16} />
        記録する
      </button>
      <dialog
        ref={dialog}
        className="record-dialog"
        aria-labelledby="record-dialog-title"
        onCancel={(e) => {
          if (sending.current) e.preventDefault();
        }}
      >
        <div className="record-dialog-heading">
          <div>
            <h2 id="record-dialog-title">勉強を記録する</h2>
            <p>
              {mode === "demo"
                ? "デモ：架空データへの追加です。Notionには保存しません。"
                : "Study Logに新しい記録を保存します。"}
            </p>
          </div>
          <button
            type="button"
            className="dialog-close"
            aria-label="記録フォームを閉じる"
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        {saved ? (
          <div className="record-success" role="status">
            <h3>
              {mode === "demo" ? "デモに追加しました" : "Notionに保存しました"}
            </h3>
            <p>
              {title} · {subject} · {minutesLabel(Number(duration))}
            </p>
            {saved.pending && (
              <p>
                一覧の更新は保留中です。少し待って更新ボタンを押してください。
              </p>
            )}
            {saved.url && (
              <a href={saved.url} target="_blank" rel="noreferrer">
                Notionで確認 <ExternalLink size={14} />
              </a>
            )}
            <button
              className="primary"
              type="button"
              onClick={() => {
                setSaved(null);
                setTitle("");
                setDuration("");
                setUnit("");
                setEndedAt(tokyoDateTimeInput());
                requestId.current = "";
                sentPayload.current = "";
                dialog.current?.close();
              }}
            >
              閉じる
            </button>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (sending.current || uncertain || !options?.enabled) return;
              setError("");
              let input;
              try {
                input = parseRecordInput({
                  title,
                  subject,
                  endedAt: `${endedAt}+09:00`,
                  durationMinutes: Number(duration),
                  unit: options.hasUnit ? unit : "",
                });
              } catch (e) {
                setError((e as Error).message);
                return;
              }
              const payload = JSON.stringify(input);
              if (payload !== sentPayload.current || !requestId.current) {
                requestId.current = crypto.randomUUID();
                sentPayload.current = payload;
              }
              sending.current = true;
              setBusy(true);
              try {
                if (mode === "demo") {
                  const record: StudyRecord = {
                    id: `demo-new-${requestId.current}`,
                    date: tokyoDate(input.endedAt),
                    title: input.title,
                    subject: input.subject,
                    unit: input.unit,
                    durationMinutes: input.durationMinutes,
                    endedAt: input.endedAt,
                    updatedAt: new Date().toISOString(),
                    notionUrl: "",
                  };
                  // Same interval semantics as a live record; no external write in demo.
                  if (!estimatedInterval(record))
                    throw new Error("終了日時を確認してください。");
                  onSaved(record);
                  setSaved({ url: "", pending: false });
                  return;
                }
                let response: Response;
                try {
                  response = await fetch("/api/records", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Idempotency-Key": requestId.current,
                    },
                    body: payload,
                  });
                } catch {
                  setUncertain(true);
                  throw new Error(
                    "通信が途切れ、保存結果を確認できません。再送せず、Notionを確認してください。",
                  );
                }
                let result;
                try {
                  result = await response.json();
                } catch {
                  setUncertain(true);
                  throw new Error(
                    "保存結果を確認できません。再送せず、Notionを確認してください。",
                  );
                }
                if (!response.ok) {
                  if (result.uncertain) setUncertain(true);
                  throw new Error(result.error || "保存できませんでした。");
                }
                setSaved({
                  url: result.notionUrl,
                  pending: result.refreshPending,
                });
                onSaved();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                sending.current = false;
                setBusy(false);
              }
            }}
          >
            {loading && <p role="status">Notionの入力項目を確認しています…</p>}
            {options && !options.enabled && (
              <p className="notice">
                書き込み機能は設定待ちです。下書きは入力できます。
              </p>
            )}
            <fieldset disabled={busy || uncertain || loading || !options}>
              <label>
                勉強内容
                <input
                  autoFocus
                  required
                  maxLength={160}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例：物理のテスト勉強"
                />
              </label>
              <label>
                教科
                <select
                  aria-label="教科"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                >
                  <option value="">教科を選択</option>
                  {options?.subjects.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                終了日時（日本時間）
                <input
                  type="datetime-local"
                  required
                  value={endedAt}
                  min="2000-01-01T00:00"
                  onChange={(e) => setEndedAt(e.target.value)}
                />
              </label>
              <label>
                実績時間（分）
                <input
                  type="number"
                  required
                  min={1}
                  max={1440}
                  step={1}
                  inputMode="numeric"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="例：31"
                />
              </label>
              {options?.hasUnit && (
                <label>
                  単元（任意）
                  <input
                    maxLength={200}
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  />
                </label>
              )}
            </fieldset>
            <div className="record-preview">
              <strong>推定した学習時間帯</strong>
              <p>{preview}</p>
              <small>
                終了時刻から実績分だけ逆算します。休憩は判別できません。
              </small>
            </div>
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            <div className="record-dialog-actions">
              <a href={STUDY_LOG_URL} target="_blank" rel="noreferrer">
                Notionで確認 <ExternalLink size={14} />
              </a>
              <button
                type="submit"
                className="primary"
                disabled={busy || loading || uncertain || !options?.enabled}
              >
                {busy
                  ? "保存中…"
                  : mode === "demo"
                    ? "デモに追加"
                    : "Notionに保存"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
