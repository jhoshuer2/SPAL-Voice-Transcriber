export function StatTile({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "amber" | "sage";
}) {
  return (
    <div className={`stat-tile stat-tile--${tone}`}>
      <span className="stat-tile__label">{label}</span>
      <span className="stat-tile__value">{value}</span>
      {sub && <span className="stat-tile__sub">{sub}</span>}
    </div>
  );
}
