import { NextResponse } from "next/server";
import { getOwnerId } from "@/lib/owner";
import { createFolder, listFolders } from "@/lib/manifest";

// GET /api/folders — every folder belonging to whoever's visiting.
export async function GET() {
  const ownerId = await getOwnerId();
  const folders = await listFolders(ownerId);
  return NextResponse.json({ folders });
}

// POST /api/folders — create a new (flat — no nesting) folder.
export async function POST(request: Request) {
  const ownerId = await getOwnerId();
  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = (body.name || "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const folder = await createFolder(ownerId, name);
  return NextResponse.json({ folder });
}
