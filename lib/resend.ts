import type { Job } from "./types";
import { fetchTranscript } from "./assemblyai";
import { appUrl } from "./url";

// Thin wrapper around Resend's REST API — no SDK needed for one call.
// RESEND_API_KEY must be set; RESEND_FROM optionally overrides the
// sender once a custom domain is verified (defaults to Resend's
// shared test domain, which works immediately with no DNS setup).
const FROM = process.env.RESEND_FROM || "Spool <onboarding@resend.dev>";

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/** Email a finished meeting transcript to whoever asked to be notified. */
export async function sendTranscriptEmail(job: Job) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[resend] RESEND_API_KEY not set — skipping transcript email");
    return;
  }
  if (!job.notifyEmail) return;

  let preview = "";
  const aaiKey = process.env.ASSEMBLYAI_API_KEY;
  if (job.assemblyaiId && aaiKey) {
    const { ok, data } = await fetchTranscript(job.assemblyaiId, aaiKey);
    if (ok) preview = (data.text || "").slice(0, 600);
  }

  const link = `${appUrl()}/t/${job.id}`;
  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; color: #121214; max-width: 560px;">
      <p style="font-size: 15px;">Your meeting transcript is ready — <strong>${escapeHtml(job.filename)}</strong>.</p>
      ${
        preview
          ? `<p style="font-size: 13.5px; color: #55555f; border-left: 3px solid #e4e4ea; padding-left: 12px;">${escapeHtml(preview)}${preview.length >= 600 ? "…" : ""}</p>`
          : ""
      }
      <p style="margin-top: 20px;">
        <a href="${link}" style="background:#4b4ff0; color:#fff; padding:10px 18px; border-radius:6px; text-decoration:none; font-weight:600; font-size:13.5px;">
          View &amp; download transcript
        </a>
      </p>
      <p style="font-size: 12px; color: #9a9aa5; margin-top: 24px;">Sent by Spool.</p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: job.notifyEmail,
      subject: `Transcript ready: ${job.filename}`,
      html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend send failed (${res.status}): ${body}`);
  }
}
