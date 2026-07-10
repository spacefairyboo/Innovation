"use client";

/** Colored initial block — the team's visual identity (no emojis). */
export function TeamGlyph({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const cls = size === "lg" ? "w-11 h-11 text-lg rounded-2xl" : "w-9 h-9 text-base rounded-xl";
  return (
    <span
      className={`${cls} grid place-items-center font-bold text-white shrink-0`}
      style={{ background: "linear-gradient(135deg, #2a9686, #46c7b4)" }}
    >
      {name.trim().charAt(0)}
    </span>
  );
}
