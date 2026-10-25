import { ComingSoon, comingSoonMetadata } from "@/components/rooms/ComingSoon";

export const metadata = comingSoonMetadata("interview-panel");

export default function InterviewPanelPage() {
  return <ComingSoon roomId="interview-panel" />;
}
