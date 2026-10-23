"use client";
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
import {
  minutesLabel,
  type StudyRecord,
  type StudyResponse,
} from "@/lib/study";
import {
  goalProgress,
  hourlyStudy,
  monthCalendar,
  shiftMonth,
} from "@/lib/study-features";

import { GOALS_URL } from "@/lib/goals";
import GoalDialog from "./goal-dialog";
import type { WeeklyStudyGoal } from "@/lib/study";

export function WeeklyGoal({
  total,
  weekStart,
  data,
  onSaved,
}: {
  total: number;
  weekStart: string;
  data: StudyResponse;
  onSaved: (goal: WeeklyStudyGoal) => void;
}) {
  const matches = (data.goals ?? []).filter((g) => g.weekStart === weekStart);
  const issues = (data.goalIssues ?? []).filter(
    (i) => !i.weekStart || i.weekStart === weekStart,
  );
  const goal = matches.length === 1 && !issues.length ? matches[0] : undefined;
  const progress = goal?.targetMinutes
    ? goalProgress(total, goal.targetMinutes)
    : null;
  return (
    <section className="panel goal-panel" aria-label="週の目標">
      <div className="panel-heading">
        <div>
          <h3>
            <Target size={18} />
            週の目標
          </h3>
          <p>{weekStart}からの週・すべての教科</p>
        </div>
        <span className="unit-tag">
          {data.mode === "demo" ? "デモの目標" : "Notionと同期"}
        </span>
      </div>
      <div className="goal-body">
        {data.goalError ? (
          <p role="status">{data.goalError}</p>
        ) : matches.length > 1 ? (
          <p role="status">
            同じ週の目標が{matches.length}
            件あります。Notionで1件にまとめてください。
          </p>
        ) : issues.length ? (
          <p role="status">{issues.map((i) => i.reason).join(" ")}</p>
        ) : progress ? (
          <div className="goal-result">
            <div>
              <strong>{progress.percent.toFixed(1)}%</strong>
              <span>
                {minutesLabel(total)} / {minutesLabel(goal!.targetMinutes!)}
              </span>
            </div>
            <progress
              aria-label="週の目標達成率"
              max={100}
              value={Math.min(100, progress.percent)}
            />
            <p>
              {progress.remaining > 0
                ? `目標まであと ${minutesLabel(progress.remaining)}`
                : "この週の目標を達成しました！"}
            </p>
            {goal?.memo && <p>{goal.memo}</p>}
          </div>
        ) : (
          <p className="muted">
            この週は、どれくらい勉強しよう？時間と分で目標を設定できます。
          </p>
        )}
        {data.stale && (
          <p className="goal-message">
            前回成功時の目標・実績を表示しています。
          </p>
        )}
        <div className="goal-actions">
          <GoalDialog
            key={weekStart}
            mode={data.mode}
            weekStart={weekStart}
            goal={goal}
            disabled={
              Boolean(data.goalError) || matches.length > 1 || issues.length > 0
            }
            onSaved={onSaved}
          />
          {data.mode === "live" ? (
            <a
              className="record-shortcut"
              href={goal?.notionUrl || GOALS_URL}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={15} />
              Notionで確認
            </a>
          ) : (
            <p className="goal-message">
              デモ内でお試しできます。Notionへの保存は本番画面から。
            </p>
          )}
        </div>
        <details className="goal-sync-help">
          <summary>Notionの目標が反映されないときは</summary>
          <p>
            {data.mode === "demo"
              ? "この画面はデモのため、Notionの変更は反映されません。本番画面でログインしてください。"
              : "Notionで直接変更した目標は、最大5分後の自動取得か「更新」ボタンで読み込みます。週の開始日は表示中の週の月曜日を指定し、同じ週の目標は1件にしてください。"}
          </p>
        </details>
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
          <p>{date} · 推定・1時間ごと・日本時間</p>
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
          推定できる記録：{minutesLabel(result.knownMinutes)} ／ 1日合計：
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
            Notionの「日付」を終了時刻として、実績の「学習時間（分）」だけさかのぼった連続した学習時間帯を推定します。例：2:31・31分
            →
            2:00〜2:31。休憩や中断は判別できません。時刻なしは「時間帯不明」。日付をまたぐ場合は各日に分けます。終了日のある旧形式は、その終了時刻を使います。
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
