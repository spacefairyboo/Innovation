/* Voice classification for the Web Speech picker: find every voice the
   browser has for a language (Arabic tags vary a lot across platforms),
   prefer natural-sounding ones, group by gender, and label Arabic voices
   with their dialect so regional variety is visible in the picker. */

/* ---- language matching ----
   Platforms tag Arabic voices inconsistently: "ar-SA", "ar_EG", bare "ar",
   or a correct name ("Google العربية") on a sloppy tag. Match the tag
   first, then fall back to the name — Arabic script or the word "arabic". */
export function matchesLang(v: SpeechSynthesisVoice, lang: "en" | "ar"): boolean {
  const tag = (v.lang ?? "").toLowerCase().replace(/_/g, "-");
  if (tag === lang || tag.startsWith(`${lang}-`)) return true;
  if (lang === "ar") return /[؀-ۿ]/.test(v.name) || v.name.toLowerCase().includes("arab");
  return false;
}

/* ---- dialect labels for Arabic voices, keyed by region code ---- */
const AR_REGIONS: Record<string, { en: string; ar: string }> = {
  sa: { en: "Saudi", ar: "السعودية" },
  eg: { en: "Egypt", ar: "مصر" },
  ae: { en: "UAE", ar: "الإمارات" },
  jo: { en: "Jordan", ar: "الأردن" },
  sy: { en: "Syria", ar: "سوريا" },
  lb: { en: "Lebanon", ar: "لبنان" },
  iq: { en: "Iraq", ar: "العراق" },
  kw: { en: "Kuwait", ar: "الكويت" },
  qa: { en: "Qatar", ar: "قطر" },
  bh: { en: "Bahrain", ar: "البحرين" },
  om: { en: "Oman", ar: "عُمان" },
  ye: { en: "Yemen", ar: "اليمن" },
  ma: { en: "Morocco", ar: "المغرب" },
  dz: { en: "Algeria", ar: "الجزائر" },
  tn: { en: "Tunisia", ar: "تونس" },
  ly: { en: "Libya", ar: "ليبيا" },
};

/** Short display name: vendor prefixes and parenthetical tags stripped,
    plus the dialect for Arabic voices ("Zariyah · Saudi"). */
export function voiceLabel(v: SpeechSynthesisVoice, uiLang: "en" | "ar"): string {
  const name = v.name
    .replace(/^Microsoft |^Google |\(.*?\)/g, "")
    .replace(/\s+-\s+[^-]*$/, "") // trailing language descriptor: "Zariyah - Arabic"
    .replace(/\s+/g, " ")
    .trim();
  const tag = (v.lang ?? "").toLowerCase().replace(/_/g, "-");
  const region = tag.startsWith("ar-") ? AR_REGIONS[tag.slice(3)] : undefined;
  return region ? `${name} · ${region[uiLang]}` : name;
}

/* ---- gender grouping (checked against the lowercased voice name) ----
   The Arabic names cover the Windows/Edge neural set across every Arabic
   locale, plus the macOS and Google voices. */
const FEMALE_MARKERS = ["female", "woman", "zira", "susan", "samantha", "victoria", "karen", "moira", "tessa",
  "fiona", "veena", "salma", "laila", "hoda", "amira", "sara", "hala", "zariyah", "aria", "jenny", "michelle",
  "emma", "ava", "sonia", "natasha", "salli", "joanna", "kendra", "kimberly", "ivy", "amy", "nicole", "raveena",
  "zeina", "layla", "mona", "catherine", "libby", "clara", "olivia",
  // Arabic regional voices (Windows/Edge neural set)
  "rana", "amany", "amal", "noura", "fatima", "aysha", "iman", "mouna", "reem", "maryam", "amina", "layan", "sana"];
const MALE_MARKERS = ["male", " man", "david", "mark", "daniel", "alex", "fred", "thomas", "naayf", "maged",
  "hamed", "guy", "brandon", "christopher", "eric", "andrew", "ryan", "matthew", "joey", "justin", "kevin",
  "tarik", "hasan", "william", "james", "george", "liam",
  // Arabic regional voices (Windows/Edge neural set, plus macOS Majed)
  "shakir", "hamdan", "bassel", "taim", "fahed", "rami", "jamal", "moaz", "laith", "hedi", "saleh", "ismael",
  "majed", "abdullah", "omar"];
const NATURAL_MARKERS = ["natural", "neural", "premium", "enhanced", "online", "google"];

export function voiceGender(v: SpeechSynthesisVoice): "female" | "male" | "other" {
  const n = v.name.toLowerCase();
  if (FEMALE_MARKERS.some((m) => n.includes(m))) return "female";
  if (MALE_MARKERS.some((m) => n.includes(m))) return "male";
  return "other";
}

export const naturalScore = (v: SpeechSynthesisVoice): number =>
  NATURAL_MARKERS.some((m) => v.name.toLowerCase().includes(m)) ? 0 : 1;
