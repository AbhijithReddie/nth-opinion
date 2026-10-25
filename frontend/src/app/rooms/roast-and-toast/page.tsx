import { ComingSoon, comingSoonMetadata } from "@/components/rooms/ComingSoon";

export const metadata = comingSoonMetadata("roast-and-toast");

export default function RoastAndToastPage() {
  return <ComingSoon roomId="roast-and-toast" />;
}
