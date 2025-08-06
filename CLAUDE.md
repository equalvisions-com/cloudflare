# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `npm run dev` - Start full development environment (frontend + backend in parallel)
- `npm run dev:frontend` - Start Next.js frontend with Turbopack
- `npm run dev:backend` - Start Convex backend
- `npm run predev` - Setup command that runs Convex dev, setup script, and opens dashboard
- `npm run build` - Build Next.js production bundle
- `npm run lint` - Run ESLint checks
- `npm install --legacy-peer-deps` - Install dependencies (required due to peer dep conflicts)

### Testing
This project does not have a standard test command defined. Always check with the user for testing procedures.

## Architecture Overview

This is a social RSS reader application built with:

### Frontend Stack
- **Next.js 15** with App Router and Turbopack for development
- **React 19** for UI components
- **Tailwind CSS** with custom components in `components/ui/`
- **Radix UI** for accessible component primitives
- **Zustand** for client-side state management
- **SWR** for data fetching and caching

### Backend Stack
- **Convex** as the primary backend with real-time updates
- **Convex Auth** for authentication with custom tables
- **PlanetScale** for additional database needs
- **Cloudflare Workers** for queue processing (see `cloudflare-workers/` directory)
- **Resend** for email functionality

### Key Architecture Patterns

#### Data Layer
- **Convex Schema**: Central schema in `convex/schema.ts` defines all data models including posts, users, friends, likes, bookmarks, comments, and trending topics
- **Real-time Updates**: Convex provides live queries for instant UI updates
- **Queue System**: Cloudflare Workers handle RSS feed processing and batch operations

#### Component Architecture
- **Context Providers**: Multiple contexts in `lib/contexts/` for different data domains (Chat, Entries, Notifications, etc.)
- **Custom Hooks**: Extensive hook library in `hooks/` for data fetching, UI interactions, and business logic
- **Error Boundaries**: Dedicated error boundaries for different sections
- **Virtualization**: Uses `react-virtuoso` for performance with large lists

#### Routing & Pages
- **App Router Structure**: Pages in `app/` with nested layouts
- **Dynamic Routes**: Profile pages use `/@username` format via Next.js rewrites
- **API Routes**: REST endpoints in `app/api/` for external integrations

#### Special Features
- **RSS Feed Processing**: Custom RSS parsing and queue-based processing
- **Audio Player**: Persistent audio player with Howler.js for podcast playback
- **Real-time Chat**: Live chat functionality with trending topics
- **Social Features**: Friends, follows, likes, bookmarks, and comments system
- **Search**: Multi-faceted search across entries, people, and bookmarks

### Critical File Locations
- **Database Schema**: `convex/schema.ts`
- **Authentication**: `convex/auth.ts` and `convex/auth.config.ts`
- **Queue Workers**: `cloudflare-workers/` directory
- **Main Layout**: `app/layout.tsx`
- **UI Components**: `components/ui/` (shadcn/ui based)
- **Custom Hooks**: `hooks/` directory
- **Contexts**: `lib/contexts/`
- **Types**: `lib/types.ts` and `app/types/`

### Development Notes
- Uses `npm-run-all` to run frontend and backend concurrently
- Convex handles most backend logic with real-time capabilities
- Cloudflare Workers process RSS feeds asynchronously
- Custom image loader for Cloudflare integration
- Edge runtime polyfills for compatibility
- React Strict Mode disabled to prevent double mounting issues

### Queue System
The application uses Cloudflare Queues for processing RSS feeds:
- `queue-consumer-worker.js` - Main queue consumer
- `enhanced-queue-consumer-worker.js` - Enhanced queue processing
- `batch-status-durable-object.ts` - Durable objects for batch status tracking

Always run `npm run lint` after making changes to ensure code quality.

## Architecture Principles (from Cursor Rules)

### Edge Runtime & Deployment
- React + Next.js 15 deployed on Cloudflare Pages via @cloudflare/next-on-pages
- Edge runtime for all API routes and server components
- Cloudflare ecosystem: Queues, Workers, Images, Hyperdrive, Axiom logs
- Always verify edge runtime compatibility before implementation

### Code Quality Standards
- TypeScript strict mode enabled
- Use centralized types from types files
- Avoid 'any' type - use proper typing
- Prefer async/await over promises
- Use proper error handling patterns

### Development Philosophy
- Never over-engineer solutions - prefer simple, direct implementations
- Scale-first mindset for 100k concurrent users
- Always apply logical decision-making to code choices
- Implement proper error boundaries for resilient UX
- Optimize with React.memo, useMemo, useCallback only when needed
- Only use useEffect where deemed appropriate by React best practices

### Database Strategy
- Convex for real-time, collaborative features and auth
- PlanetScale via Hyperdrive for high-volume RSS data
- Use proper indexing and query optimization
- Use Hyperdrive for database connection pooling