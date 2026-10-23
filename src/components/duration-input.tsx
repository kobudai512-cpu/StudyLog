"use client";

export default function DurationInput({
  label,
  hours,
  minutes,
  onHours,
  onMinutes,
  maxHours,
}: {
  label: string;
  hours: string;
  minutes: string;
  onHours: (value: string) => void;
  onMinutes: (value: string) => void;
  maxHours: number;
}) {
  return (
    <div className="duration-field">
      <span>{label}</span>
      <div className="duration-inputs">
        <label>
          <input
            aria-label={`${label}（時間）`}
            type="number"
            min={0}
            max={maxHours}
            step={1}
            inputMode="numeric"
            value={hours}
            onChange={(e) => onHours(e.target.value)}
            placeholder="0"
          />
          <span>時間</span>
        </label>
        <label>
          <input
            aria-label={`${label}（分）`}
            type="number"
            min={0}
            max={59}
            step={1}
            inputMode="numeric"
            value={minutes}
            onChange={(e) => onMinutes(e.target.value)}
            placeholder="0"
          />
          <span>分</span>
        </label>
      </div>
    </div>
  );
}
