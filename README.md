# ConnectUpPro

> Turn a YouTube comment section into a clear map of what your audience thinks.

ConnectUpPro is an open-source, self-hosted workspace for discovering themes,
questions, and sentiment in YouTube comments. Paste a public video URL, let AI
organize the conversation, and explore the feedback in one focused dashboard.

<div align="center">
  <img src="./public/dashboard-main.webp" alt="ConnectUpPro comment analysis dashboard" width="49%" />
  <img src="./public/features.webp" alt="ConnectUpPro semantic search and topic analysis features" width="49%" />
</div>

## Why ConnectUpPro?

Reading hundreds or thousands of comments one by one hides the patterns that
matter. ConnectUpPro helps creators and researchers move from raw feedback to
useful signals:

- **See the big themes** — AI groups similar comments into discoverable topic clusters.
- **Ask better questions** — semantic search finds meaning, not just exact keywords.
- **Understand the tone** — explore positive, negative, neutral, and other sentiment patterns.
- **Keep the data close** — run it on your own machine with your own database and API keys.

## Quick start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ with `vector` and `uuid-ossp` extensions
- A Google API key with access to YouTube Data API v3 and Gemini

The fastest way to run PostgreSQL locally is Docker:

```bash
docker compose up -d db
```

Then start ConnectUpPro:

```bash
npm install
cp .env.example .env.local
npm run db:generate
npm run db:push
npm run dev
```

Open <http://localhost:3000> and add a public YouTube video URL.

Your `.env.local` needs:

```env
DATABASE_URL="postgresql://connectuppro:connectuppro@localhost:5432/connectuppro?schema=public"
GOOGLE_API_KEY="your_google_api_key"
```

Create the key in the [Google Cloud Console](https://console.cloud.google.com/),
enable YouTube Data API v3, and enable Gemini access for the same project.

## What happens after you add a video?

1. ConnectUpPro imports the video and its comments.
2. Gemini creates embeddings so comments can be compared by meaning.
3. The dashboard organizes the conversation into themes and sentiment.
4. You can search, filter, and inspect the comments behind each insight.

## Important scope notes

This open-source edition is intentionally simple:

- It analyzes individual public YouTube videos. Direct channel ID lookup is also supported.
- It is a **single-workspace** app: there is no built-in login, OAuth, billing, or hosted account service.
- Anyone who can reach the installation can access its workspace. Run it on a private machine or trusted network.
- YouTube API quota and Gemini usage follow Google’s limits for your API key.

## Useful commands

```bash
npm run dev          # Start the development server
npm run build        # Build for production
npm run start        # Run the production build
npm run test:youtube # Check YouTube API access
```

## Contributing

Issues, ideas, and pull requests are welcome. If you find a bug or have a
feature in mind, please [open an issue](https://github.com/krngd2/ConnectUpPro/issues)
with enough context to reproduce or evaluate it.

## License

ConnectUpPro is released under the [MIT License](./LICENSE). Third-party
dependencies and external services retain their own licenses and terms.
