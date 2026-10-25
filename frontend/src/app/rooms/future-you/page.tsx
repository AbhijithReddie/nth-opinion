import { ComingSoon, comingSoonMetadata } from "@/components/rooms/ComingSoon";

export const metadata = comingSoonMetadata("future-you");

export default function FutureYouPage() {
  return <ComingSoon roomId="future-you" />;
}
