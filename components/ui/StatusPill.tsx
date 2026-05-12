import { StatusLevel, STATUS_LABEL_TH, statusHex } from "@/lib/medical-status";
import { cn } from "@/lib/utils";

interface StatusPillProps {
  level: StatusLevel;
  label?: string;
  className?: string;
}

const bgMap: Record<StatusLevel, string> = {
  optimal: "bg-status-bg-optimal text-status-optimal",
  good:    "bg-status-bg-good text-status-good",
  caution: "bg-status-bg-caution text-status-caution",
  warning: "bg-status-bg-warning text-status-warning",
  danger:  "bg-status-bg-danger text-status-danger",
};

export function StatusPill({ level, label, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide",
        bgMap[level],
        className,
      )}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: statusHex[level] }}
        aria-hidden
      />
      {label ?? STATUS_LABEL_TH[level]}
    </span>
  );
}
