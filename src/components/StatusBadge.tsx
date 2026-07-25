export type LoadStatus = "posted" | "accepted" | "in-transit" | "delivered";

interface StatusBadgeProps {
  status: LoadStatus;
}

const colorMap: Record<
  LoadStatus,
  { bg: string; text: string; pulse: boolean }
> = {
  posted: { bg: "bg-blue-900/30", text: "text-blue-400", pulse: false },
  accepted: { bg: "bg-amber-900/30", text: "text-amber-400", pulse: false },
  "in-transit": {
    bg: "bg-orange-900/30",
    text: "text-orange-400",
    pulse: true,
  },
  delivered: { bg: "bg-emerald-900/30", text: "text-emerald-400", pulse: false },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const colors = colorMap[status] ?? {
    bg: "bg-gray-800",
    text: "text-gray-400",
    pulse: false,
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${colors.bg} ${colors.text}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full bg-current ${colors.pulse ? "animate-pulse" : ""}`}
      />
      {status}
    </span>
  );
}
