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
  "majed", "abdullah", "omar", " ali", "sami", "karim", "wassim"];

export function voiceGender(v: SpeechSynthesisVoice): "female" | "male" | "other" {
  const n = v.name.toLowerCase();
  if (FEMALE_MARKERS.some((m) => n.includes(m))) return "female";
  if (MALE_MARKERS.some((m) => n.includes(m))) return "male";
  return "other";
}

/* ---- naturalness ranking: higher is more human ----
   Neural / enhanced / cloud-served voices first, the old robotic desktop
   sets last. Used to keep only the best few voices in the pickers. */
function naturalRank(v: SpeechSynthesisVoice): number {
  const n = v.name.toLowerCase();
  let s = 0;
  if (/natural|neural/.test(n)) s += 8;
  if (/premium|enhanced/.test(n)) s += 6;
  if (/google/.test(n)) s += 5;
  if (/online/.test(n)) s += 3;
  if (!v.localService) s += 2;
  if (/compact|espeak|eloquence|whisper|novelty|bells|zarvox|trinoids/.test(n)) s -= 8;
  return s;
}

/** The short list the pickers show: the most natural voices for the
    language, at most `perGender` women and `perGender` men. When the
    gender lists cannot fill the slots (common for Arabic sets with
    unrecognized names), the best remaining voices top the list up, so
    every natural Arabic voice the platform has can still surface. */
export function pickTopVoices(all: SpeechSynthesisVoice[], lang: "en" | "ar", perGender = 4): SpeechSynthesisVoice[] {
  const seen = new Set<string>();
  const cands = all
    .filter((v) => matchesLang(v, lang) && !seen.has(v.voiceURI) && seen.add(v.voiceURI))
    .sort((a, b) => naturalRank(b) - naturalRank(a) || a.name.localeCompare(b.name));
  const female = cands.filter((v) => voiceGender(v) === "female").slice(0, perGender);
  const male = cands.filter((v) => voiceGender(v) === "male").slice(0, perGender);
  const picked = new Set([...female, ...male].map((v) => v.voiceURI));
  const spare = perGender * 2 - picked.size;
  const extra = spare > 0 ? cands.filter((v) => !picked.has(v.voiceURI)).slice(0, spare) : [];
  return [...female, ...male, ...extra];
}
