"use client";

/* CG Reviewer — a clear three-step flow: pick the template, add the
   documents to check, run the review. Results come back per document
   with the findings listed and an annotated .docx copy to download. */

import { useRef, useState, useTransition } from "react";
import { reviewDocsAction } from "@/app/actions";
import { useI18n } from "@/components/providers";
import { Icon } from "@/components/ui";
import type { ReviewedDoc } from "@/server/actions/toolActions";

const KIND_META: Record<string, { icon: string; color: string; labelKey: string }> = {
  missing: { icon: "ban", color: "var(--st-blocked)", labelKey: "cg_missing" },
  changed: { icon: "alert-triangle", color: "var(--st-pending)", labelKey: "cg_changed" },
  added: { icon: "plus", color: "var(--st-ontrack)", labelKey: "cg_added" },
  spelling: { icon: "pencil", color: "var(--st-blocked)", labelKey: "cg_spelling" },
  wordy: { icon: "sparkles", color: "var(--st-pending)", labelKey: "cg_wordy" },
};

const ACCEPT = ".docx,.txt,.md";

function FileDrop({ label, sub, multiple, files, onFiles, icon }: {
  label: string;
  sub: string;
  multiple?: boolean;
  files: File[];
  onFiles: (f: File[]) => void;
  icon: string;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="card !p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl grid place-items-center bg-accent-soft text-primary shrink-0">
          <Icon name={icon} size={18} />
        </span>
        <div>
          <h3 className="m-0 text-base font-bold">{label}</h3>
          <p className="m-0 text-xs text-ink-3">{sub}</p>
        </div>
      </div>
      <button
        type="button"
        className="rounded-2xl border-2 border-dashed border-line hover:border-accent transition bg-surface-2 px-4 py-6 text-sm text-ink-2 cursor-pointer"
        onClick={() => inputRef.current?.click()}
      >
        <Icon name="plus" size={16} className="inline-block me-1.5 align-text-bottom" />
        {t(multiple ? "cg_add_files" : "cg_add_file")}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const picked = [...(e.target.files ?? [])];
          if (picked.length) onFiles(multiple ? [...files, ...picked] : picked.slice(0, 1));
          e.target.value = "";
        }}
      />
      {files.length > 0 && (
        <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
              <Icon name="file-check" size={15} className="text-primary shrink-0" />
              <span className="flex-1 min-w-0 truncate">{f.name}</span>
              <span className="text-xs text-ink-3 tabular-nums shrink-0">{Math.max(1, Math.round(f.size / 1024))} KB</span>
              <button
                className="icon-btn !w-7 !h-7"
                aria-label={`remove ${f.name}`}
                onClick={() => onFiles(files.filter((_, j) => j !== i))}
              >
                <Icon name="x" size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CgReviewer() {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [template, setTemplate] = useState<File[]>([]);
  const [docs, setDocs] = useState<File[]>([]);
  const [results, setResults] = useState<ReviewedDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setError(null);
    setResults(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("template", template[0]);
      for (const d of docs) fd.append("docs", d);
      try {
        const res = await reviewDocsAction(fd);
        if (res.error) setError(t(`cg_err_${res.error}`));
        setResults(res.results.length ? res.results : null);
      } catch {
        setError(t("cg_err_failed"));
      }
    });
  };

  const download = (r: ReviewedDoc) => {
    const bytes = Uint8Array.from(atob(r.fileBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = r.fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <FileDrop
          icon="file-check"
          label={t("cg_template_label")}
          sub={t("cg_template_sub")}
          files={template}
          onFiles={setTemplate}
        />
        <FileDrop
          icon="inbox"
          label={t("cg_docs_label")}
          sub={t("cg_docs_sub")}
          multiple
          files={docs}
          onFiles={setDocs}
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          className="btn-primary !px-6 !py-3"
          disabled={pending || !template.length || !docs.length}
          onClick={run}
        >
          <Icon name={pending ? "history" : "sparkles"} size={16} />
          {pending ? t("cg_running") : t("cg_run")}
        </button>
        {pending && <span className="text-sm text-ink-2">{t("cg_running_hint")}</span>}
        {error && <span className="text-sm font-semibold" style={{ color: "var(--st-blocked)" }}>{error}</span>}
      </div>

      {results && (
        <div className="flex flex-col gap-4">
          <h3 className="m-0 text-lg font-bold">{t("cg_results")}</h3>
          {results.map((r) => (
            <div key={r.name} className="card !p-5">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <span className="w-9 h-9 rounded-xl grid place-items-center bg-accent-soft text-primary shrink-0">
                  <Icon name="file-check" size={17} />
                </span>
                <div className="flex-1 min-w-40">
                  <div className="font-bold text-sm">{r.name}</div>
                  <div className="text-xs text-ink-3">
                    {r.error ? t("cg_err_failed") : t("cg_findings_count", { n: r.findings.length })}
                  </div>
                </div>
                {!r.error && (
                  <button className="btn-primary btn-sm" onClick={() => download(r)}>
                    <Icon name="download" size={14} /> {t("cg_download")}
                  </button>
                )}
              </div>
              {!r.error && <p className="m-0 mb-3 text-sm text-ink-2 max-w-2xl">{r.summary}</p>}
              {!r.error && r.findings.length > 0 && (
                <div className="flex flex-col gap-2">
                  {r.findings.map((f, i) => {
                    const meta = KIND_META[f.kind];
                    return (
                      <div key={i} className="rounded-xl border border-line bg-surface-2 px-3.5 py-2.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold mb-1" style={{ color: meta.color }}>
                          <Icon name={meta.icon} size={13} /> {t(meta.labelKey)}
                        </div>
                        <p className="m-0 text-sm text-ink">{f.comment}</p>
                        {(f.excerpt || f.templateExcerpt) && (
                          <p className="m-0 mt-1 text-xs text-ink-3 italic">
                            {f.excerpt ? `“${f.excerpt}”` : `“${f.templateExcerpt}”`}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
