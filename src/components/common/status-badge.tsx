import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Status is the field an operator scans for first, so each value gets a stable colour
 * rather than all statuses sharing one neutral chip.
 */
const TONE: Record<string, string> = {
  active:    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  draft:     "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  paused:    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  archived:  "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  inactive:  "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant="secondary" className={cn("capitalize", TONE[status])}>
      {status}
    </Badge>
  );
}
