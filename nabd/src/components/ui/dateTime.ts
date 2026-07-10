/* Relative-time and due-date display helpers. */

export function relTime(ts: number, t: (k: string, v?: Record<string, string | number>) => string): string {
  const d = Math.floor((Date.now() - ts) / 86_400_000);
  if (d <= 0) return t("today");
  if (d === 1) return t("yesterday");
  return t("days_ago", { d });
}

export function dueInfo(due: string | null, t: (k: string, v?: Record<string, string | number>) => string, lang: string):
  { text: string; overdue: boolean } {
  if (!due) return { text: "", overdue: false };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = Math.round((new Date(`${due}T00:00`).getTime() - today.getTime()) / 86_400_000);
  if (d < 0) return { text: `${t("overdue")} · ${Math.abs(d)}${lang === "ar" ? " يوم" : "d"}`, overdue: true };
  if (d === 0) return { text: `${t("due")}: ${t("today")}`, overdue: false };
  if (d === 1) return { text: `${t("due")}: ${t("tomorrow")}`, overdue: false };
  return { text: `${t("due")}: ${t("in_days", { d })}`, overdue: false };
}
