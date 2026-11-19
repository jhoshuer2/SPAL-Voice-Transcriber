import type { ReactNode } from "react";

export function StatTile({
  label,
  value,
  sub,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
  tone?: "default" | "amber" | "sage";
}) {
  return (
    <div className={`stat-pill stat-pill--${tone}`}>
      {icon && <span className="stat-pill__icon">{icon}</span>}
      <span className="stat-pill__text">
        <span className="stat-pill__value">{value}</span>
        <span className="stat-pill__label">
          {label}
          {sub ? <span className="stat-pill__sub"> · {sub}</span> : null}
        </span>
      </span>
    </div>
  );
}
