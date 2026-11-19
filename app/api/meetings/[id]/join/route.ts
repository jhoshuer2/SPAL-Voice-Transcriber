import { NextResponse } from "next/server";
import { getOwnerId } from "@/lib/owner";
import { getMeeting } from "@/lib/calendar";
import { dispatchBotForMeeting } from "@/lib/dispatch-bot";

// POST /api/meetings/:id/join — "send Spool to this meeting now", for
// testing or for a meeting that's already started before the cron job
// would have caught it.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const ownerId = await getOwnerId();
  const meeting = await getMeeting(params.id);
  if (!meeting || meeting.ownerId !== ownerId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (meeting.recallBotId) {
    return NextResponse.json({ meeting }); // already dispatched — idempotent
  }

  if (!process.env.RECALL_API_KEY) {
    return NextResponse.json({ error: "Server is missing RECALL_API_KEY" }, { status: 500 });
  }

  const updated = await dispatchBotForMeeting(meeting);
  return NextResponse.json({ meeting: updated ?? meeting });
}
