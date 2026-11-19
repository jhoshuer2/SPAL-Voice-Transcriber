# Spool — audio → transcript

Drop in audio files of any length — one at a time or a whole batch — and
keep them in a library until you're ready to transcribe. Each file gets
its own share-link page with a transcript to read, download as `.txt`,
or share. Built to deploy on Vercel.

## How it works

- **Upload:** the browser uploads each file directly to Vercel Blob
  storage (not through a serverless function), so there's no server-side
  size limit — multi-hour recordings, and any number of files at once,
  are fine. Dropping a file does **not** auto-start transcription — it
  just lands in the library as "in storage" until you hit **Transcribe**.
- **Transcription:** AssemblyAI transcribes on their own infrastructure,
  asynchronously, once you kick it off — so it isn't bound by Vercel's
  function execution-time limit either, no matter how long the audio is.
  Progress is shown as an indeterminate "recording" indicator plus an
  elapsed-time counter rather than a percentage, since AssemblyAI's API
  only reports `queued` / `processing` / `completed`, not how far along a
  job is.
- **Storage, not a database:** there's still no real datastore. The
  dashboard's file list, sizes, and statuses live in one small JSON file
  (`_manifest/jobs.json`) inside the same Blob store, read-modified-written
  on every change (see `lib/manifest.ts`). That's a genuine tradeoff —
  concurrent writes can race and the last one wins — but it's fine for a
  personal/low-traffic tool and avoids standing up Postgres/KV. Swap the
  internals of `lib/manifest.ts` for a real datastore later if this gets
  heavier concurrent use; nothing else needs to change. The manifest file
  itself is written with `cacheControlMaxAge: 0` and read with a
  cache-busted URL — without that, Blob's CDN caching the same URL for up
  to a year means a read right after a write can come back stale (this
  previously caused jobs to silently vanish from the library).
- **Sign-in is optional, never a gate.** The dashboard works immediately
  for anyone — upload, transcribe, download — no login screen in the way.
  Behind the scenes every visitor still gets a private library: before
  signing in, an anonymous cookie id scopes their jobs (`lib/owner.ts`);
  after signing in with Google via [Auth.js](https://authjs.dev) (`auth.ts`),
  their email does instead, and `lib/manifest.ts#migrateOwner` folds any
  existing anonymous history into the new account so nothing's lost. The
  nudge to sign in is a dismissible toast (`components/SignInPrompt.tsx`),
  shown once after a quiet moment on the dashboard and again right after
  downloading a transcript — never a hard requirement. "Sign in" in the
  header is the always-available opt-in.

## Deploy it

1. **Push this folder to a GitHub repo**, then go to
   [vercel.com/new](https://vercel.com/new) and import it. (Or skip GitHub
   and run `npx vercel` from inside this folder if you have the Vercel CLI.)

2. **Add Blob storage** to the Vercel project: Project → Storage → Create
   Database → **Blob**. This automatically sets the `BLOB_READ_WRITE_TOKEN`
   environment variable for you — nothing else to do.

3. **Get an AssemblyAI API key**: sign up free at
   [assemblyai.com](https://www.assemblyai.com/dashboard/signup), copy your
   API key from the dashboard.

4. **Add the env var** in Vercel: Project → Settings → Environment
   Variables → add `ASSEMBLYAI_API_KEY` with that key, for all
   environments.

5. **Set up Google sign-in:**
   - In [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
     create (or reuse) a project, then **Create Credentials → OAuth client
     ID → Web application**.
   - Authorized redirect URI: `https://<your-domain>/api/auth/callback/google`
     (add both the production domain and any preview domain you use).
   - Copy the **Client ID** and **Client secret**.
   - In Vercel: Project → Settings → Environment Variables, add
     `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `AUTH_SECRET` (generate
     the latter with `openssl rand -base64 33`), for all environments.

6. **Redeploy** (Vercel will prompt you to redeploy after adding env vars,
   or just push again).

That's it — open the deployed URL, sign in with Google, drop in a file (or
several), hit **Transcribe** on whichever ones you want processed, and
open each from the library once it's done. Each Google account gets its
own private library.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in ASSEMBLYAI_API_KEY, GOOGLE_CLIENT_ID/SECRET, AUTH_SECRET
vercel env pull .env.local   # if you want BLOB_READ_WRITE_TOKEN too (needs `vercel link` first)
npm run dev
```

For local Google sign-in, add `http://localhost:3000/api/auth/callback/google`
as an extra authorized redirect URI on the same OAuth client.

Note: Blob client uploads need a real token, so local dev without
`vercel env pull` will fail at the upload step unless you set
`BLOB_READ_WRITE_TOKEN` yourself (Storage tab → your Blob store → `.env.local` tab, copy from there).

## What's deliberately left for later

- **Transcript share-link pages (`/t/:id`) aren't access-controlled** —
  every job is owned by a cookie id or an email, but anyone holding that
  specific link can still open it (ownership gates the dashboard listing
  and mutations, not the share link itself). Good enough for "share with
  a specific person"; add an explicit visibility flag on `Job` if that's
  ever a problem.
- **Anonymous history lives in a cookie** — clear browser data (or open
  the library in another browser) and that history is gone unless you'd
  signed in first. That's the whole point of the sign-in nudge, not a bug.
- **One Google account per browser session** — there's no invite system
  or shared-library concept; every signed-in Google account gets a
  separate, private set of jobs in the same underlying manifest file.
- **Manifest isn't transaction-safe** — see the "storage, not a database"
  note above. Fine at personal scale; a real race is unlikely but possible
  if two uploads/updates land in the same instant.
- **Deleting a file mid-transcription** removes it from the library and
  deletes the audio blob, but doesn't cancel the AssemblyAI job already in
  flight — harmless, just a wasted transcription on their side.
- **Polling, not webhooks** — fine for MVP; a webhook
  (`webhook_url` param on the AssemblyAI request) would be a cleaner way
  to get notified the moment a long transcription finishes instead of
  polling every few seconds.
- **No real "% complete"** — by design (see above); AssemblyAI doesn't
  expose one.
