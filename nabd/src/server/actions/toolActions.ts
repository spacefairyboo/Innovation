"use server";

/* Tools actions — CG Reviewer: takes one template document and a batch of
   documents to check, reviews each against the template, and returns the
   findings plus an annotated .docx copy per document for download. */

import { getSession } from "../auth/session";
import { logger } from "../logger";
import { buildReviewedDocx, reviewDocument, type Finding } from "../services/docReviewService";

const log = logger("tools");

const MAX_FILE_BYTES = 3 * 1024 * 1024; // 3 MB per file
const MAX_DOCS = 10;

export interface ReviewedDoc {
  name: string;
  summary: string;
  findings: Finding[];
  /** The annotated .docx, base64-encoded for download on the client. */
  fileBase64: string;
  fileName: string;
  error?: string;
}

/** Text content of an uploaded file: .docx via mammoth, anything else as UTF-8. */
async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  if (/\.docx$/i.test(file.name)) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }
  return buffer.toString("utf8");
}

export async function reviewDocsAction(formData: FormData): Promise<{ results: ReviewedDoc[]; error?: string }> {
  const { lang } = await getSession();

  const template = formData.get("template");
  const docs = formData.getAll("docs").filter((d): d is File => d instanceof File);
  if (!(template instanceof File) || !template.size) return { results: [], error: "template" };
  if (!docs.length) return { results: [], error: "docs" };
  if (template.size > MAX_FILE_BYTES || docs.some((d) => d.size > MAX_FILE_BYTES) || docs.length > MAX_DOCS) {
    return { results: [], error: "size" };
  }

  let templateText: string;
  try {
    templateText = await extractText(template);
  } catch (err) {
    log.warn(`template extraction failed: ${err instanceof Error ? err.message : err}`);
    return { results: [], error: "template" };
  }
  if (!templateText.trim()) return { results: [], error: "template" };

  const results: ReviewedDoc[] = [];
  for (const doc of docs) {
    try {
      const text = await extractText(doc);
      const review = await reviewDocument(templateText, text, doc.name, lang);
      const annotated = await buildReviewedDocx(doc.name, text, review, lang);
      results.push({
        name: doc.name,
        summary: review.summary,
        findings: review.findings,
        fileBase64: annotated.toString("base64"),
        fileName: doc.name.replace(/\.(docx|txt|md)$/i, "") + ".reviewed.docx",
      });
    } catch (err) {
      log.warn(`review failed for ${doc.name}: ${err instanceof Error ? err.message : err}`);
      results.push({ name: doc.name, summary: "", findings: [], fileBase64: "", fileName: "", error: "failed" });
    }
  }
  return { results };
}
