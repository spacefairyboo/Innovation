"use client";

/* A small select that writes its choice into the URL, so server pages can
   scope their data to one section (or anything else) without client state. */

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui";

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
    <Select
      ariaLabel={label}
      value={value}
      onChange={apply}
      options={[{ value: "", label: allLabel }, ...options.map((o) => ({ value: o.id, label: o.label }))]}
    />
  );
}
