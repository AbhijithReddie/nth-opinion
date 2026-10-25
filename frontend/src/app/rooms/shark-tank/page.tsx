import { ComingSoon, comingSoonMetadata } from "@/components/rooms/ComingSoon";

export const metadata = comingSoonMetadata("shark-tank");

export default function SharkTankPage() {
  return <ComingSoon roomId="shark-tank" />;
}
