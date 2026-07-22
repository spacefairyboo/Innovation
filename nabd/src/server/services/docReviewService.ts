/* CG Reviewer engine — compares documents against a template document,
   classifies the differences (missing from the doc, added beyond the
   template, changed wording), writes a reviewer comment for each, and
   produces an annotated .docx copy with the comments placed inline right
   after the passages they concern.

   The comparison is a deterministic paragraph-matching engine (word-set
   similarity), so it works with no API key. When ChatGPT is configured
   the per-document summary is written by the model instead of templated. */

import OpenAI from "openai";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { config } from "../config";
import { logger } from "../logger";
import type { Lang } from "@/lib/types";

const log = logger("cg-review");

const client = config.openai.enabled
  ? new OpenAI({ apiKey: config.openai.apiKey, timeout: 15_000, maxRetries: 0 })
  : null;

export type FindingKind = "missing" | "added" | "changed";

export interface Finding {
  kind: FindingKind;
  /** The passage in the reviewed document this concerns ("" for missing sections). */
  excerpt: string;
  /** What the template says, when relevant. */
  templateExcerpt: string;
  comment: string;
}

export interface DocReview {
  summary: string;
  findings: Finding[];
}

/* ---------------- paragraph matching ---------------- */

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Meaningful paragraphs of a document (headings and one-liners included). */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}|\r\n{2,}|\n(?=[A-Z؀-ۿ].{0,60}$)/m)
    .flatMap((b) => b.split(/\n/))
    .map(clean)
    .filter((p) => p.length >= 3);
}

const words = (s: string) =>
  new Set(s.toLowerCase().split(/[^\p{L}\p{N}%]+/u).filter((w) => w.length > 1));

/** Jaccard similarity over word sets: 0 (nothing shared) → 1 (same words). */
function similarity(a: string, b: string): number {
  const wa = words(a);
  const wb = words(b);
  if (!wa.size || !wb.size) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / (wa.size + wb.size - shared);
}

const shorten = (s: string, n = 180) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

/* ---------------- the review ---------------- */

function localReview(templateText: string, docText: string, lang: Lang): DocReview {
  const ar = lang === "ar";
  const tplParas = splitParagraphs(templateText);
  const docParas = splitParagraphs(docText);
  const findings: Finding[] = [];
  const usedDoc = new Set<number>();

  // Pair every template paragraph with its closest counterpart in the doc.
  for (const tpl of tplParas) {
    let best = -1;
    let bestSim = 0;
    docParas.forEach((p, i) => {
      if (usedDoc.has(i)) return;
      const s = similarity(tpl, p);
      if (s > bestSim) { bestSim = s; best = i; }
    });
    if (best >= 0 && bestSim >= 0.55) {
      usedDoc.add(best); // matches closely enough: same content
    } else if (best >= 0 && bestSim >= 0.22) {
      usedDoc.add(best);
      findings.push({
        kind: "changed",
        excerpt: shorten(docParas[best]),
        templateExcerpt: shorten(tpl),
        comment: ar
          ? "هذه الفقرة تختلف عن نص القالب. راجع الصياغة وطابقها مع القالب أو وثّق سبب الاختلاف."
          : "This passage differs from the template wording. Review it and either align it with the template or record why it deviates.",
      });
    } else {
      findings.push({
        kind: "missing",
        excerpt: "",
        templateExcerpt: shorten(tpl),
        comment: ar
          ? "هذا البند موجود في القالب ولم يُعثر عليه في المستند. أضِفه أو وضّح سبب حذفه."
          : "This item exists in the template but was not found in the document. Add it, or note why it was left out.",
      });
    }
  }

  // Anything left in the doc has no basis in the template.
  docParas.forEach((p, i) => {
    if (usedDoc.has(i)) return;
    if (tplParas.some((tpl) => similarity(tpl, p) >= 0.55)) return; // duplicate section
    findings.push({
      kind: "added",
      excerpt: shorten(p),
      templateExcerpt: "",
      comment: ar
        ? "هذه الإضافة غير موجودة في القالب. تأكد أنها مقصودة ومعتمدة."
        : "This content is not part of the template. Confirm it is intentional and approved.",
    });
  });

  const counts = {
    missing: findings.filter((f) => f.kind === "missing").length,
    changed: findings.filter((f) => f.kind === "changed").length,
    added: findings.filter((f) => f.kind === "added").length,
  };
  const summary = findings.length === 0
    ? (ar ? "المستند مطابق للقالب. لا ملاحظات." : "The document matches the template. No findings.")
    : ar
      ? `وُجدت ${findings.length} ملاحظة: ${counts.missing} بنود ناقصة، ${counts.changed} فقرات مختلفة الصياغة، ${counts.added} إضافات خارج القالب.`
      : `${findings.length} finding${findings.length === 1 ? "" : "s"}: ${counts.missing} missing from the document, ${counts.changed} with changed wording, ${counts.added} added beyond the template.`;
  return { summary, findings };
}

/** When ChatGPT is configured, it rewrites the summary with real judgement;
    the deterministic findings stay as the ground truth either way. */
async function polishSummary(review: DocReview, docName: string, lang: Lang): Promise<string> {
  if (!client || review.findings.length === 0) return review.summary;
  try {
    const response = await client.responses.create({
      model: config.openai.model,
      max_output_tokens: 300,
      instructions: `You are a compliance reviewer. Write a 2-3 sentence summary in ${lang === "ar" ? "Arabic" : "English"} of the review findings for the document "${docName}". Plain sentences, no markdown, no em dashes. Mention the most important issue first.`,
      input: review.findings.map((f) => `${f.kind}: ${f.comment} ${f.templateExcerpt || f.excerpt}`).join("\n"),
    });
    return response.output_text.trim() || review.summary;
  } catch (err) {
    log.warn(`summary polish failed: ${err instanceof Error ? err.message : err}`);
    return review.summary;
  }
}

export async function reviewDocument(templateText: string, docText: string, docName: string, lang: Lang): Promise<DocReview> {
  const review = localReview(templateText, docText, lang);
  return { ...review, summary: await polishSummary(review, docName, lang) };
}

/* ---------------- the annotated .docx ---------------- */

const KIND_LABEL: Record<FindingKind, { en: string; ar: string }> = {
  missing: { en: "MISSING FROM THIS DOCUMENT", ar: "ناقص في هذا المستند" },
  changed: { en: "DIFFERS FROM TEMPLATE", ar: "يختلف عن القالب" },
  added: { en: "NOT IN TEMPLATE", ar: "غير موجود في القالب" },
};

function commentParagraph(f: Finding, lang: Lang): Paragraph {
  const label = KIND_LABEL[f.kind][lang];
  return new Paragraph({
    spacing: { before: 60, after: 160 },
    children: [
      new TextRun({ text: `⬤ ${label}: `, bold: true, color: "B3261E", highlight: "yellow" }),
      new TextRun({ text: f.comment, color: "B3261E", highlight: "yellow" }),
      ...(f.templateExcerpt
        ? [new TextRun({ text: lang === "ar" ? ` نص القالب: "${f.templateExcerpt}"` : ` Template says: "${f.templateExcerpt}"`, italics: true, color: "5A5A5A", highlight: "yellow" })]
        : []),
    ],
  });
}

/** The reviewed copy: the document's own paragraphs with each reviewer
    comment inserted right after the passage it concerns; missing-item
    comments are gathered at the end under their own heading. */
export async function buildReviewedDocx(docName: string, docText: string, review: DocReview, lang: Lang): Promise<Buffer> {
  const ar = lang === "ar";
  const docParas = splitParagraphs(docText);
  const byExcerpt = new Map<string, Finding[]>();
  for (const f of review.findings) {
    if (!f.excerpt) continue;
    const key = f.excerpt.replace(/…$/, "");
    if (!byExcerpt.has(key)) byExcerpt.set(key, []);
    byExcerpt.get(key)!.push(f);
  }
  const missing = review.findings.filter((f) => f.kind === "missing");

  const children: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: ar ? `مراجعة: ${docName}` : `Review: ${docName}` })] }),
    new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: review.summary, italics: true })] }),
  ];

  for (const p of docParas) {
    children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: p })] }));
    const hits = [...byExcerpt.entries()].filter(([key]) => p.startsWith(key)).flatMap(([, fs]) => fs);
    for (const f of hits) children.push(commentParagraph(f, lang));
  }

  if (missing.length) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2, spacing: { before: 300 },
      children: [new TextRun({ text: ar ? "بنود القالب غير الموجودة في المستند" : "Template items missing from this document" })],
    }));
    for (const f of missing) children.push(commentParagraph(f, lang));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
