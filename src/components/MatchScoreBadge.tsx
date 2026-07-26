// MatchScoreBadge — shows a circular score indicator with color gradient.
// Uses pure CSS/SVG for the gradient ring (no additional packages).

interface MatchScoreBadgeProps {
  score: number; // 0–100
  size?: "sm" | "md" | "lg";
  highlight?: boolean; // gold/animated for top matches
}

const GRADIENTS: Record<string, { start: string; end: string; bg: string }> = {
  high: { start: "#22c55e", end: "#10b981", bg: "bg-emerald-500/10" },   // 80+
  mid: { start: "#f59e0b", end: "#d97706", bg: "bg-amber-500/10" },       // 50–79
  low: { start: "#ef4444", end: "#dc2626", bg: "bg-red-500/10" },         // <50
};

export function MatchScoreBadge({ score, size = "md", highlight = false }: MatchScoreBadgeProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  let tier: "high" | "mid" | "low";
  if (clamped >= 80) tier = "high";
  else if (clamped >= 50) tier = "mid";
  else tier = "low";

  const colors = GRADIENTS[tier];
  const gradientId = `match-grad-${clamped}-${Math.random().toString(36).slice(2, 6)}`;

  const dimensions = { sm: 36, md: 44, lg: 56 };
  const strokeWidths = { sm: 3, md: 3.5, lg: 4 };
  const fontSizes = { sm: "text-[10px]", md: "text-xs", lg: "text-sm" };
  const dim = dimensions[size];
  const sw = strokeWidths[size];
  const fontSize = fontSizes[size];
  const r = (dim - sw) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 ${
        highlight ? "animate-pulse ring-2 ring-amber-400/50" : ""
      }`}
      title={`${clamped}% Match — Route: ${score} combined relevance`}
    >
      {/* SVG ring */}
      <svg width={dim} height={dim} className="shrink-0">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={colors.start} />
            <stop offset="100%" stopColor={colors.end} />
          </linearGradient>
        </defs>
        {/* Background circle */}
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={sw}
          className="text-gray-700/50"
        />
        {/* Progress circle */}
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${dim / 2} ${dim / 2})`}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <span
        className={`font-bold tracking-tight ${fontSize} ${
          tier === "high"
            ? "text-emerald-400"
            : tier === "mid"
              ? "text-amber-400"
              : "text-red-400"
        }`}
      >
        {clamped}%
      </span>
    </span>
  );
}
