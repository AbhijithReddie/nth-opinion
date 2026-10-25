"use client";

import { createContext, useContext } from "react";
import { personaById, type RoomChatConfig } from "@/config/roomChats";
import type { Persona } from "@/config/personas";
import type { RoomSetup } from "@/lib/chatTypes";

interface RoomContextValue {
  config: RoomChatConfig;
  setup: RoomSetup;
}

const RoomContext = createContext<RoomContextValue | null>(null);

/** Gives every chat component the room's config and the user's setup, without passing them through each level. */
export const RoomProvider = RoomContext.Provider;

export function useRoom() {
  const value = useContext(RoomContext);
  if (!value) throw new Error("useRoom must be used inside <RoomProvider>");
  const { config, setup } = value;

  return {
    config,
    setup,
    /** A persona of this room, or undefined for "user" / unknown ids. */
    persona: (id: string): Persona | undefined => personaById(config, id),
    /** "You", the user's chosen name for a persona, or the persona's own name. */
    nameOf: (sender: string): string => {
      if (sender === "user") return "You";
      return setup.participants.find((p) => p.id === sender)?.name ?? personaById(config, sender)?.name ?? "Someone";
    },
  };
}
