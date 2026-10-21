import { addDays, monday, tokyoDate, type Snapshot } from "./study";
export function demoSnapshot(now = new Date()): Snapshot {
  const today = tokyoDate(now);
  const subjects = ["数学", "英語", "化学", "物理", "国語"];
  const titles = [
    "微分・積分の演習",
    "長文読解と単語の復習",
    "化学平衡の問題演習",
    "力学の基本問題",
    "現代文の読解",
  ];
  const start = addDays(monday(today), -56);
  const records: Snapshot["records"] = [];
  for (let i = 0; addDays(start, i) <= today; i++) {
    if (i % 9 === 5) continue;
    for (let j = 0; j < 2 + (i % 3 === 0 ? 1 : 0); j++) {
      const s = (i + j) % subjects.length;
      const date = addDays(start, i);
      const duration = 25 + ((i * 7 + j * 13) % 8) * 10;
      const startedAt = `${date}T${String(8 + j * 5).padStart(2, "0")}:30:00+09:00`;
      records.push({
        id: `demo-${i}-${j}`,
        date: addDays(start, i),
        subject: subjects[s],
        unit: ["第3章", "演習ノート", "基礎の確認"][j],
        title: titles[s],
        durationMinutes: duration,
        ...(j === 0 || i % 2 === 0
          ? {
              startedAt,
              endedAt: new Date(
                Date.parse(startedAt) + duration * 60000,
              ).toISOString(),
            }
          : {}),
        notionUrl: "",
        updatedAt: now.toISOString(),
      });
    }
  }
  return { records, issues: [], duplicates: 0, syncedAt: now.toISOString() };
}
