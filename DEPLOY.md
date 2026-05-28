## Vercel + Supabase Setup

This app is now prepared for:

- `Vercel` for hosting
- `Supabase Postgres` for posts metadata
- `Supabase Storage` for uploaded images

### 1. Create Supabase Project

Create a new project in Supabase and wait for it to finish provisioning.

### 2. Create Database Table

Open the Supabase SQL editor and run the SQL from:

- [supabase/schema.sql](/home/ashking/Projects/hall/supabase/schema.sql:1)

That creates the `posts` table.

### 3. Create Storage Bucket

In Supabase Storage:

1. Create a bucket named `hall-images`
2. Mark it as `Public`

If you want another bucket name, set `SUPABASE_BUCKET` to match.

### 4. Get Required Supabase Values

From Supabase project settings, copy:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Use the service role key only in server-side environment variables. Never expose it in client code.

### 5. Set Vercel Environment Variables

In Vercel Project Settings, add:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_BUCKET=hall-images
ADMIN_TOKEN=replace-with-a-long-random-secret
```

Optional:

```bash
API_RATE_LIMIT_MAX=120
API_RATE_LIMIT_WINDOW_MS=60000
UPLOAD_RATE_LIMIT_MAX=5
UPLOAD_RATE_LIMIT_WINDOW_MS=3600000
DELETE_RATE_LIMIT_MAX=20
DELETE_RATE_LIMIT_WINDOW_MS=3600000
```

### 6. Deploy to Vercel

1. Push the repo to GitHub
2. Import the repo into Vercel
3. Confirm the env vars are present
4. Deploy

### 7. Local Development

Create a local `.env` from `.env.example`, then run:

```bash
npm install
npm start
```

### 8. How Admin Delete Works

The frontend has an admin token field.

- Start the server with `ADMIN_TOKEN`
- Enter the same token in the UI
- Delete buttons become usable

### 9. Important Limits

Current rate limiting is in-memory.

That means:

- fine for basic testing and light friend-only use
- not strong protection on Vercel across multiple instances

If you later need stronger protection, move rate limiting to Redis/Upstash.

### 10. Recommended Supabase Policies

Because uploads happen through the backend using the service role key, you can keep this simple:

- bucket is public for reads
- uploads/deletes happen only through your API

You do not need to expose direct client-side upload credentials.
