"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Target } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { minutesLabel, type StudyRecord } from "@/lib/study";
import {
  goalProgress,
  hourlyStudy,
  monthCalendar,
  shiftMonth,
  STUDY_LOG_URL,
} from "@/lib/study-features";

export function RecordShortcut() {
  return (
    <a
      className="record-shortcut"
      href={STUDY_LOG_URL}
      target="_blank"
      rel="noreferrer"
    >
      <ExternalLink size={15} /> Notionで記録する
    </a>
  );
}

export function WeeklyGoal({
  total,
  mode,
  weekStart,
}: {
  total: number;
  mode: "live" | "demo";
  weekStart: string;
}) {
  const key = `winkle-weekly-goal-v1-${mode}`;
  const [target, setTarget] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const value = Number(localStorage.getItem(key));
      if (goalProgress(0, value)) {
        // Loading browser-owned preferences only after hydration.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTarget(value);
        setDraft(String(value));
      }
    } catch {
      setMessage("保存設定を読み込めません。この画面内で目標を使えます。");
    }
    setReady(true);
  }, [key]);
  const progress = target ? goalProgress(total, target) : null;
  return (
    <section className="panel goal-panel" aria-label="週の目標">
      <div className="panel-heading">
        <div>
          <h3>
            <Target size={18} /> 週の目標
          </h3>
          <p>{weekStart}からの今週・すべての教科</p>
        </div>
        <span className="unit-tag">このブラウザに保存</span>
      </div>
      <div className="goal-body">
        {progress ? (
          <div className="goal-result">
            <div>
              <strong>{progress.percent.toFixed(1)}%</strong>
              <span>
                {minutesLabel(total)} / {minutesLabel(target!)}
              </span>
            </div>
            <progress
              aria-label="週の目標達成率"
              max={100}
              value={Math.min(100, progress.percent)}
            />
            <p>
              {progress.remaining > 0
                ? `今週あと ${minutesLabel(progress.remaining)}`
                : "今週の目標を達成しました！"}
            </p>
          </div>
        ) : (
          <p className="muted">
            週の目標を決めて、今週の積み重ねを確認しましょう。
          </p>
        )}
        <form
          className="goal-form"
          onSubmit={(e) => {
            e.preventDefault();
            const value = Number(draft);
            if (!Number.isInteger(value) || !goalProgress(0, value)) {
              setMessage("1〜10080分の整数で入力してください。");
              return;
            }
            setTarget(value);
            try {
              localStorage.setItem(key, String(value));
              setMessage("目標を保存しました。次の週にも引き継ぎます。");
            } catch {
              setMessage(
                "保存できませんでした。今回の表示中だけ目標を使います。",
              );
            }
          }}
        >
          <label>
            毎週の目標（分）
            <input
              type="number"
              min="1"
              max="10080"
              step="1"
              required
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="例：600"
              disabled={!ready}
            />
          </label>
          <button className="refresh-button" disabled={!ready}>
            目標を保存
          </button>
          {target && (
            <button
              type="button"
              className="refresh-button"
              onClick={() => {
                try {
                  localStorage.removeItem(key);
                  setTarget(null);
                  setDraft("");
                  setMessage("目標を解除しました。");
                } catch {
                  setMessage("保存済みの目標を解除できませんでした。");
                }
              }}
            >
              解除
            </button>
          )}
        </form>
        {message && (
          <p className="goal-message" role="status">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}

export function StudyCalendar({
  records,
  month,
  onMonth,
  subject,
  selectedDate,
  today,
  onDay,
}: {
  records: StudyRecord[];
  month: string;
  onMonth: (month: string) => void;
  subject: string;
  selectedDate?: string;
  today: string;
  onDay: (date: string) => void;
}) {
  const cells = monthCalendar(records, month, subject);
  return (
    <section className="panel calendar-panel" aria-label="月間カレンダー">
      <div className="panel-heading">
        <div>
          <h3>月間カレンダー</h3>
          <p>日を選ぶと、その日の時間帯別グラフと記録を表示</p>
        </div>
      </div>
      <div className="calendar-navigation">
        <button
          aria-label="前の月"
          onClick={() => onMonth(shiftMonth(month, -1))}
        >
          <ChevronLeft size={18} />
        </button>
        <strong>{month.replace("-", "年")}月</strong>
        <button
          aria-label="次の月"
          onClick={() => onMonth(shiftMonth(month, 1))}
        >
          <ChevronRight size={18} />
        </button>
        <button
          className="calendar-current"
          onClick={() => onMonth(today.slice(0, 7))}
        >
          今月へ
        </button>
      </div>
      <div className="calendar-grid">
        {["月", "火", "水", "木", "金", "土", "日"].map((d) => (
          <span className="calendar-weekday" key={d}>
            {d}
          </span>
        ))}
        {cells.map((day) => (
          <button
            key={day.date}
            disabled={!day.inMonth}
            aria-label={`${day.date} ${day.recorded ? minutesLabel(day.total) : day.date > today ? "これから" : "未記録"}`}
            aria-pressed={selectedDate === day.date}
            className={`calendar-day ${day.recorded ? "has-record" : ""} ${day.date === today ? "is-today" : ""}`}
            onClick={() => onDay(day.date)}
          >
            <span>{Number(day.date.slice(8))}</span>
            <small>
              {!day.inMonth
                ? ""
                : day.recorded
                  ? `${Number(day.total.toFixed(1))}分`
                  : day.date > today
                    ? "—"
                    : "未記録"}
            </small>
          </button>
        ))}
      </div>
      <p className="calendar-note">
        {subject === "all" ? "すべての教科" : subject} ·
        未記録は未実施を意味しません。
      </p>
    </section>
  );
}

export function HourlyChart({
  records,
  date,
  subject,
}: {
  records: StudyRecord[];
  date: string;
  subject: string;
}) {
  const result = hourlyStudy(records, date, subject);
  return (
    <section className="panel daily-panel" aria-label="時間帯別の学習時間">
      <div className="panel-heading">
        <div>
          <h3>時間帯別の学習時間</h3>
          <p>{date} · 1時間ごと・日本時間</p>
        </div>
        <span className="unit-tag">単位：分</span>
      </div>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={result.hours}
            margin={{ top: 15, right: 6, bottom: 0, left: -24 }}
            accessibilityLayer
          >
            <CartesianGrid vertical={false} stroke="#edf0ed" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#89918b", fontSize: 11 }}
              minTickGap={18}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#89918b", fontSize: 11 }}
            />
            <Tooltip
              formatter={(value) => `${Number(Number(value).toFixed(1))}分`}
            />
            {result.subjects.map((s) => (
              <Bar
                key={s.name}
                dataKey={(row) => row.subjects[s.name]}
                name={s.name}
                stackId="study"
                fill={s.color}
                isAnimationActive={false}
                maxBarSize={25}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-legend">
        {result.subjects.map((s) => (
          <span key={s.name}>
            <i style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <div className="hourly-note">
        <p>
          時間帯が分かる記録：{minutesLabel(result.knownMinutes)} ／ 1日合計：
          {minutesLabel(result.total)}
        </p>
        {result.unknownRecords > 0 && (
          <p className="hourly-unknown">
            時間帯不明：{minutesLabel(result.unknownMinutes)}（
            {result.unknownRecords}件）。1日の合計には含まれています。
          </p>
        )}
        <details>
          <summary>時間帯を表示するには</summary>
          <p>
            Notionの「日付」で「時刻を含む」と「終了日」を有効にし、開始・終了時刻を入力してください。実績の「学習時間（分）」と経過時間が一致する記録を、時間の境目で分割します。時刻なし・開始のみ・逆転・実績と経過時間の不一致は、時間帯を推測せず「時間帯不明」に表示します。
          </p>
        </details>
      </div>
      <details className="data-details">
        <summary>時間帯別の数値を表で見る</summary>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">時間帯別の学習時間（分）</caption>
            <thead>
              <tr>
                <th>時間帯</th>
                {result.subjects.map((s) => (
                  <th key={s.name}>{s.name}</th>
                ))}
                <th>合計</th>
              </tr>
            </thead>
            <tbody>
              {result.hours.map((h) => (
                <tr key={h.hour}>
                  <td>
                    {h.hour}:00〜{h.hour + 1}:00
                  </td>
                  {result.subjects.map((s) => (
                    <td key={s.name}>
                      {Number(h.subjects[s.name].toFixed(1))}
                    </td>
                  ))}
                  <td>
                    {h.total > 0 ? minutesLabel(h.total) : "時刻付き記録なし"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
