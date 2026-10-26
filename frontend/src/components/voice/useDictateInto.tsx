"use client";

import { useRef, useState } from "react";
import { useDictation } from "@/hooks/useDictation";
import { useRecognitionLanguage, useSpeechInputSupported } from "@/hooks/useVoice";
import { MicButton, VoiceInputOptions } from "./MicButton";

/**
 * Voice input for a topic or setup box: speech is added after what's already typed, and
 * never submitted by itself. Returns the mic button and its options row, for the box to place.
 * (The chat composer has its own version with hands-free sending.)
 */
export function useDictateInto({ value, onChange, language, max }: { value: string; onChange: (text: string) => void; language: string; max: number }) {
  const supported = useSpeechInputSupported();
  const [lang, setLang] = useRecognitionLanguage(language);
  const [used, setUsed] = useState(false);
  const before = useRef("");
  const dictation = useDictation(lang, (spoken) => onChange(`${before.current}${before.current && spoken ? " " : ""}${spoken}`.slice(0, max)));

  if (!supported) return { button: null, options: null };
  return {
    button: (
      <MicButton
        listening={dictation.listening}
        level={dictation.level}
        className="size-9"
        onClick={() => {
          if (!dictation.listening) before.current = value.trim();
          setUsed(true);
          dictation.toggle();
        }}
      />
    ),
    options:
      used || dictation.error ? (
        <VoiceInputOptions
          lang={lang}
          onLang={(l) => {
            dictation.stop();
            setLang(l);
          }}
          listening={dictation.listening}
          error={dictation.error}
          onClearError={dictation.clearError}
          showHandsFree={false}
        />
      ) : null,
  };
}
