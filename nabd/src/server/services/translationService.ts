/* AI translation for user-typed task text. Echo stores every title and
   note in both languages; when someone writes in one language the other
   side is machine-translated, so Arabic and English readers each see the
   task in their own language. The typed original is always kept verbatim,
   and editing re-translates from whatever the editor wrote. Without an
   API key the text is simply mirrored, exactly as before. */

import OpenAI from "openai";
import { config } from "../config";
import { logAICall, logger } from "../logger";
import type { Localized } from "@/lib/types";

const log = logger("translate");

/* Short texts, short patience: a save should never hang on a translation. */
const client = config.openai.enabled
  ? new OpenAI({ apiKey: config.openai.apiKey, timeout: 12_000, maxRetries: 0 })
  : null;

export const hasArabic = (s: string): boolean => /[؀-ۿ]/.test(s);

/** Both language versions of one typed text: the language the user wrote
    stays verbatim, the other is translated (or mirrored when AI is off). */
export async function localizeText(text: string): Promise<Localized> {
  const trimmed = text.trim();
  const fallback: Localized = { en: text, ar: text };
  if (!client || !trimmed) return fallback;
  const src = hasArabic(trimmed) ? "ar" : "en";
  try {
    const res = await logAICall("translate", `${src}→${src === "ar" ? "en" : "ar"}, ${trimmed.length} chars`, () => client.responses.create({
      model: config.openai.model,
      max_output_tokens: 1000,
      instructions: [
        "You are a precise bilingual translator for a task-management platform.",
        src === "ar"
          ? "The user text is Arabic. Translate it to natural professional English."
          : "The user text is English. Translate it to natural professional Modern Standard Arabic.",
        "Keep product names, code identifiers, numbers, and dates unchanged.",
        "Respond with ONLY the translation - no quotes, no commentary.",
      ].join("\n"),
      input: trimmed,
    }));
    const out = res.output_text.trim();
    if (!out) return fallback;
    return src === "ar" ? { en: out, ar: text } : { en: text, ar: out };
  } catch (err) {
    log.warn(`translation failed: ${err instanceof Error ? err.message : err}`);
    return fallback;
  }
}

/** Localize only when the text actually changed: an unchanged title keeps
    its existing translation instead of being re-translated on every save. */
export async function localizeChanged(text: string, existing: Localized): Promise<Localized | null> {
  if (text === existing.en || text === existing.ar) return null;
  return localizeText(text);
}
