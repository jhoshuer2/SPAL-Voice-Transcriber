# Audio → Transcript

Upload an audio file of any length, get a transcript back, download it as
`.txt`, or share it via a link. Built to deploy on Vercel.

## How it works

- **Upload:** the browser uploads the file directly to Vercel Blob storage
  (not through a serverless function), so there's no server-side size limit
  — multi-hour recordings are fine.
- **Transcription:** once uploaded, the app calls AssemblyAI's API with the
  file's URL. AssemblyAI transcribes it on their own infrastructure,
  asynchronously — so this isn't bound by Vercel's function execution-time
  limits either, no matter how long the audio is.
- **No database:** AssemblyAI's own transcript ID *is* the share-link ID
  (`/t/<id>`). The transcript page polls AssemblyAI directly for status and
  renders the result once it's done. Simplest thing that works — swap in a
  real datastore later if you want nicer/shorter links, auth, or a history
  of past transcripts.

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

That's it — open the deployed URL, upload a file, and it'll redirect you to
`/t/<id>` where the transcript appears once it's ready.

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

## What's deliberately left for later ("refine the UI" / "refine the rest")

- **No auth / no privacy controls** — anyone with a transcript's URL can
  view it. IDs aren't guessable, but they aren't access-controlled either.
- **No persistence of "my uploads"** — there's no list of past
  transcripts; each one only lives at its own `/t/<id>` link (AssemblyAI
  retains transcripts; check their retention policy for your plan).
- **No file-type/duration validation in the UI**, no drag-and-drop, no
  nicer progress UI, no error-state polish.
- **Polling, not webhooks** — fine for MVP; a webhook
  (`webhook_url` param on the AssemblyAI request) would be a cleaner way
  to get notified the moment a long transcription finishes instead of
  polling every few seconds.
