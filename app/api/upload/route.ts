import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

// This route only brokers a signed upload token — the actual file bytes
// go straight from the browser to Blob storage, never through this
// function. That's what lets uploads of any size/length work on Vercel.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: [
            "audio/*",
            "video/mp4",
            "video/quicktime",
            "video/webm",
          ],
          addRandomSuffix: true,
          // 5 GB ceiling — effectively "any length" for audio.
          maximumSizeInBytes: 5 * 1024 * 1024 * 1024,
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log("upload completed:", blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
