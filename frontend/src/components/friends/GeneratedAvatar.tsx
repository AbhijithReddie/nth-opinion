import { lookFromAvatar, type AvatarParams } from "@/lib/customPersonas";
import { PersonaFace } from "../chat/Avatar";

/**
 * A custom persona's avatar, drawn from the builder's avatar parameters (face
 * shape, skin tone, hair, hair colour, accessory, expression) in the same
 * illustrated style as the built-in personas.
 */
export function GeneratedAvatar({ avatar, colour, className = "size-14", label }: { avatar: AvatarParams; colour: string; className?: string; label?: string }) {
  return <PersonaFace look={lookFromAvatar(avatar)} color={colour} label={label} className={`shrink-0 rounded-full ${className}`} />;
}
