"use client";
import { useRef, useState } from "react";
import { Check, Target, X } from "lucide-react";
import DurationInput from "./duration-input";
import { parseGoalInput } from "@/lib/goal-input";
import { GOALS_URL } from "@/lib/goals";
import { minutesLabel, type WeeklyStudyGoal } from "@/lib/study";

export default function GoalDialog({
  mode,
  weekStart,
  goal,
  disabled,
  onSaved,
}: {
  mode: "demo" | "live";
  weekStart: string;
  goal?: WeeklyStudyGoal;
  disabled: boolean;
  onSaved: (goal: WeeklyStudyGoal) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const sending = useRef(false);
  const requestId = useRef("");
  const payloadRef = useRef("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <>
      <button
        className="primary goal-edit"
        disabled={disabled}
        onClick={() => {
          if (!uncertain) {
            requestId.current = "";
            payloadRef.current = "";
            setHours(
              goal?.targetMinutes
                ? String(Math.floor(goal.targetMinutes / 60))
                : "",
            );
            setMinutes(
              goal?.targetMinutes ? String(goal.targetMinutes % 60) : "",
            );
            setError("");
            setSaved(false);
          }
          dialog.current?.showModal();
        }}
      >
        <Target size={16} />
        {goal?.targetMinutes ? "目標を変更" : "目標を設定"}
      </button>
      <dialog
        ref={dialog}
        className="record-dialog goal-dialog"
        aria-labelledby="goal-dialog-title"
        onCancel={(e) => {
          if (sending.current) e.preventDefault();
        }}
      >
        <div className="record-dialog-heading">
          <div>
            <h2 id="goal-dialog-title">週の目標を設定</h2>
            <p>{weekStart}からの週 · すべての教科</p>
          </div>
          <button
            className="dialog-close"
            aria-label="目標フォームを閉じる"
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        {saved ? (
          <div className="record-success" role="status">
            <span className="success-badge">
              <Check size={26} />
            </span>
            <h3>
              {mode === "demo"
                ? "デモの目標を更新しました"
                : "Notionに目標を保存しました"}
            </h3>
            <p>
              今週の一歩を、少しずつ。目標は{" "}
              {minutesLabel(Number(hours) * 60 + Number(minutes))} です。
            </p>
            <button className="primary" onClick={() => dialog.current?.close()}>
              閉じる
            </button>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (sending.current || uncertain) return;
              setError("");
              let input;
              try {
                input = parseGoalInput({
                  weekStart,
                  targetMinutes: Number(hours) * 60 + Number(minutes),
                });
              } catch (err) {
                setError((err as Error).message);
                return;
              }
              const payload = JSON.stringify(input);
              if (payloadRef.current !== payload || !requestId.current) {
                requestId.current = crypto.randomUUID();
                payloadRef.current = payload;
              }
              sending.current = true;
              setBusy(true);
              try {
                let result = {
                  id: goal?.id || `demo-goal-${weekStart}`,
                  notionUrl: goal?.notionUrl || "",
                };
                if (mode === "live") {
                  let response: Response;
                  try {
                    response = await fetch("/api/goals", {
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
                      "通信が途切れました。再送せずNotionで目標を確認してください。",
                    );
                  }
                  let data;
                  try {
                    data = await response.json();
                  } catch {
                    setUncertain(true);
                    throw new Error(
                      "保存結果を確認できません。Notionで目標を確認してください。",
                    );
                  }
                  if (!response.ok) {
                    if (data.uncertain) setUncertain(true);
                    throw new Error(
                      data.error || "目標を保存できませんでした。",
                    );
                  }
                  result = data;
                }
                onSaved({ ...goal, ...result, ...input });
                setSaved(true);
              } catch (err) {
                setError((err as Error).message);
              } finally {
                sending.current = false;
                setBusy(false);
              }
            }}
          >
            <p className="goal-form-note">
              {mode === "demo"
                ? "デモ用の体験です。Notionには保存されず、再読み込みで戻ります。"
                : "このサイトで設定した目標をNotionにも保存します。"}
            </p>
            <fieldset disabled={busy || uncertain}>
              <DurationInput
                label="目標時間"
                hours={hours}
                minutes={minutes}
                onHours={setHours}
                onMinutes={setMinutes}
                maxHours={168}
              />
            </fieldset>
            <div className="record-preview">
              <strong>自分に合ったペースで</strong>
              <p>1分〜168時間。途中で目標を見直しても大丈夫です。</p>
            </div>
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            <div className="record-dialog-actions">
              <a
                href={goal?.notionUrl || GOALS_URL}
                target="_blank"
                rel="noreferrer"
              >
                Notionで確認 ↗
              </a>
              <button
                type="submit"
                className="primary"
                disabled={busy || uncertain}
              >
                {busy
                  ? "保存中…"
                  : mode === "demo"
                    ? "デモの目標を保存"
                    : "Notionに目標を保存"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
