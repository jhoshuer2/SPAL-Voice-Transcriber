import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Tiny endpoint for client components that aren't server-rendered with
// a session already in hand (the transcript page) — just enough to
// decide whether to show the "sign in to keep this" nudge.
export async function GET() {
  const session = await auth();
  return NextResponse.json({ signedIn: Boolean(session?.user) });
}
