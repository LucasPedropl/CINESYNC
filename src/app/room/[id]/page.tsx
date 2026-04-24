import { RoomComponent } from "@/src/features/room/components/RoomComponent";

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return <RoomComponent roomId={resolvedParams.id} />;
}
