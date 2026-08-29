# AI Coding Assistant -- Frontend

React + Vite + Tailwind UI for the multi-agent coding assistant backend.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173. API calls to `/api/*` are proxied to
`http://localhost:8000` by `vite.config.ts` -- run the backend first (see
`../backend/README.md`).

## What's here

- **`src/hooks/useAuth.tsx`** -- signup/login/logout, JWT stored in
  localStorage, automatic refresh-token retry on a 401 (`src/api/client.ts`).
- **`src/hooks/useJobStream.ts`** + **`src/lib/streaming.ts`** -- subscribes
  to a job's Server-Sent Events stream. Uses `fetch()`'s streaming body
  rather than the native `EventSource`, specifically so an `Authorization`
  header can be attached (EventSource can't send custom headers, and we
  don't want auth tokens sitting in a URL).
- **`src/features/chat/ConfirmationModal.tsx`** -- renders the three pause
  points the backend can send: a clarifying-questions form, a plan review
  (approve / request changes / cancel), and a file-list review (same three
  actions). This is the UI half of the backend's human-in-the-loop
  `interrupt()` nodes.
- **`src/features/file-explorer/`** -- live file tree (pending / done /
  failed per file) and a read-only CodeMirror viewer that fetches file
  content on demand from `GET /jobs/{id}/files/{path}`.
- **`src/features/download/DownloadButton.tsx`** -- downloads the packaged
  zip once the job reaches `done`, surfacing a warning if any files failed
  (partial success is still downloadable, per the backend's Packager node).

## Production build

```bash
npm run build      # outputs to dist/
npm run preview    # serve the production build locally to sanity-check it
```

Docker (nginx serving the static build + proxying `/api` to the backend):

```bash
docker build -t coder-buddy-frontend .
docker run -p 8080:80 coder-buddy-frontend
```

`nginx.conf` proxies `/api/` to a service named `api` on port 8000 -- match
that to your backend's docker-compose service name, or point it at a real
domain in production.

## Known trade-offs worth knowing about

- The main JS bundle is ~272 kB gzipped, mostly CodeMirror's language
  packages. Fine for an internal tool; if this ships broadly, code-split the
  CodeMirror language extensions with dynamic `import()` per file type
  instead of bundling all five up front (see the Vite build warning for the
  exact hook).
- There's no client-side router yet -- the whole app is one view that
  switches between "prompt input" and "workspace" based on local state. Add
  a router when you need shareable job URLs or a job history page.
