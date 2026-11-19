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
    <div className={`stat-tile stat-tile--${tone}`}>
      <div className="stat-tile__top">
        <span className="stat-tile__label">{label}</span>
        {icon && <span className="stat-tile__icon">{icon}</span>}
      </div>
      <span className="stat-tile__value">{value}</span>
      {sub && <span className="stat-tile__sub">{sub}</span>}
    </div>
  );
}
