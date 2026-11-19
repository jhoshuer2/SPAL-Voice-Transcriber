import { NextResponse } from "next/server";
import { getOwnerId } from "@/lib/owner";
import { removeFolder, renameFolder } from "@/lib/manifest";

// PATCH /api/folders/[id] — rename a folder.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ownerId = await getOwnerId();
  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = (body.name || "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const folder = await renameFolder(params.id, ownerId, name);
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ folder });
}

// DELETE /api/folders/[id] — remove the folder itself. The files inside
// it are kept and fall back to the root library, not deleted.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const ownerId = await getOwnerId();
  const folder = await removeFolder(params.id, ownerId);
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
