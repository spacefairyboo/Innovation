"use client";

import { Icon } from "@/components/ui";

export

function ChoiceButton({ selected, onClick, children }: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold cursor-pointer transition border"
      aria-pressed={selected}
      style={selected
        ? { background: "var(--accent-soft)", color: "var(--primary)", borderColor: "var(--accent)" }
        : { background: "var(--surface-2)", color: "var(--ink-2)", borderColor: "var(--line)" }}
      onClick={onClick}
    >
      {children}
      {selected && <Icon name="check" size={13} />}
    </button>
  );
}
