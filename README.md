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
  heavier concurrent use; nothing else needs to change.

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

5. **Redeploy** (Vercel will prompt you to redeploy after adding the env
   var, or just push again).

That's it — open the deployed URL, drop in a file (or several), hit
**Transcribe** on whichever ones you want processed, and open each from
the library once it's done.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in ASSEMBLYAI_API_KEY
vercel env pull .env.local   # if you want BLOB_READ_WRITE_TOKEN too (needs `vercel link` first)
npm run dev
```

Note: Blob client uploads need a real token, so local dev without
`vercel env pull` will fail at the upload step unless you set
`BLOB_READ_WRITE_TOKEN` yourself (Storage tab → your Blob store → `.env.local` tab, copy from there).

## What's deliberately left for later

- **No auth / no privacy controls** — anyone with a transcript's URL can
  view it. IDs aren't guessable, but they aren't access-controlled either.
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
