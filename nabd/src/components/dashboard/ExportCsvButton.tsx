"use client";

/* The standard export button: same label, same Excel-safe CSV everywhere. */

import { useI18n, useToast } from "@/components/providers";
import { Icon } from "@/components/ui";
import { downloadCsv } from "@/lib/csv";

export function ExportCsvButton({ rows, filename }: { rows: string[][]; filename: string }) {
  const { t } = useI18n();
  const toast = useToast();
  return (
    <button
      className="btn-ghost"
      onClick={() => {
        downloadCsv(filename, rows);
        toast(t("exported"));
      }}
    >
      <Icon name="download" size={15} /> {t("export_csv")}
    </button>
  );
}
