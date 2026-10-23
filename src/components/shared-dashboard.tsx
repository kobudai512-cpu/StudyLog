"use client";
import { useEffect, useState } from "react";
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
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Leaf,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import {
  addDays,
  aggregate,
  minutesLabel,
  monday,
  subjectColor,
  tokyoDate,
  type StudyRecord,
} from "@/lib/study";
import type { SharedStudy } from "@/lib/shared-study";
import { StudyCalendar } from "./study-features";

export default function SharedDashboard({
  token,
  sample,
}: {
  token?: string;
  sample?: SharedStudy;
}) {
  const [data, setData] = useState<SharedStudy | null>(sample || null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!sample);
  const [today, setToday] = useState("");
  const [offset, setOffset] = useState(0);
  const [subject, setSubject] = useState("all");
  const [month, setMonth] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setToday(tokyoDate());
      if (sample) return;
      setLoading(true);
      try {
        const response = await fetch("/api/shared-study", {
          headers: { Authorization: `Bearer ${token || ""}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) {
          setData(null);
          throw new Error(result.error || "共有データを取得できませんでした。");
        }
        setData(result);
        setError("");
      } catch (err) {
        if (!controller.signal.aborted) {
          setData(null);
          setError(
            err instanceof Error ? err.message : "接続を確認してください。",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    const timer = setInterval(() => void load(), 60000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token, sample]);
  const records: StudyRecord[] = (data?.days || []).map((d, i) => ({
    id: String(i),
    date: d.date,
    subject: d.subject,
    durationMinutes: d.minutes,
    title: "",
    notionUrl: "",
    updatedAt: "",
  }));
  const start = today ? addDays(monday(today), offset * 7) : "";
  const end = offset === 0 ? today : addDays(start || "2000-01-01", 6);
  const week =
    data && today ? aggregate(records, { start, end }, subject) : null;
  const allWeek = data && today ? aggregate(records, { start, end }) : null;
  const target = data?.goals.find((g) => g.weekStart === start)?.targetMinutes;
  const daily =
    selectedDay && data
      ? aggregate(records, { start: selectedDay, end: selectedDay }, subject)
      : null;
  const percent = target && allWeek ? (allWeek.total / target) * 100 : null;
  return (
    <div className="shared-shell">
      <header className="shared-header">
        <a
          className="brand"
          href={sample ? "/demo/share" : "#"}
          aria-label="Winkle Study"
        >
          <span className="brand-icon">
            <Sparkles size={22} />
          </span>
          <span>
            Winkle<span className="brand-sub">STUDY</span>
          </span>
        </a>
        <span className="shared-badge">
          <Eye size={15} />
          閲覧専用
        </span>
      </header>
      <main>
        <div className="eyebrow">A LITTLE PROGRESS, SHARED WITH YOU</div>
        <h1>学びの積み重ねを、おすそわけ。</h1>
        <p className="intro">毎日の小さな一歩を、見守るためのページです。</p>
        <div className="shared-notice">
          <Leaf size={18} />
          <span>
            {sample
              ? "デモの共有ページです。実際の学習データではありません。"
              : "共有された学習サマリーです。勉強内容やメモは表示されず、記録・目標の変更もできません。"}
          </span>
        </div>
        {error && (
          <div className="notice error" role="alert">
            <h2>共有ページを表示できません</h2>
            <p>{error}</p>
            <p>共有した人にリンクを確認してください。</p>
            <button
              className="refresh-button"
              onClick={() => window.location.reload()}
            >
              再読み込み
            </button>
          </div>
        )}
        {loading && !data && !error && (
          <div className="loading-state" role="status">
            <RefreshCw className="spinning" />
            学習サマリーを読み込んでいます…
          </div>
        )}
        {data && week && allWeek && (
          <>
            <section className="shared-controls" aria-label="表示条件">
              <div className="week-navigation">
                <button
                  className="refresh-button"
                  aria-label="前の週"
                  onClick={() => setOffset((v) => v - 1)}
                >
                  <ChevronLeft size={17} />
                </button>
                <strong>
                  {start} 〜 {end}
                </strong>
                <button
                  className="refresh-button"
                  aria-label="次の週"
                  disabled={offset === 0}
                  onClick={() => setOffset((v) => Math.min(0, v + 1))}
                >
                  <ChevronRight size={17} />
                </button>
                {offset < 0 && (
                  <button
                    className="refresh-button"
                    onClick={() => setOffset(0)}
                  >
                    今週へ戻る
                  </button>
                )}
              </div>
              <label>
                教科{" "}
                <select
                  aria-label="教科"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                >
                  <option value="all">すべての教科</option>
                  {[...new Set(records.map((r) => r.subject))]
                    .sort()
                    .map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                </select>
              </label>
            </section>
            <section className="shared-stats" aria-label="週のサマリー">
              <article className="stat-card featured">
                <div className="stat-label">
                  <span>{offset === 0 ? "今週" : "表示週"}の学習時間</span>
                  <Clock3 size={18} />
                </div>
                <div className="shared-total">{minutesLabel(week.total)}</div>
                <p>{subject === "all" ? "すべての教科" : subject}</p>
              </article>
              <article className="stat-card">
                <div className="stat-label">記録のある日</div>
                <div className="shared-total">
                  {week.recordedDays}
                  <small>日</small>
                </div>
                <p>月曜日から{offset === 0 ? "今日" : "日曜日"}まで</p>
              </article>
            </section>
            <section className="panel goal-panel" aria-label="週の目標">
              <div className="panel-heading">
                <div>
                  <h3>
                    <Target size={18} />
                    週の目標
                  </h3>
                  <p>すべての教科の合計で計算</p>
                </div>
              </div>
              <div className="goal-body">
                {target && percent !== null ? (
                  <div className="goal-result">
                    <div>
                      <strong>{percent.toFixed(1)}%</strong>
                      <span>
                        {minutesLabel(allWeek.total)} / {minutesLabel(target)}
                      </span>
                    </div>
                    <progress
                      aria-label="週の目標達成率"
                      max={100}
                      value={Math.min(100, percent)}
                    />
                    <p>
                      {percent >= 100
                        ? "この週の目標を達成しました！"
                        : `目標まであと ${minutesLabel(Math.max(0, target - allWeek.total))}`}
                    </p>
                  </div>
                ) : (
                  <p>この週の目標は未設定、または現在表示できません。</p>
                )}
              </div>
            </section>
            <div className="shared-chart-grid">
              <section className="panel" aria-label="日々の学習時間">
                <div className="panel-heading">
                  <div>
                    <h3>日々の学習時間</h3>
                    <p>表示している週 · 単位：分</p>
                  </div>
                </div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart
                      data={week.daily}
                      margin={{ left: -15, right: 12 }}
                      accessibilityLayer
                    >
                      <CartesianGrid vertical={false} stroke="#edf0ed" />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v) => minutesLabel(Number(v))} />
                      {week.breakdown.map((s) => (
                        <Bar
                          key={s.name}
                          dataKey={s.name}
                          stackId="study"
                          fill={subjectColor(s.name)}
                          maxBarSize={32}
                          isAnimationActive={false}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>教科のバランス</h3>
                    <p>表示している週</p>
                  </div>
                </div>
                <div className="shared-subjects">
                  {week.breakdown.length ? (
                    week.breakdown.map((s) => (
                      <div key={s.name}>
                        <span>
                          <i style={{ background: subjectColor(s.name) }} />
                          {s.name}
                        </span>
                        <strong>{minutesLabel(s.minutes)}</strong>
                        <progress
                          aria-label={`${s.name}の割合`}
                          max={100}
                          value={s.share}
                        />
                      </div>
                    ))
                  ) : (
                    <p>この週の記録はまだありません。</p>
                  )}
                </div>
              </section>
            </div>
            <StudyCalendar
              records={records}
              month={month || today.slice(0, 7)}
              today={today}
              subject={subject}
              onMonth={setMonth}
              selectedDate={selectedDay}
              onDay={setSelectedDay}
            />
            {daily && (
              <section
                className="panel shared-day"
                aria-label="選択日の学習時間"
              >
                <h3>{selectedDay} の学習時間</h3>
                <strong>{minutesLabel(daily.total)}</strong>
                <p>
                  {daily.recordedDays
                    ? "教科別の合計"
                    : "この日の記録はありません。"}
                </p>
                {daily.breakdown.map((s) => (
                  <p key={s.name}>
                    {s.name}：{minutesLabel(s.minutes)}
                  </p>
                ))}
              </section>
            )}
            <p className="sync-line">
              {data.stale
                ? "前回取得できたデータを表示しています。"
                : "自動で表示を更新します。"}{" "}
              最終同期：
              {new Intl.DateTimeFormat("ja-JP", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: "Asia/Tokyo",
              }).format(new Date(data.syncedAt))}
            </p>
          </>
        )}
        <footer>
          <span>
            <Sparkles size={13} />
            Winkle Study
          </span>
          <span>READ ONLY · 学びを、そっと見守る。</span>
        </footer>
      </main>
    </div>
  );
}
