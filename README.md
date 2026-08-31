# ConnectUpPro

ConnectUpPro is a self-hosted Next.js app for analyzing YouTube comments. It
downloads comments, creates Gemini embeddings, groups comments into semantic
clusters, and provides an interactive analysis dashboard.

The open-source edition is deliberately single-workspace: there is no login,
hosted authentication, billing, or external account service. Everyone who can
reach an installation shares its local workspace, so run it on a private
machine or trusted network.

<div align="center">
  <img src="./public/dashboard-main.webp" alt="ConnectUpPro comment analysis dashboard" width="49%" />
  <img src="./public/features.webp" alt="ConnectUpPro semantic search and topic analysis features" width="49%" />
</div>

## Requirements

- Node.js 20 or newer
- PostgreSQL 15 or newer with the `vector` and `uuid-ossp` extensions
- A Google API key with YouTube Data API v3 and Gemini API access

The easiest database setup is Docker:

```bash
docker compose up -d db
```

If you use an existing PostgreSQL server, enable the extensions as a database
administrator:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
```

## Quick start

```bash
npm install
cp .env.example .env.local
npm run db:generate
npm run db:push
npm run dev
```

Then open <http://localhost:3000>. The only required environment variables are:

```env
DATABASE_URL="postgresql://connectuppro:connectuppro@localhost:5432/connectuppro?schema=public"
GOOGLE_API_KEY="your_google_api_key"
```

Create a Google API key in the [Google Cloud Console](https://console.cloud.google.com/),
enable YouTube Data API v3, and make sure the key can call the Gemini API used
by your Google project. YouTube API quota and Gemini usage are governed by
Google's limits for that key.

## Useful commands

```bash
npm run dev          # Check configuration and start Next.js
npm run build        # Check configuration, generate Prisma, and build
npm run start        # Start a production build
npm run db:generate  # Regenerate the Prisma client
npm run db:push      # Apply the Prisma schema to PostgreSQL
npm run test:youtube # Verify the YouTube key and comment access
```

## How it works

1. A YouTube URL is submitted from the dashboard.
2. Video metadata and comments are fetched with `GOOGLE_API_KEY`.
3. A background queue stores comments and generates Gemini embeddings.
4. PostgreSQL/pgvector stores the data and embeddings.
5. Gemini names semantic clusters; local keyword fallbacks keep processing
   useful when a naming request fails.

The relational schema still has a `User` owner because projects, videos, and
semantic searches were designed around ownership. On first request,
`src/lib/local-user.server.ts` creates one local owner automatically. If a
database from the former hosted version already has a user, the first existing
user is reused so its data remains visible.

## API and YouTube channels

The main workflow analyzes individual public YouTube video URLs. Public channel
video lookup is available when a channel ID is supplied directly. Listing the
signed-in user's channels requires Google OAuth permissions, which are
intentionally not part of this API-key-only edition.

## Configuration notes

- `LOCAL_USER_NAME` and `LOCAL_USER_EMAIL` are optional display metadata.
- Do not commit `.env.local` or any API keys.
- The app has no built-in authentication. Do not expose it to the public
  internet without putting it behind your own network access control.
- PostgreSQL must provide pgvector because semantic search uses vector values.

## License

All original ConnectUpPro source code, documentation, configuration, scripts,
and included visual assets are released under the [MIT License](./LICENSE).
You are free to use, copy, modify, publish, distribute, sublicense, and sell
them, subject to the license terms. Third-party dependencies and external
content or services retain their own licenses and terms.
