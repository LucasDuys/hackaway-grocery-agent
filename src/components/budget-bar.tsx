"use client";

interface BudgetBarProps {
  currentTotal: number; // cents
  budget: number; // cents
}

function centsToEur(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function BudgetBar({ currentTotal, budget }: BudgetBarProps) {
  const pct = budget > 0 ? Math.min((currentTotal / budget) * 100, 100) : 0;
  const isOver = currentTotal > budget;
  const isWarning = pct >= 80 && !isOver;

  let barColor = "bg-[var(--budget-green)]";
  if (isOver) barColor = "bg-[var(--budget-red)]";
  else if (isWarning) barColor = "bg-amber-500";

  let textColor = "text-[var(--budget-green)]";
  if (isOver) textColor = "text-[var(--budget-red)]";
  else if (isWarning) textColor = "text-amber-600";

  return (
    <div className="rounded-2xl bg-[var(--surface)] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Budget
        </span>
        <div className="flex items-baseline gap-1">
          <span className={`text-sm font-bold ${textColor}`}>
            EUR {centsToEur(currentTotal)}
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            / EUR {centsToEur(budget)}
          </span>
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-[var(--surface-muted)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isOver && (
        <p className="mt-2 text-xs font-medium text-[var(--budget-red)]">
          EUR {centsToEur(currentTotal - budget)} over budget
        </p>
      )}
    </div>
  );
}
