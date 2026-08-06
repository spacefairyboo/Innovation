"use client";

/* Bulk check-in. Paste a whole day of updates in one go — one line per
   update, English or Arabic, in any wording — and the AI matches each
   line to the right task. Nothing is written blind: every match is shown
   first, any of them can be repointed or skipped, then one click applies
   them all. Each applied line lands in its task's activity history as a
   normal attributed update. */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n, useToast } from "@/components/providers";
import { Icon, Modal, Select, StatusChip } from "@/components/ui";
import { applyBulkUpdates, previewBulkUpdates, type BulkPreviewItem } from "@/server/actions/taskActions";
import type { Localized, TaskStatus } from "@/lib/types";

interface Row extends BulkPreviewItem {
  skipped: boolean;
}

export function BulkUpdateButton() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [options, setOptions] = useState<{ id: string; title: Localized }[]>([]);
  const [pending, startTransition] = useTransition();

  const close = () => {
    setOpen(false);
    setRows(null);
    setText("");
  };

  const preview = () => startTransition(async () => {
    const res = await previewBulkUpdates(text);
    if (!res.items.length) {
      toast(t("bulk_no_lines"));
      return;
    }
    setOptions(res.options);
    setRows(res.items.map((it) => ({ ...it, skipped: false })));
  });

  const apply = () => startTransition(async () => {
    const picked = (rows ?? []).filter((r) => !r.skipped && r.taskId);
    const res = await applyBulkUpdates(picked.map((r) => ({
      taskId: r.taskId!,
      note: r.line,
      status: r.status,
      progress: r.progress,
    })));
    toast(t("bulk_applied", { n: res.applied }));
    close();
    router.refresh();
  });

  const readyCount = (rows ?? []).filter((r) => !r.skipped && r.taskId).length;
  const selectOptions = options.map((o) => ({ value: o.id, label: o.title[lang] }));

  return (
    <>
      <button className="btn-ghost" onClick={() => setOpen(true)}>
        <Icon name="list-checks" size={16} /> {t("bulk_btn")}
      </button>
      {open && (
        <Modal title={t("bulk_title")} icon="list-checks" onClose={close}
          footer={rows === null ? (
            <>
              <span className="flex-1" />
              <button className="btn-ghost" onClick={close}>{t("cancel")}</button>
              <button className="btn-primary" disabled={pending || text.trim().length < 3} onClick={preview}>
                {pending ? t("assistant_thinking") : <><Icon name="sparkles" size={15} /> {t("bulk_match")}</>}
              </button>
            </>
          ) : (
            <>
              <button className="btn-ghost" onClick={() => setRows(null)}>
                <Icon name={lang === "ar" ? "chevron-right" : "chevron-left"} size={15} /> {t("bulk_back")}
              </button>
              <span className="flex-1" />
              <button className="btn-primary" disabled={pending || readyCount === 0} onClick={apply}>
                {pending ? t("assistant_thinking") : t("bulk_apply", { n: readyCount })}
              </button>
            </>
          )}
        >
          {rows === null ? (
            <>
              <p className="m-0 mb-3 text-sm text-ink-2">{t("bulk_hint")}</p>
              <textarea
                className="input w-full min-h-52 text-sm leading-6"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t("bulk_placeholder")}
                autoFocus
              />
            </>
          ) : (
            <div className="flex flex-col gap-2.5">
              {rows.map((r, i) => (
                <div key={i} className={`rounded-2xl border border-line p-3 ${r.skipped ? "opacity-45" : ""}`}>
                  <div className="text-sm mb-2 break-words">“{r.line}”</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select
                      value={r.taskId ?? ""}
                      options={selectOptions}
                      placeholder={t("bulk_none")}
                      ariaLabel={t("bulk_target")}
                      onChange={(v) => setRows((prev) => prev!.map((x, j) => j === i ? { ...x, taskId: v, skipped: false } : x))}
                      className="max-w-72"
                      disabled={r.skipped}
                    />
                    {r.status && <StatusChip status={r.status as TaskStatus} />}
                    {r.progress !== undefined && (
                      <span className="text-xs font-bold tabular-nums text-ink-2">{r.progress}%</span>
                    )}
                    <span className="flex-1" />
                    <button
                      className="icon-btn !w-8 !h-8"
                      title={r.skipped ? t("bulk_include") : t("bulk_skip")}
                      aria-label={r.skipped ? t("bulk_include") : t("bulk_skip")}
                      onClick={() => setRows((prev) => prev!.map((x, j) => j === i ? { ...x, skipped: !x.skipped } : x))}
                    >
                      <Icon name={r.skipped ? "rotate-ccw" : "x"} size={15} />
                    </button>
                  </div>
                  {!r.skipped && !r.taskId && (
                    <div className="mt-1.5 text-xs text-[var(--st-delayed)]">{t("bulk_unmatched")}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
