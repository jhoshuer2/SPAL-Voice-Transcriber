import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Audio → Transcript",
  description: "Upload audio of any length and get a transcript to download or share.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
