import { fileExt, fileExtTone } from "@/lib/format";

/** A small square badge showing a file's format (MP3, M4A, WAV, MP4…). */
export function FormatBadge({
  filename,
  contentType,
  size = "md",
  className = "",
}: {
  filename: string;
  contentType?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const ext = fileExt(filename, contentType);
  const tone = fileExtTone(ext);
  return (
    <span className={`format-badge format-badge--${size} format-badge--${tone} ${className}`}>
      {ext}
    </span>
  );
}
