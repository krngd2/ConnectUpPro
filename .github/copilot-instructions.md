# ConnectUpPro Dashboard - AI Coding Assistant Instructions

## Project Overview

ConnectUpPro is a Next.js 15 YouTube comment analysis platform that fetches, processes, and clusters video comments using AI embeddings. The application follows a video-centric architecture where individual videos are analyzed rather than projects containing multiple videos.

## Architecture & Key Patterns

### Data Flow Architecture

- **YouTube API Integration**: Fetches video metadata and comments via `src/lib/youtube.ts`
- **Background Processing**: `src/lib/background-processor.ts` handles async video analysis with status tracking (`PENDING` → `DOWNLOADING` → `PROCESSING` → `COMPLETED`/`FAILED`)
- **AI Clustering**: Comments are embedded using Google Gemini API and clustered using K-means/PCA (`src/lib/gemini.ts`)
- **Real-time Updates**: Server-Sent Events for streaming large comment datasets in analysis view

### Database Schema (Prisma + PostgreSQL)

- **Video-centric model**: Each video is independently analyzed
- **Vector embeddings**: Comments have pgvector embeddings for semantic search
- **Cluster hierarchy**: Supports nested comment clusters with levels
- **Status tracking**: Videos track processing state through enum values

### Component Architecture

```
src/components/analysis/
├── analysis-view.tsx          # Main analysis container (uses enhanced hooks pattern)
├── sub-components/           # Modular UI components
│   ├── AnalysisSidebar.tsx   # Cluster navigation
│   ├── CommentsFeed.tsx      # Threaded comment display
│   └── SemanticSearchModals.tsx # Search functionality
```

## Development Patterns

### Enhanced Hooks Pattern

The app uses an "enhanced hooks" pattern in `useAnalysisView.ts`:

```typescript
export type EnhancedHooksType = ReturnType<typeof useAnalysisView> & {
  selectedCategory: string;
  setSelectedCategory: Dispatch<SetStateAction<string>>;
  videoId: string;
};
```

This pattern centralizes state management and passes all state/handlers to child components as a single `hooks` prop.

### API Routes Structure

- **Action-based APIs**: `src/app/actions/*.actions.ts` contain server actions
- **RESTful endpoints**: `src/app/api/**/route.ts` for external integrations
- **Streaming endpoints**: `/stream` suffixed routes use Server-Sent Events for large datasets

### Comment Threading System

Comments support parent-child relationships with `platformId` patterns:

- Parent comments: `"abc123"`
- Reply comments: `"abc123.1"`, `"abc123.2"`
- Threading logic in `analysis-view.tsx` `organizeCommentsIntoThreads()`

## Key Development Commands

### Environment & Setup

```bash
npm run check:env          # Validate all required environment variables
npm run test:youtube       # Test YouTube API connectivity before development
npm run db:generate        # Generate Prisma client after schema changes
npm run db:push           # Push schema changes to database
```

### Development Workflow

```bash
npm run dev               # Start with env check + Next.js dev server
npm run dev:turbo         # Use turbopack for faster builds
npm run pre:build         # Environment check + Prisma generation before build
```

## Critical Integration Points

### YouTube API (`src/lib/youtube.ts`)

- Rate limited: includes delays between batch requests
- Handles video privacy and disabled comments gracefully
- Extracts video IDs from various YouTube URL formats
- Fetches comments in batches with pagination

### AI Processing Pipeline

1. **Comment Ingestion**: Batch fetch from YouTube API
2. **Embedding Generation**: Google Gemini creates vector embeddings
3. **Clustering**: K-means with PCA dimensionality reduction
4. **Fallback Logic**: Keyword-based clustering when memory-intensive clustering fails

### Local workspace

- There is no login or hosted authentication provider.
- `src/lib/local-user.server.ts` creates or reuses the single local workspace owner
  required by the relational schema.
- Every installation is intended to run as a private local instance.

## Error Handling Patterns

### Background Processing

- Extensive logging with prefixes: `[PROCESSOR]`, `[YOUTUBE]`, `[QUEUE]`
- Graceful degradation: Falls back to simple clustering on memory errors
- Status persistence: Updates video status even on partial failures

### Database Operations

- Health checks via `/api/health` endpoint test connectivity and operations
- BigInt serialization handling for API responses
- Retry logic for transient connection issues

## Development Guidelines

### Adding New Analysis Features

1. **Extend AnalysisData interface** in `src/lib/types.ts`
2. **Update useAnalysisView hook** to manage new state
3. **Add API endpoints** following the `/api/videos/{videoId}/feature` pattern
4. **Consider streaming** for large datasets using Server-Sent Events

### Database Changes

1. **Always run `npm run check:env`** before database operations
2. **Update Prisma schema** then run `npm run db:generate`
3. **Test migrations locally** with `npm run db:migrate`
4. **Vector operations** use raw SQL for pgvector compatibility

### Comment Processing

- **Thread organization**: Use `organizeCommentsIntoThreads()` for hierarchical display
- **Dynamic categorization**: Generate categories from word frequency analysis
- **Similarity filtering**: Leverage embeddings for semantic comment grouping

## Debugging & Monitoring

### Status Tracking

- Check video processing status via database queries or `/api/videos-analysis/{videoId}/status`
- Processing logs include detailed prefixes for filtering
- Background processing uses `setImmediate()` for non-blocking operations

### Common Issues

- **YouTube quota limits**: Check Google Cloud Console quotas
- **Memory errors in clustering**: Falls back to keyword-based clustering automatically
- **Vector similarity queries**: Use raw SQL for pgvector operations
- **Large comment sets**: Implement streaming via Server-Sent Events
