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
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          Budget
        </span>
        <span className={`text-sm font-semibold font-mono ${textColor}`}>
          EUR {centsToEur(currentTotal)} / EUR {centsToEur(budget)}
        </span>
      </div>
      <div className="h-3 w-full rounded-full bg-[var(--surface-muted)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isOver && (
        <p className="mt-1.5 text-xs font-medium text-[var(--budget-red)]">
          Over budget by EUR {centsToEur(currentTotal - budget)}
        </p>
      )}
    </div>
  );
}
