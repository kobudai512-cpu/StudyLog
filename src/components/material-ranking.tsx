"use client";
import { useState } from "react";
import { BookOpen } from "lucide-react";
import { materialRanking, type MaterialSort } from "@/lib/materials";
import { minutesLabel, type StudyRecord, type Range } from "@/lib/study";
export default function MaterialRanking({
  records,
  range,
  subject,
  onSelect,
}: {
  records: StudyRecord[];
  range: Range;
  subject: string;
  onSelect: (value: string) => void;
}) {
  const [sort, setSort] = useState<MaterialSort>("time-desc");
  const rows = materialRanking(records, range, subject, sort);
  return (
    <section className="panel material-panel" aria-label="教材別の学習データ">
      <div className="panel-heading">
        <div>
          <h3>
            <BookOpen size={18} />
            教材別の学習データ
          </h3>
          <p>
            {range.start} 〜 {range.end} ·{" "}
            {subject === "all" ? "すべての教科" : subject} · 教材どうしを比較
          </p>
        </div>
        <label>
          並び順
          <select
            aria-label="教材ランキングの並び順"
            value={sort}
            onChange={(e) => setSort(e.target.value as MaterialSort)}
          >
            <option value="time-desc">学習時間が多い順</option>
            <option value="time-asc">学習時間が少ない順</option>
            <option value="count">記録回数が多い順</option>
            <option value="days">学習日数が多い順</option>
            <option value="recent">最近取り組んだ順</option>
            <option value="name">教材名順</option>
          </select>
        </label>
      </div>
      <div className="table-scroll">
        <table className="material-table">
          <caption className="sr-only">教材別ランキング</caption>
          <thead>
            <tr>
              <th>順</th>
              <th>教材</th>
              <th>学習時間</th>
              <th>記録回数</th>
              <th>学習日数</th>
              <th>1回の平均</th>
              <th>最後の学習日</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.name}>
                <td>{i + 1}</td>
                <td>
                  <button
                    onClick={() =>
                      onSelect(r.name ? `book:${r.name}` : "unset")
                    }
                    aria-label={`${r.name || "教材未設定"}で絞り込む`}
                  >
                    {r.name || "教材未設定"}
                  </button>
                  <div className="material-share-track">
                    <span style={{ width: `${r.share}%` }} />
                  </div>
                  <small>{r.share.toFixed(1)}%</small>
                </td>
                <td>{minutesLabel(r.minutes)}</td>
                <td>{r.count}回</td>
                <td>{r.days}日</td>
                <td>{minutesLabel(r.count ? r.minutes / r.count : 0)}</td>
                <td>{r.lastDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p className="empty-records">この期間の記録はまだありません。</p>
      )}
      <p className="material-note">
        教材名を押すと、グラフ・カレンダー・記録一覧をその教材で絞り込めます。順位は選んだ期間と教科で比較します。
      </p>
    </section>
  );
}
