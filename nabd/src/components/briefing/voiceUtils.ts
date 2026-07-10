/* Voice classification for the Web Speech picker: prefer natural-sounding
   voices and group them by gender. */

/* ---- voice classification: prefer natural-sounding voices, group by gender ---- */
const FEMALE_MARKERS = ["female", "woman", "zira", "susan", "samantha", "victoria", "karen", "moira", "tessa",
  "fiona", "veena", "salma", "laila", "hoda", "amira", "sara", "hala", "zariyah", "aria", "jenny", "michelle",
  "emma", "ava", "sonia", "natasha", "salli", "joanna", "kendra", "kimberly", "ivy", "amy", "nicole", "raveena",
  "zeina", "layla", "mona", "catherine", "libby", "clara", "olivia"];
const MALE_MARKERS = ["male", " man", "david", "mark", "daniel", "alex", "fred", "thomas", "naayf", "maged",
  "hamed", "guy", "brandon", "christopher", "eric", "andrew", "ryan", "matthew", "joey", "justin", "kevin",
  "tarik", "hasan", "william", "james", "george", "liam"];
const NATURAL_MARKERS = ["natural", "neural", "premium", "enhanced", "online", "google"];

export function voiceGender(v: SpeechSynthesisVoice): "female" | "male" | "other" {
  const n = v.name.toLowerCase();
  if (FEMALE_MARKERS.some((m) => n.includes(m))) return "female";
  if (MALE_MARKERS.some((m) => n.includes(m))) return "male";
  return "other";
}

export const naturalScore = (v: SpeechSynthesisVoice): number =>
  NATURAL_MARKERS.some((m) => v.name.toLowerCase().includes(m)) ? 0 : 1;
