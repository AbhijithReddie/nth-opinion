/** Languages for voice input (the browser's speech recognition), and the default for each chat language. */

export const RECOGNITION_LANGUAGES = [
  { code: "en-IN", label: "English (India)" },
  { code: "hi-IN", label: "Hindi" },
  { code: "te-IN", label: "Telugu" },
  { code: "ta-IN", label: "Tamil" },
  { code: "kn-IN", label: "Kannada" },
  { code: "ml-IN", label: "Malayalam" },
  { code: "mr-IN", label: "Marathi" },
  { code: "bn-IN", label: "Bengali" },
] as const;

export type RecognitionLanguage = (typeof RECOGNITION_LANGUAGES)[number]["code"];

const BY_CHAT_LANGUAGE: Record<string, RecognitionLanguage> = {
  english: "en-IN",
  hinglish: "en-IN", // Roman-script Hinglish comes out best from Indian English recognition
  tenglish: "te-IN",
  tanglish: "ta-IN",
  kanglish: "kn-IN",
  manglish: "ml-IN",
  marathi_english: "mr-IN",
  benglish: "bn-IN",
};

/** The recognition language that suits a room's chat language. Native-script results are fine: the rooms understand them. */
export function recognitionLanguageFor(chatLanguage: string): RecognitionLanguage {
  return BY_CHAT_LANGUAGE[chatLanguage] ?? "en-IN";
}
