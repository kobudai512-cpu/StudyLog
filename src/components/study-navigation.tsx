"use client";
import { useEffect, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  Library,
  LayoutDashboard,
} from "lucide-react";

const destinations = [
  { id: "overview", label: "概要", icon: LayoutDashboard },
  { id: "records", label: "学習記録", icon: BookOpen },
  { id: "materials", label: "教材", icon: Library },
  { id: "calendar", label: "カレンダー", icon: CalendarDays },
  { id: "weekly", label: "学習の推移", icon: ChartNoAxesCombined },
];

export default function StudyNavigation({ enabled }: { enabled: boolean }) {
  const [active, setActive] = useState("overview");
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        let current = "overview";
        for (const { id } of destinations) {
          const section = document.getElementById(id);
          if (section && section.getBoundingClientRect().top <= 160)
            current = id;
        }
        if (
          window.scrollY > 0 &&
          window.innerHeight + window.scrollY >=
            document.documentElement.scrollHeight - 4
        ) {
          current =
            [...destinations]
              .reverse()
              .find(({ id }) => document.getElementById(id))?.id ?? "overview";
        }
        setActive(current);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <nav aria-label="メインナビゲーション">
      {destinations
        .filter(({ id }) => enabled || id === "overview")
        .map(({ id, label, icon: Icon }) => (
          <a
            key={id}
            href={`#${id}`}
            className={`nav-item${active === id ? " active" : ""}`}
            aria-current={active === id ? "location" : undefined}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </a>
        ))}
    </nav>
  );
}
