export function MetricCard({ label, value, accent = "blue" }) {
  return (
    <article className={`metric-card accent-${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
