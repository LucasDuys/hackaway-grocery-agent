"use client";

export type Persona = "family" | "student";

interface PersonaSelectorProps {
  selected: Persona;
  onChange: (persona: Persona) => void;
  disabled?: boolean;
}

const PERSONAS: {
  id: Persona;
  title: string;
  description: string;
}[] = [
  {
    id: "family",
    title: "Family Household",
    description: "100 orders, ~EUR 200/week, Monday deliveries",
  },
  {
    id: "student",
    title: "Student",
    description: "50 orders, ~EUR 35/week, Wed/Fri deliveries",
  },
];

export function PersonaSelector({
  selected,
  onChange,
  disabled,
}: PersonaSelectorProps) {
  return (
    <div className="flex gap-3">
      {PERSONAS.map((persona) => {
        const isSelected = selected === persona.id;
        return (
          <button
            key={persona.id}
            onClick={() => onChange(persona.id)}
            disabled={disabled}
            className={`flex-1 rounded-lg border-2 px-4 py-3 text-left transition-all ${
              isSelected
                ? "border-[var(--picnic-red)] bg-[var(--picnic-red-light)] shadow-md"
                : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--text-muted)]"
            } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
          >
            <p
              className={`text-sm font-semibold ${
                isSelected
                  ? "text-[var(--picnic-red)]"
                  : "text-[var(--text-primary)]"
              }`}
            >
              {persona.title}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {persona.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Compact persona indicator for use when the cart is populated.
 */
export function PersonaIndicator({
  persona,
}: {
  persona: Persona;
}) {
  const label = persona === "family" ? "Family Household" : "Student";
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--picnic-red)]" />
      <span className="text-[11px] font-medium text-[var(--text-secondary)]">
        {label}
      </span>
    </div>
  );
}
