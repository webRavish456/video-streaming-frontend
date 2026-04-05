# StreamHub — Frontend

Next.js **App Router** client for StreamHub. Talks to the REST API under `NEXT_PUBLIC_API_URL` and subscribes to **Socket.io** on the same host as the API for video progress events.



---

## Stack

| Technology | Role |
|------------|------|
| **Next.js 16** | App Router, React Compiler enabled in `next.config.mjs` |
| **React 19** | UI |
| **MUI + Emotion** | Layout, dialogs, tables, chips |
| **Tailwind 4** | Global styles with PostCSS (`postcss.config.mjs`) |
| **react-hook-form + Zod** | Login, signup, forms (`src/lib/authSchemas.js`) |
| **Plyr** | Watch page player; multi-quality sources from Cloudinary URLs (`src/lib/videosApi.js`) |
| **socket.io-client** | `video:progress` on org video uploads (`videos` page) |

---

## What this app does (UI)

- **Sign up / Sign in** — JWT stored in `localStorage`; profile includes `organizations` and `activeOrganizationId`.
- **Home (`/`)** — Org-scoped video grid with search and pagination; org **chips** list **all** memberships (sorted, active org first via `organizationsForChips`).
- **Videos (`/videos`)** — Full table: filters (safety, processing, search, dates, size), upload modal, replace, edit metadata, delete (admin); merges live pipeline state from sockets.
- **Watch (`/watch/[id]`)** — Loads watch-meta when logged in (org member path), else public meta; plays with Plyr.
- **Organization (`/organization`)** — Org name, members, roles (admin-only actions).
- **Settings (`/settings`)** — User / org-related settings where implemented.

Protected routes use **`AuthGuard`** and **`AuthContext`**.

---

## Environment

Copy the example file and set the API URL:

```bash
cp env.example .env.local
```

| Variable | Required | Example |
|----------|----------|---------|
| `NEXT_PUBLIC_API_URL` | Yes | `http://localhost:8000/api` |

Must include the `/api` suffix so `joinApi` / `apiVideosPath` match the backend mount.

---

## Run locally

1. Start the **backend** (default `http://localhost:8000`). See [../backend/README.md](../backend/README.md).
2. In this directory:

```bash
npm install
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000).

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server (port 3000) |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |

---

## Project layout (`src/`)

| Path | Description |
|------|-------------|
| `app/` | Routes: `login`, `signup`, `(protected)/` → `page` (home), `videos`, `watch/[id]`, `organization`, `settings` |
| `app/(protected)/AuthGuard.js` | Redirects unauthenticated users |
| `context/AuthContext.js` | `token`, `user`, `ready`, `login`, `logout`, `setActiveOrganizationId`, `refreshOrganizations`, `updateSessionUser`; hydrates from `localStorage` |
| `lib/orgApi.js` | Organizations, members, org-scoped videos (fetch, XHR upload/replace) |
| `lib/videosApi.js` | Public videos, public meta, org watch-meta, `getVideoPlaybackUrl`, `getVideoQualitySources` |
| `lib/videoModel.js` | `VIDEO_PROCESSING_STATUSES`, `VIDEO_SENSITIVITY_STATUSES`, `isVideoReadyForPlayback`, `isVideoPublicCatalogSafe` |
| `lib/organizationsForChips.js` | Chip ordering: active org first, then A–Z by name |
| `lib/dialogButtonSx.js` | Shared MUI button styles for dialogs |
| `components/` | `SiteChrome`, `UserAvatarMenu`, etc. |

---

## API usage (frontend side)

- **Bearer token** on authenticated `fetch` / XHR: `Authorization: Bearer <jwt>`.
- **Org video list:** `GET .../users/me/organizations/:organizationId/videos?...`
- **Upload:** `POST` multipart to same base path; progress via XHR `onprogress`.
- **Sockets:** connect to API origin (see backend CORS / socket config); listen for progress events keyed by `videoId` / `organizationId`.


