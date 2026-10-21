"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  LayoutDashboard,
  Leaf,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { demoSnapshot } from "@/lib/demo";
import {
  addDays,
  aggregate,
  minutesLabel,
  periodRange,
  subjectColor,
  tokyoDate,
  weekComparison,
  type Period,
  type StudyResponse,
} from "@/lib/study";

type Props = {
  mode: "demo" | "live";
  authenticated: boolean;
  authReady: boolean;
};
const PERIODS: [Period, string][] = [
  ["today", "今日"],
  ["week", "今週"],
  ["month", "今月"],
  ["custom", "期間を指定"],
];
export default function Dashboard({ mode, authenticated, authReady }: Props) {
  const [data, setData] = useState<StudyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<Period>("week");
  const [subject, setSubject] = useState("all");
  const [today, setToday] = useState("");
  const [custom, setCustom] = useState({ start: "", end: "" });
  const [scenario, setScenario] = useState("normal");
  const [page, setPage] = useState(1);
  const canRead = mode === "demo" || authenticated;
  const load = useCallback(
    async (force = false, signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      const day = tokyoDate();
      setToday(day);
      try {
        if (mode === "demo") {
          const snapshot = demoSnapshot();
          setData({ ...snapshot, mode: "demo", stale: false });
        } else {
          const response = await fetch("/api/study", {
            method: force ? "POST" : "GET",
            cache: "no-store",
            signal,
          });
          const result = await response.json();
          if (response.status === 401) setData(null);
          if (!response.ok)
            throw new Error(result.error || "取得に失敗しました。");
          setData(result);
        }
      } catch (e) {
        if (!signal?.aborted)
          setError(e instanceof Error ? e.message : "取得に失敗しました。");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [mode],
  );
  useEffect(() => {
    if (!canRead) return;
    const controller = new AbortController();
    // Initial network subscription: loading state intentionally accompanies the request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(false, controller.signal);
    const timer = setInterval(
      () => void load(false, controller.signal),
      300000,
    );
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [canRead, load]);
  const records = useMemo(
    () => (scenario === "empty" ? [] : (data?.records ?? [])),
    [data, scenario],
  );
  const subjects = useMemo(
    () => [...new Set((data?.records ?? []).map((r) => r.subject))].sort(),
    [data],
  );
  let rangeError = "";
  let range = { start: today, end: today };
  if (today)
    try {
      range = periodRange(period, today, custom);
    } catch (e) {
      rangeError = (e as Error).message;
    }
  const summary = useMemo(
    () =>
      today && !rangeError
        ? aggregate(records, { start: range.start, end: range.end }, subject)
        : null,
    [records, range.start, range.end, subject, today, rangeError],
  );
  const week = useMemo(
    () => (today ? weekComparison(records, today, subject) : null),
    [records, today, subject],
  );
  const trend = useMemo(
    () =>
      today
        ? aggregate(
            records,
            {
              start: addDays(periodRange("week", today).start, -49),
              end: today,
            },
            subject,
          ).weekly
        : [],
    [records, today, subject],
  );
  const shownError =
    scenario === "error"
      ? "デモ：Notionへの接続に失敗しました。最後に取得したデータを表示しています。"
      : error || data?.error;
  const issues = (data?.issues.length ?? 0) + (scenario === "issues" ? 2 : 0);
  const selectPeriod = (value: Period) => {
    setPeriod(value);
    setPage(1);
    if (value === "custom" && !custom.start)
      setCustom({ start: addDays(today, -13), end: today });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href={mode === "demo" ? "/demo" : "/"}
          aria-label="Winkle Study ホーム"
        >
          <span className="brand-icon">
            <Sparkles size={22} />
          </span>
          <span>
            Winkle<span className="brand-sub">STUDY</span>
          </span>
        </a>
        <div className="workspace-label">MY WORKSPACE</div>
        <nav aria-label="メインナビゲーション">
          <a className="nav-item active" href="#overview">
            <LayoutDashboard size={18} />
            ダッシュボード
          </a>
          <a className="nav-item" href="#records">
            <BookOpen size={18} />
            学習記録
          </a>
          <a className="nav-item" href="#weekly">
            <ChartNoAxesCombined size={18} />
            学習の推移
          </a>
          {authenticated && (
            <button
              className="nav-item mobile-logout"
              aria-label="ログアウト"
              onClick={() => void signOut()}
            >
              <LogOut size={17} />
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="small-garden">
            <Leaf size={25} />
            <p>
              小さな学びが、
              <br />
              大きな一歩に。
            </p>
            <span>Every little study counts.</span>
          </div>
          <div className="private-label">
            <ShieldCheck size={15} />
            あなたのための学習スペース
          </div>
          {authenticated && (
            <button className="logout" onClick={() => void signOut()}>
              <LogOut size={15} />
              ログアウト
            </button>
          )}
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="breadcrumb">
            マイワークスペース <span>/</span> <strong>ダッシュボード</strong>
          </span>
          <div className="topbar-right">
            <span className="private-pill">
              <span />
              PRIVATE
            </span>
            <span className="avatar">W</span>
          </div>
        </header>
        <main id="overview">
          <div className="heading-row">
            <div>
              <div className="eyebrow">YOUR LEARNING, AT A GLANCE</div>
              <h1>
                学びの積み重ねを、見える形に<span>。</span>
              </h1>
              <p className="intro">
                毎日の記録から、自分のペースを見つけよう。
              </p>
            </div>
            <div className="today-label">
              <CalendarDays size={17} />
              {today
                ? new Intl.DateTimeFormat("ja-JP", {
                    dateStyle: "long",
                    timeZone: "Asia/Tokyo",
                  }).format(new Date(`${today}T12:00:00+09:00`))
                : "Asia/Tokyo"}
            </div>
          </div>
          {mode === "demo" && (
            <div className="demo-banner">
              <div>
                <span className="demo-tag">DEMO</span>
                <span>
                  架空の学習記録を表示しています。Notionの実データではありません。
                </span>
              </div>
              <Link href="/">
                本番接続へ <span aria-hidden>↗</span>
              </Link>
            </div>
          )}
          {!canRead ? (
            <section className="login-card">
              <span className="login-icon">
                <Leaf size={35} />
              </span>
              <div className="eyebrow">A LITTLE PROGRESS, EVERY DAY</div>
              <h2>あなただけの、学びの居場所。</h2>
              <p>
                NotionのStudy Logをつないで、
                <br />
                日々の頑張りを振り返りましょう。
              </p>
              {authReady ? (
                <button
                  className="primary"
                  onClick={() => void signIn("google")}
                >
                  Googleでログイン
                </button>
              ) : (
                <div className="setup-notice">
                  Googleログインの設定待ちです。
                  <br />
                  環境変数の設定手順はREADMEにまとめています。
                </div>
              )}
              <a className="demo-link" href="/demo">
                デモダッシュボードを見る <span aria-hidden>→</span>
              </a>
              <small>
                <ShieldCheck size={14} />
                許可したGoogleアカウントだけが実データにアクセスできます。
              </small>
            </section>
          ) : (
            <>
              <section className="toolbar" aria-label="表示条件">
                <div className="period-tabs">
                  {PERIODS.map(([value, label]) => (
                    <button
                      key={value}
                      aria-pressed={period === value}
                      className={period === value ? "selected" : ""}
                      onClick={() => selectPeriod(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="toolbar-right">
                  <label className="subject-select">
                    <span>教科</span>
                    <select
                      aria-label="教科"
                      value={subject}
                      onChange={(e) => {
                        setSubject(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="all">すべての教科</option>
                      {subjects.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="refresh-button"
                    onClick={() => void load(true)}
                    disabled={loading}
                  >
                    <RefreshCw
                      size={15}
                      className={loading ? "spinning" : ""}
                    />
                    {loading ? "更新中" : "更新"}
                  </button>
                </div>
              </section>
              {period === "custom" && (
                <div className="custom-range">
                  <label>
                    開始日
                    <input
                      type="date"
                      aria-label="開始日"
                      value={custom.start}
                      onChange={(e) => {
                        setCustom({ ...custom, start: e.target.value });
                        setPage(1);
                      }}
                    />
                  </label>
                  <span>—</span>
                  <label>
                    終了日
                    <input
                      type="date"
                      aria-label="終了日"
                      value={custom.end}
                      onChange={(e) => {
                        setCustom({ ...custom, end: e.target.value });
                        setPage(1);
                      }}
                    />
                  </label>
                  <small>最大366日</small>
                </div>
              )}
              <div className="sync-line">
                <span>
                  {loading
                    ? "学習記録を取得しています…"
                    : data
                      ? `最終${mode === "demo" ? "デモ更新" : "成功同期"}：${new Intl.DateTimeFormat("ja-JP", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tokyo" }).format(new Date(data.syncedAt))}（日本時間）`
                      : "未同期"}
                </span>
                <span>月曜始まり · Asia/Tokyo</span>
              </div>
              {rangeError && (
                <div role="alert" className="notice error">
                  {rangeError}
                </div>
              )}
              {shownError && (
                <div role="alert" className="notice error">
                  {shownError}
                  {data && <span> 最終成功時のデータを保持しています。</span>}
                </div>
              )}
              {data?.stale && !shownError && (
                <div className="notice" role="status">
                  同期できなかったため、前回成功時のデータを表示しています。
                </div>
              )}
              {issues > 0 && (
                <div className="notice" role="status">
                  日付または時間が不正な{issues}
                  件を集計から除外しました。Notionの記録を確認してください。件数は取得した全期間が対象です。
                </div>
              )}
              {(data?.duplicates ?? 0) > 0 && (
                <div className="notice">
                  重複した{data!.duplicates}
                  件を除外し、同一ページの最新の記録を採用しました。
                </div>
              )}
              {loading && !data ? (
                <div className="loading-state" role="status">
                  <RefreshCw className="spinning" />
                  学習記録を読み込んでいます…
                </div>
              ) : summary && week && data ? (
                <>
                  <section className="stats-grid" aria-label="今週のサマリー">
                    <article className="stat-card featured">
                      <div className="stat-label">
                        <span>今週の学習時間</span>
                        <span className="stat-icon">
                          <Clock3 size={18} />
                        </span>
                      </div>
                      <div className="stat-value">
                        {Math.floor(week.current.total / 60)}
                        <span>時間</span>{" "}
                        {Number((week.current.total % 60).toFixed(1))}
                        <span>分</span>
                      </div>
                      <div className="stat-foot">
                        {week.current.records.length}件の記録{" "}
                        <span className="tiny-dot" />{" "}
                        {subject === "all" ? "すべての教科" : subject}
                      </div>
                    </article>
                    <article className="stat-card">
                      <div className="stat-label">
                        <span>今週の記録日数</span>
                        <span className="stat-icon">
                          <CalendarDays size={18} />
                        </span>
                      </div>
                      <div className="stat-value">
                        {week.current.recordedDays}
                        <span>日</span>
                        <small>/ {week.current.calendarDays}日</small>
                      </div>
                      <div className="stat-foot">
                        月曜日から今日まで · 未記録日は含めません
                      </div>
                    </article>
                    <article className="stat-card">
                      <div className="stat-label">
                        <span>前週の同期間との差</span>
                        <span className="stat-icon">
                          {week.difference >= 0 ? (
                            <ArrowUpRight size={18} />
                          ) : (
                            <ArrowDownRight size={18} />
                          )}
                        </span>
                      </div>
                      <div className="stat-value difference">
                        {week.difference > 0
                          ? "+"
                          : week.difference < 0
                            ? "−"
                            : ""}
                        {Number((Math.abs(week.difference) / 60).toFixed(1))}
                        <span>時間</span>
                        {week.percent !== null && (
                          <em>
                            {week.percent > 0 ? "+" : ""}
                            {Math.round(week.percent)}%
                          </em>
                        )}
                      </div>
                      <div className="stat-foot">
                        比較：{week.previous.start.slice(5)} ～{" "}
                        {week.previous.end.slice(5)}
                        {week.percent === null ? "（前週0分・増加率なし）" : ""}
                      </div>
                    </article>
                  </section>
                  <div className="section-heading">
                    <div>
                      <h2>
                        {PERIODS.find(([p]) => p === period)?.[1]}の学習レポート
                      </h2>
                      <p>
                        {range.start} ～ {range.end} <span>·</span> 合計{" "}
                        {minutesLabel(summary.total)}
                      </p>
                    </div>
                    <span className="quiet-label">STUDY OVERVIEW</span>
                  </div>
                  {summary.records.length === 0 && (
                    <div className="empty-state">
                      <BookOpen size={28} />
                      <h3>この期間の記録はまだありません</h3>
                      <p>
                        未記録の日は、未実施という意味ではありません。期間や教科を変えて確認できます。
                      </p>
                    </div>
                  )}
                  <div className="charts-grid">
                    <section className="panel daily-panel">
                      <div className="panel-heading">
                        <div>
                          <h3>日々の学習時間</h3>
                          <p>教科ごとの積み重ねを振り返る</p>
                        </div>
                        <span className="unit-tag">単位：分</span>
                      </div>
                      <div className="chart-container">
                        <ResponsiveContainer
                          width="100%"
                          height="100%"
                          minWidth={0}
                        >
                          <BarChart
                            data={summary.daily}
                            margin={{ top: 15, right: 6, bottom: 0, left: -24 }}
                            accessibilityLayer
                          >
                            <CartesianGrid vertical={false} stroke="#edf0ed" />
                            <XAxis
                              dataKey="label"
                              tickLine={false}
                              axisLine={false}
                              tick={{ fill: "#89918b", fontSize: 11 }}
                              minTickGap={22}
                            />
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              tick={{ fill: "#89918b", fontSize: 11 }}
                            />
                            <Tooltip
                              cursor={{ fill: "#f3f6f3" }}
                              formatter={(value) => `${value}分`}
                              contentStyle={{
                                border: "1px solid #e5eae5",
                                borderRadius: 12,
                                fontSize: 12,
                              }}
                            />
                            {summary.breakdown.map((s) => (
                              <Bar
                                key={s.name}
                                dataKey={s.name}
                                stackId="study"
                                isAnimationActive={false}
                                fill={s.color}
                                maxBarSize={38}
                              />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="chart-legend">
                        {summary.breakdown.map((s) => (
                          <span key={s.name}>
                            <i style={{ background: s.color }} />
                            {s.name}
                          </span>
                        ))}
                      </div>
                      <details className="data-details">
                        <summary>日別の数値を表で見る</summary>
                        <div className="table-scroll">
                          <table>
                            <caption className="sr-only">
                              日別の学習時間（分）
                            </caption>
                            <thead>
                              <tr>
                                <th>日付</th>
                                {summary.breakdown.map((s) => (
                                  <th key={s.name}>{s.name}</th>
                                ))}
                                <th>合計</th>
                              </tr>
                            </thead>
                            <tbody>
                              {summary.daily.map((d) => (
                                <tr key={d.date}>
                                  <td>{d.date}</td>
                                  {summary.breakdown.map((s) => (
                                    <td key={s.name}>
                                      {d.recorded
                                        ? String(
                                            (d as Record<string, unknown>)[
                                              s.name
                                            ] ?? 0,
                                          )
                                        : "—"}
                                    </td>
                                  ))}
                                  <td>
                                    {d.recorded ? `${d.total}分` : "未記録"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    </section>
                    <section className="panel subject-panel">
                      <div className="panel-heading">
                        <div>
                          <h3>教科のバランス</h3>
                          <p>学習時間の内訳</p>
                        </div>
                      </div>
                      <div className="donut-wrap">
                        <ResponsiveContainer
                          width="100%"
                          height={190}
                          minWidth={0}
                        >
                          <PieChart accessibilityLayer>
                            <Pie
                              data={summary.breakdown}
                              dataKey="minutes"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius="64%"
                              outerRadius="86%"
                              isAnimationActive={false}
                              paddingAngle={3}
                              stroke="none"
                            >
                              {summary.breakdown.map((s) => (
                                <Cell key={s.name} fill={s.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value) => `${value}分`}
                              contentStyle={{ borderRadius: 12, fontSize: 12 }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="donut-label">
                          <span>TOTAL</span>
                          <strong>
                            {Number((summary.total / 60).toFixed(1))}
                            <small>時間</small>
                          </strong>
                        </div>
                      </div>
                      <ul className="subject-list">
                        {summary.breakdown.map((s) => (
                          <li key={s.name}>
                            <span>
                              <i style={{ background: s.color }} />
                              {s.name}
                            </span>
                            <strong>{minutesLabel(s.minutes)}</strong>
                            <small>{s.share.toFixed(1)}%</small>
                          </li>
                        ))}
                      </ul>
                      {summary.breakdown.length === 0 && (
                        <p className="muted centered">
                          内訳を表示する記録がありません
                        </p>
                      )}
                    </section>
                    <section id="weekly" className="panel weekly-panel">
                      <div className="panel-heading">
                        <div>
                          <h3>週ごとの学習リズム</h3>
                          <p>直近8週間 · 今週は今日まで</p>
                        </div>
                        <span className="unit-tag">単位：分</span>
                      </div>
                      <div className="weekly-chart">
                        <ResponsiveContainer
                          width="100%"
                          height="100%"
                          minWidth={0}
                        >
                          <AreaChart
                            data={trend}
                            margin={{
                              top: 12,
                              right: 14,
                              left: -24,
                              bottom: 0,
                            }}
                            accessibilityLayer
                          >
                            <defs>
                              <linearGradient
                                id="weeklyFill"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#4e9879"
                                  stopOpacity={0.22}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#4e9879"
                                  stopOpacity={0.01}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} stroke="#edf0ed" />
                            <XAxis
                              dataKey="date"
                              tickFormatter={(v) => `${String(v).slice(5)}週`}
                              tickLine={false}
                              axisLine={false}
                              tick={{ fill: "#89918b", fontSize: 11 }}
                            />
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              tick={{ fill: "#89918b", fontSize: 11 }}
                            />
                            <Tooltip
                              formatter={(value) => `${value}分`}
                              labelFormatter={(label) => `${label} からの週`}
                              contentStyle={{ borderRadius: 12, fontSize: 12 }}
                            />
                            <Area
                              type="linear"
                              isAnimationActive={false}
                              dataKey="minutes"
                              name="学習時間"
                              stroke="#4b9274"
                              strokeWidth={2.5}
                              fill="url(#weeklyFill)"
                              dot={{
                                r: 4,
                                fill: "#4b9274",
                                strokeWidth: 3,
                                stroke: "white",
                              }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <details className="data-details">
                        <summary>週別の数値を表で見る</summary>
                        <table>
                          <caption className="sr-only">週別合計</caption>
                          <thead>
                            <tr>
                              <th>週の開始日</th>
                              <th>合計</th>
                            </tr>
                          </thead>
                          <tbody>
                            {trend.map((w) => (
                              <tr key={w.date}>
                                <td>{w.date}</td>
                                <td>
                                  {w.recorded
                                    ? minutesLabel(w.minutes)
                                    : "未記録"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </details>
                    </section>
                    <section className="reflection">
                      <div className="reflection-icon">
                        <Leaf size={23} />
                      </div>
                      <div className="eyebrow">ONE STEP AT A TIME</div>
                      <h3>
                        今日の一歩も、
                        <br />
                        ちゃんと積み重なっている。
                      </h3>
                      <p>
                        この期間は <strong>{summary.recordedDays}日</strong>{" "}
                        の記録があります。
                        <br />
                        自分のペースで、学びを続けよう。
                      </p>
                      <div className="average">
                        <span>記録日あたりの平均</span>
                        <strong>
                          {summary.recordedDays
                            ? minutesLabel(summary.total / summary.recordedDays)
                            : "記録なし"}
                        </strong>
                      </div>
                      <span className="reflection-flower" aria-hidden>
                        ✳
                      </span>
                    </section>
                  </div>
                  <section className="panel records-panel" id="records">
                    <div className="panel-heading">
                      <div>
                        <h3>
                          学習の足あと{" "}
                          <span className="count-badge">
                            {summary.records.length}
                          </span>
                        </h3>
                        <p>記録の原本はNotionに。ここでは、振り返りを。</p>
                      </div>
                      <span className="unit-tag">学習日順</span>
                    </div>
                    <div className="record-table-wrap">
                      <table className="record-table">
                        <caption className="sr-only">学習記録の一覧</caption>
                        <thead>
                          <tr>
                            <th>学習日</th>
                            <th>教科</th>
                            <th>学習内容・単元</th>
                            <th>学習時間</th>
                            <th>
                              <span className="sr-only">元ページ</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.records
                            .slice((page - 1) * 15, page * 15)
                            .map((r) => (
                              <tr key={r.id}>
                                <td className="record-date">
                                  {r.date.slice(5).replace("-", "/")}
                                </td>
                                <td>
                                  <span
                                    className="subject-badge"
                                    style={{
                                      color: subjectColor(r.subject),
                                      background: `color-mix(in srgb, ${subjectColor(r.subject)} 10%, white)`,
                                    }}
                                  >
                                    {r.subject}
                                  </span>
                                </td>
                                <td className="record-title">
                                  <strong>{r.title}</strong>
                                  {r.unit && <small>{r.unit}</small>}
                                </td>
                                <td className="record-time">
                                  {minutesLabel(r.durationMinutes)}
                                </td>
                                <td>
                                  {r.notionUrl ? (
                                    <a
                                      className="notion-link"
                                      href={r.notionUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      aria-label={`${r.title}をNotionで開く`}
                                    >
                                      <ExternalLink size={15} />
                                    </a>
                                  ) : (
                                    <span className="sample-label">架空</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    {summary.records.length === 0 && (
                      <p className="empty-records">
                        この条件の記録はありません。
                      </p>
                    )}
                    <div className="pagination">
                      <span>
                        {summary.records.length}件中{" "}
                        {summary.records.length
                          ? `${(page - 1) * 15 + 1}〜${Math.min(page * 15, summary.records.length)}件`
                          : "0件"}
                      </span>
                      <div>
                        <button
                          aria-label="前のページ"
                          disabled={page <= 1}
                          onClick={() => setPage(page - 1)}
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <span>
                          {page} /{" "}
                          {Math.max(1, Math.ceil(summary.records.length / 15))}
                        </span>
                        <button
                          aria-label="次のページ"
                          disabled={page * 15 >= summary.records.length}
                          onClick={() => setPage(page + 1)}
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </section>
                </>
              ) : !loading && error ? (
                <div className="empty-state">
                  <h3>データを取得できませんでした</h3>
                  <p>接続設定を確認し、更新ボタンから再試行してください。</p>
                </div>
              ) : null}
              {mode === "demo" && (
                <details className="demo-tools">
                  <summary>デモの表示状態を確認</summary>
                  <label>
                    表示状態
                    <select
                      aria-label="デモの表示状態"
                      value={scenario}
                      onChange={(e) => {
                        setScenario(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="normal">通常</option>
                      <option value="empty">未記録</option>
                      <option value="error">
                        同期エラー（前回データあり）
                      </option>
                      <option value="issues">不正データの警告</option>
                    </select>
                  </label>
                  <small>この操作は架空データの表示だけを変更します。</small>
                </details>
              )}
            </>
          )}
          <footer>
            <span>
              <Sparkles size={13} />
              Winkle Study
            </span>
            <span>
              日々の学びに、小さな光を。 <span className="footer-dot">·</span>{" "}
              {mode === "demo" ? "DEMO DATA" : "READ ONLY · NOTION"}
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
