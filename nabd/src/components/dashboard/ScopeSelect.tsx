"use client";

/* A small select that writes its choice into the URL, so server pages can
   scope their data to one section (or anything else) without client state. */

import { useRouter, useSearchParams } from "next/navigation";

export function ScopeSelect({ param, value, allLabel, options, label }: {
  param: string;
  value: string;
  allLabel: string;
  options: { id: string; label: string }[];
  label: string;
}) {
  const router = useRouter();
  const search = useSearchParams();

  const apply = (next: string) => {
    const q = new URLSearchParams(search.toString());
    if (next) q.set(param, next);
    else q.delete(param);
    router.push(`?${q.toString()}`, { scroll: false });
  };

  return (
    <select
      className="field-input !w-auto !py-2 text-sm"
      value={value}
      onChange={(e) => apply(e.target.value)}
      aria-label={label}
    >
      <option value="">{allLabel}</option>
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
}
