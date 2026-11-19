import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing ASSEMBLYAI_API_KEY" },
      { status: 500 },
    );
  }

  const res = await fetch(
    `https://api.assemblyai.com/v2/transcript/${params.id}`,
    { headers: { authorization: apiKey } },
  );
  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { error: data.error || "Failed to fetch transcript" },
      { status: res.status },
    );
  }

  return NextResponse.json(data);
}
