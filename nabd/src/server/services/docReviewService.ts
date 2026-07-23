/* CG Reviewer engine — compares documents against a template document and
   produces a reviewed .docx copy with real Word comments (the kind that
   appear in Word's review pane), authored by "Relationship Manager" and
   anchored to the exact text they concern.

   Four deterministic passes, so everything works with no API key:
     1. Template diff  — paragraphs that changed, were added beyond the
        template (unnecessary clauses), or are missing from the document.
     2. Spelling       — a real Hunspell dictionary; each misspelling gets
        a plain-language comment with the suggested correction.
     3. Wordiness      — verbose phrases ("in order to", "due to the fact
        that") with the tighter replacement to use.
   When ChatGPT is configured the per-document summary is written by the
   model; the findings themselves stay deterministic. */

import OpenAI from "openai";
import {
  CommentRangeEnd, CommentRangeStart, CommentReference,
  Document, HeadingLevel, Packer, Paragraph, TextRun,
} from "docx";
import { config } from "../config";
import { logger } from "../logger";
import type { Lang } from "@/lib/types";

const log = logger("cg-review");

const client = config.openai.enabled
  ? new OpenAI({ apiKey: config.openai.apiKey, timeout: 15_000, maxRetries: 0 })
  : null;

export const REVIEW_AUTHOR = "Relationship Manager";

export type FindingKind = "missing" | "added" | "changed" | "spelling" | "wordy";

export interface Finding {
  kind: FindingKind;
  /** The passage (or word) in the reviewed document this concerns; "" for missing sections. */
  excerpt: string;
  /** What the template says, when relevant. */
  templateExcerpt: string;
  /** The comment text, written as a reviewer would: what is wrong + the corrective action. */
  comment: string;
  /** Anchor: paragraph index in the document, and the character range inside it. */
  para: number;
  start: number;
  end: number;
}

export interface DocReview {
  summary: string;
  findings: Finding[];
}

/* ---------------- text utilities ---------------- */

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Meaningful paragraphs of a document (headings and one-liners included). */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}|\r\n{2,}|\n(?=[A-Z؀-ۿ].{0,60}$)/m)
    .flatMap((b) => b.split(/\n/))
    .map(clean)
    .filter((p) => p.length >= 3);
}

const wordSet = (s: string) =>
  new Set(s.toLowerCase().split(/[^\p{L}\p{N}%]+/u).filter((w) => w.length > 1));

/** Jaccard similarity over word sets: 0 (nothing shared) → 1 (same words). */
function similarity(a: string, b: string): number {
  const wa = wordSet(a);
  const wb = wordSet(b);
  if (!wa.size || !wb.size) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / (wa.size + wb.size - shared);
}

const shorten = (s: string, n = 160) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

/* ---------------- pass 1: template diff ---------------- */

/** Word-level diff (LCS) between a template paragraph and its counterpart:
    which words the document added and which it dropped. */
function wordDiff(a: string, b: string): { removed: string[]; added: string[] } {
  const wa = a.split(/\s+/);
  const wb = b.split(/\s+/);
  const n = wa.length;
  const m = wb.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = wa[i].toLowerCase() === wb[j].toLowerCase()
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const removed: string[] = [];
  const added: string[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (wa[i].toLowerCase() === wb[j].toLowerCase()) { i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) removed.push(wa[i++]);
    else added.push(wb[j++]);
  }
  removed.push(...wa.slice(i));
  added.push(...wb.slice(j));
  return { removed, added };
}

const phrase = (words: string[]) =>
  words.slice(0, 12).join(" ") + (words.length > 12 ? "…" : "");

function templateDiff(tplParas: string[], docParas: string[], lang: Lang): Finding[] {
  const ar = lang === "ar";
  const findings: Finding[] = [];
  const usedDoc = new Set<number>();

  for (const tpl of tplParas) {
    let best = -1;
    let bestSim = 0;
    docParas.forEach((p, i) => {
      if (usedDoc.has(i)) return;
      const s = similarity(tpl, p);
      if (s > bestSim) { bestSim = s; best = i; }
    });
    if (best >= 0 && bestSim >= 0.55) {
      usedDoc.add(best);
      // Even a close match gets reviewed word by word: swapping "audit
      // committee" for "manager" keeps the paragraph 90% similar and must
      // still be commented on.
      const d = wordDiff(tpl, docParas[best]);
      if (d.added.length || d.removed.length) {
        const detailEn = [
          d.added.length ? `Added: "${phrase(d.added)}".` : "",
          d.removed.length ? `Removed from the template text: "${phrase(d.removed)}".` : "",
        ].filter(Boolean).join(" ");
        const detailAr = [
          d.added.length ? `أُضيف: "${phrase(d.added)}".` : "",
          d.removed.length ? `حُذف من نص القالب: "${phrase(d.removed)}".` : "",
        ].filter(Boolean).join(" ");
        findings.push({
          kind: "changed",
          excerpt: shorten(docParas[best]),
          templateExcerpt: shorten(tpl),
          para: best, start: 0, end: docParas[best].length,
          comment: ar
            ? `هذه الفقرة تختلف عن نص القالب المعتمد. ${detailAr} الإجراء التصحيحي: طابق الصياغة مع القالب أو وثّق سبب الاختلاف.`.replace(/\s+/g, " ")
            : `This wording differs from the approved template. ${detailEn} Corrective action: align it with the template text, or record the approved reason for deviating.`.replace(/\s+/g, " "),
        });
      }
    } else if (best >= 0 && bestSim >= 0.22) {
      usedDoc.add(best);
      // Name the exact changes, not just "this differs".
      const d = wordDiff(tpl, docParas[best]);
      const detailEn = [
        d.added.length ? `Added: "${phrase(d.added)}".` : "",
        d.removed.length ? `Removed from the template text: "${phrase(d.removed)}".` : "",
      ].filter(Boolean).join(" ");
      const detailAr = [
        d.added.length ? `أُضيف: "${phrase(d.added)}".` : "",
        d.removed.length ? `حُذف من نص القالب: "${phrase(d.removed)}".` : "",
      ].filter(Boolean).join(" ");
      findings.push({
        kind: "changed",
        excerpt: shorten(docParas[best]),
        templateExcerpt: shorten(tpl),
        para: best, start: 0, end: docParas[best].length,
        comment: ar
          ? `هذه الفقرة تختلف عن نص القالب المعتمد. ${detailAr} الإجراء التصحيحي: طابق الصياغة مع القالب أو وثّق سبب الاختلاف.`.replace(/\s+/g, " ")
          : `This wording differs from the approved template. ${detailEn} Corrective action: align it with the template text, or record the approved reason for deviating.`.replace(/\s+/g, " "),
      });
    } else {
      findings.push({
        kind: "missing",
        excerpt: "",
        templateExcerpt: shorten(tpl),
        para: 0, start: 0, end: docParas[0]?.length ?? 0,
        comment: ar
          ? `بند مطلوب في القالب غير موجود في هذا المستند: "${shorten(tpl)}". الإجراء التصحيحي: أضف هذا البند في موضعه الصحيح.`
          : `A required template item is missing from this document: "${shorten(tpl)}". Corrective action: add this item in its proper place.`,
      });
    }
  }

  docParas.forEach((p, i) => {
    if (usedDoc.has(i)) return;
    if (tplParas.some((tpl) => similarity(tpl, p) >= 0.55)) return; // duplicate of a matched section
    findings.push({
      kind: "added",
      excerpt: shorten(p),
      templateExcerpt: "",
      para: i, start: 0, end: p.length,
      comment: ar
        ? "هذا البند غير موجود في القالب المعتمد. الإجراء التصحيحي: احذف هذا البند غير الضروري، أو أرفق موافقة معتمدة على إضافته."
        : "This clause is not part of the approved template. Corrective action: remove this unnecessary clause, or attach the documented approval for adding it.",
    });
  });

  return findings;
}

/* ---------------- pass 2: spelling (English Hunspell dictionary) ---------------- */

type Speller = { correct: (w: string) => boolean; suggest: (w: string) => string[] };
let spellerPromise: Promise<Speller | null> | null = null;

function getSpeller(): Promise<Speller | null> {
  spellerPromise ??= (async () => {
    try {
      // The dictionary package loads its files via import.meta.url, which
      // the bundler rewrites; resolve the real files on disk instead.
      const [{ createRequire }, fs, path, { default: nspell }] = await Promise.all([
        import("node:module"),
        import("node:fs/promises"),
        import("node:path"),
        import("nspell"),
      ]);
      const req = createRequire(path.join(process.cwd(), "package.json"));
      const dir = path.dirname(req.resolve("dictionary-en"));
      const [aff, dic] = await Promise.all([
        fs.readFile(path.join(dir, "index.aff")),
        fs.readFile(path.join(dir, "index.dic")),
      ]);
      return nspell({ aff, dic }) as Speller;
    } catch (err) {
      log.warn(`spellchecker unavailable: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  })();
  return spellerPromise;
}

const MAX_SPELLING = 60;

/* Typos the dictionary handles badly: either its first suggestion is wrong
   ("teh" → "ten"), or the typo happens to be a real word ("asses",
   "mangers") that a plain dictionary check would wave through. */
const COMMON_TYPOS: Record<string, string> = {
  teh: "the", adn: "and", taht: "that", thier: "their", recieved: "received",
  asses: "assess", mangers: "managers", manger: "manager", pubic: "public",
  singed: "signed",
};

async function spellingPass(templateText: string, docParas: string[], lang: Lang): Promise<Finding[]> {
  const spell = await getSpeller();
  if (!spell) return [];
  const ar = lang === "ar";
  // Words the template itself uses are domain vocabulary, never misspellings.
  const domain = wordSet(templateText);
  const findings: Finding[] = [];

  docParas.forEach((p, paraIdx) => {
    // Every occurrence gets its own comment: a reviewer marks each instance.
    for (const m of p.matchAll(/[A-Za-z][A-Za-z']{2,}/g)) {
      if (findings.length >= MAX_SPELLING) return;
      const word = m[0].replace(/'+$/, "");
      const lower = word.toLowerCase();
      if (domain.has(lower)) continue;
      if (/[A-Z]/.test(word.slice(1))) continue; // acronyms, product names
      const knownTypo = COMMON_TYPOS[lower];
      if (!knownTypo && (spell.correct(word) || spell.correct(lower))) continue;
      const suggestion = knownTypo ?? spell.suggest(word)[0] ?? spell.suggest(lower)[0];
      const hasFix = !!suggestion && suggestion.toLowerCase() !== lower;
      findings.push({
        kind: "spelling",
        excerpt: word,
        templateExcerpt: "",
        para: paraIdx, start: m.index, end: m.index + word.length,
        comment: hasFix
          ? (ar
              ? `يبدو أن كلمة "${word}" مكتوبة خطأ. الإجراء التصحيحي: صححها إلى "${suggestion}".`
              : `The word "${word}" appears to be misspelled. Corrective action: correct it to "${suggestion}".`)
          : (ar
              ? `كلمة "${word}" غير معروفة في القاموس. الإجراء التصحيحي: تحقق من إملائها أو أكد أنها مصطلح معتمد.`
              : `The word "${word}" is not recognized. Corrective action: check its spelling, or confirm it is an approved term.`),
      });
    }
  });
  return findings;
}

/* ---------------- pass 3: unnecessary wording ---------------- */

const WORDY_PHRASES: { find: RegExp; use: string }[] = [
  { find: /\bin order to\b/gi, use: "to" },
  { find: /\bdue to the fact that\b/gi, use: "because" },
  { find: /\bat this point in time\b/gi, use: "now" },
  { find: /\bat the present time\b/gi, use: "now" },
  { find: /\bin the near future\b/gi, use: "soon" },
  { find: /\bin the event that\b/gi, use: "if" },
  { find: /\bfor the purpose of\b/gi, use: "for" },
  { find: /\bwith regard to\b/gi, use: "regarding" },
  { find: /\bin relation to\b/gi, use: "about" },
  { find: /\bit should be noted that\b/gi, use: "" },
  { find: /\bit is important to note that\b/gi, use: "" },
  { find: /\bas a matter of fact\b/gi, use: "" },
  { find: /\bthe fact that\b/gi, use: "that" },
  { find: /\beach and every\b/gi, use: "every" },
  { find: /\bin spite of the fact that\b/gi, use: "although" },
  { find: /\bon a regular basis\b/gi, use: "regularly" },
  { find: /\bin a timely manner\b/gi, use: "promptly" },
  { find: /\ba large number of\b/gi, use: "many" },
  { find: /\bthe majority of\b/gi, use: "most" },
  { find: /\bprior to\b/gi, use: "before" },
  { find: /\bsubsequent to\b/gi, use: "after" },
  { find: /\buntil such time as\b/gi, use: "until" },
];

function wordinessPass(docParas: string[], lang: Lang): Finding[] {
  const ar = lang === "ar";
  const findings: Finding[] = [];
  docParas.forEach((p, paraIdx) => {
    for (const { find, use } of WORDY_PHRASES) {
      for (const m of p.matchAll(find)) {
        findings.push({
          kind: "wordy",
          excerpt: m[0],
          templateExcerpt: "",
          para: paraIdx, start: m.index, end: m.index + m[0].length,
          comment: use
            ? (ar
                ? `صياغة مطوّلة بلا داعٍ. الإجراء التصحيحي: استبدل "${m[0]}" بـ "${use}".`
                : `Unnecessary wording. Corrective action: replace "${m[0]}" with "${use}".`)
            : (ar
                ? `عبارة حشو لا تضيف معنى. الإجراء التصحيحي: احذف "${m[0]}".`
                : `Filler phrase that adds no meaning. Corrective action: delete "${m[0]}".`),
        });
      }
    }
    // A word accidentally typed twice in a row ("the the", "shall shall").
    for (const m of p.matchAll(/\b([A-Za-z؀-ۿ]+)\s+\1\b/gi)) {
      findings.push({
        kind: "wordy",
        excerpt: m[0],
        templateExcerpt: "",
        para: paraIdx, start: m.index, end: m.index + m[0].length,
        comment: ar
          ? `كلمة مكررة: "${m[0]}". الإجراء التصحيحي: احذف التكرار.`
          : `Duplicated word: "${m[0]}". Corrective action: remove the extra word.`,
      });
    }
  });
  return findings;
}

/* ---------------- summary ---------------- */

function localSummary(findings: Finding[], lang: Lang): string {
  const ar = lang === "ar";
  if (findings.length === 0) {
    return ar ? "المستند مطابق للقالب ولا توجد ملاحظات لغوية. لا إجراءات مطلوبة." : "The document matches the template and reads cleanly. No corrective actions required.";
  }
  const n = (k: FindingKind) => findings.filter((f) => f.kind === k).length;
  return ar
    ? `وُجدت ${findings.length} ملاحظة: ${n("missing")} بنود ناقصة، ${n("changed")} فقرات تخالف القالب، ${n("added")} بنود غير ضرورية خارج القالب، ${n("spelling")} أخطاء إملائية، ${n("wordy")} صياغات مطوّلة. الإجراءات التصحيحية مكتوبة في تعليقات المراجعة داخل المستند.`
    : `${findings.length} finding${findings.length === 1 ? "" : "s"}: ${n("missing")} missing template items, ${n("changed")} passages differing from the template, ${n("added")} unnecessary clauses beyond the template, ${n("spelling")} spelling mistakes, ${n("wordy")} wordy phrasings. Each corrective action is written as a review comment inside the document.`;
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
      input: review.findings.map((f) => `${f.kind}: ${f.comment}`).join("\n"),
    });
    return response.output_text.trim() || review.summary;
  } catch (err) {
    log.warn(`summary polish failed: ${err instanceof Error ? err.message : err}`);
    return review.summary;
  }
}

export async function reviewDocument(templateText: string, docText: string, docName: string, lang: Lang): Promise<DocReview> {
  const tplParas = splitParagraphs(templateText);
  const docParas = splitParagraphs(docText);
  const findings = [
    ...templateDiff(tplParas, docParas, lang),
    ...(await spellingPass(templateText, docParas, lang)),
    ...wordinessPass(docParas, lang),
  ];
  const review: DocReview = { summary: localSummary(findings, lang), findings };
  return { ...review, summary: await polishSummary(review, docName, lang) };
}

/* ---------------- the reviewed .docx with real Word comments ---------------- */

/** The reviewed copy: the document's own text, unchanged, with every
    finding attached as a native Word comment (visible in Word's review
    pane) anchored to the exact word or passage it concerns. */
export async function buildReviewedDocx(docName: string, docText: string, review: DocReview, lang: Lang): Promise<Buffer> {
  const ar = lang === "ar";
  const docParas = splitParagraphs(docText);
  // An empty document has nothing to anchor comments to.
  if (!docParas.length) {
    const empty = new Document({
      sections: [{ children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: ar ? `مراجعة: ${docName}` : `Review: ${docName}` })] }),
        new Paragraph({ children: [new TextRun({ text: review.summary, italics: true })] }),
      ] }],
    });
    return Packer.toBuffer(empty);
  }

  // Word-level anchors per paragraph, non-overlapping, sorted by position.
  // Paragraph-level findings wrap the whole paragraph.
  const wordLevel = new Map<number, Finding[]>();
  const paraLevel = new Map<number, Finding[]>();
  review.findings.forEach((f) => {
    const isWhole = f.start === 0 && f.end >= (docParas[f.para]?.length ?? 0);
    const bucket = isWhole || f.kind === "missing" ? paraLevel : wordLevel;
    if (!bucket.has(f.para)) bucket.set(f.para, []);
    bucket.get(f.para)!.push(f);
  });
  for (const list of wordLevel.values()) {
    list.sort((a, b) => a.start - b.start);
    // Drop ranges that overlap an earlier one; their comment still matters,
    // so demote them to paragraph level.
    let cursor = -1;
    for (let i = 0; i < list.length; i++) {
      if (list[i].start < cursor) {
        const f = list.splice(i, 1)[0];
        i--;
        if (!paraLevel.has(f.para)) paraLevel.set(f.para, []);
        paraLevel.get(f.para)!.push(f);
      } else {
        cursor = list[i].end;
      }
    }
  }

  // Every finding needs a unique comment id shared between the anchor in the
  // body and the entry in the comments part.
  const ids = new Map<Finding, number>();
  review.findings.forEach((f, i) => ids.set(f, i + 1));

  const children: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: ar ? `مراجعة: ${docName}` : `Review: ${docName}` })] }),
    new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: review.summary, italics: true })] }),
  ];

  docParas.forEach((text, paraIdx) => {
    const whole = paraLevel.get(paraIdx) ?? [];
    const inline = wordLevel.get(paraIdx) ?? [];
    const runs: (TextRun | CommentRangeStart | CommentRangeEnd)[] = [];

    for (const f of whole) runs.push(new CommentRangeStart(ids.get(f)!));

    let pos = 0;
    for (const f of inline) {
      if (f.start > pos) runs.push(new TextRun(text.slice(pos, f.start)));
      runs.push(new CommentRangeStart(ids.get(f)!));
      runs.push(new TextRun(text.slice(f.start, f.end)));
      runs.push(new CommentRangeEnd(ids.get(f)!));
      runs.push(new TextRun({ children: [new CommentReference(ids.get(f)!)] }));
      pos = f.end;
    }
    if (pos < text.length) runs.push(new TextRun(text.slice(pos)));

    for (const f of whole) {
      runs.push(new CommentRangeEnd(ids.get(f)!));
      runs.push(new TextRun({ children: [new CommentReference(ids.get(f)!)] }));
    }

    children.push(new Paragraph({ spacing: { after: 120 }, children: runs }));
  });

  const doc = new Document({
    comments: {
      children: review.findings.map((f) => ({
        id: ids.get(f)!,
        author: REVIEW_AUTHOR,
        initials: "RM",
        date: new Date(),
        children: [new Paragraph({ children: [new TextRun(f.comment)] })],
      })),
    },
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}
