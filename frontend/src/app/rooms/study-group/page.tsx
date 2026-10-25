import { ComingSoon, comingSoonMetadata } from "@/components/rooms/ComingSoon";

export const metadata = comingSoonMetadata("study-group");

export default function StudyGroupPage() {
  return <ComingSoon roomId="study-group" />;
}
