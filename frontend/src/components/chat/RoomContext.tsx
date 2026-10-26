"use client";

import { createContext, useContext } from "react";
import { isGuest, resolvePersona, type RoomChatConfig } from "@/config/roomChats";
import type { Persona } from "@/config/personas";
import type { RoomSetup } from "@/lib/chatTypes";

interface RoomContextValue {
  config: RoomChatConfig;
  setup: RoomSetup;
  /** This is a demo replay (share cards say so). */
  demo?: boolean;
  /** What the user typed in the chat, kept off share cards unless they include it. */
  userTexts?: string[];
}

const RoomContext = createContext<RoomContextValue | null>(null);

/** Gives every chat component the room's config and the user's setup, without passing them through each level. */
export const RoomProvider = RoomContext.Provider;

export function useRoom() {
  const value = useContext(RoomContext);
  if (!value) throw new Error("useRoom must be used inside <RoomProvider>");
  const { config, setup, demo = false, userTexts = [] } = value;

  return {
    config,
    setup,
    demo,
    userTexts,
    /** A persona in this room (its own, a guest, or one of the user's own), or undefined for "user" / unknown ids. */
    persona: (id: string): Persona | undefined => resolvePersona(config, setup, id),
    /** True for a cross-room guest. */
    isGuest: (id: string) => isGuest(setup, id),
    /** "You", the user's chosen name for a persona, or the persona's own name. */
    nameOf: (sender: string): string => {
      if (sender === "user") return "You";
      const chosen = [...setup.participants, ...(setup.guests ?? [])].find((p) => p.id === sender)?.name;
      return chosen ?? resolvePersona(config, setup, sender)?.name ?? "Someone";
    },
  };
}
