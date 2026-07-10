"use client";

import { useI18n, useToast } from "@/components/providers";
import { Icon } from "@/components/ui";

export function ExportCsvButton({ rows, filename }: { rows: string[][]; filename: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const download = () => {
    const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    toast(t("exported"));
  };
  return <button className="btn-ghost" onClick={download}><Icon name="download" size={15} /> {t("export_csv")}</button>;
}
