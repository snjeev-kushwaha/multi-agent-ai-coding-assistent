# AI Coding Assistant — Frontend

A modern, high-performance web interface for the Multi-Agent Coding Assistant built with **React**, **Vite**, **TypeScript**, and **Tailwind CSS**.

---

## Quick Start (Step-by-Step)

### 1. Prerequisites
- Node.js 18+
- Backend API running on `http://localhost:8000`

### 2. Installation & Launch
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Key Features

### 1. Interactive Workspace & Coding Studio
- **Project Generation**: Start new code projects with custom prompts or edit existing codebases.
- **Human-in-the-Loop Dialogs**: Approve or modify plans and architectural file maps before code generation begins.
- **Live Agent Timeline**: Real-time SSE streaming of agent thoughts, tool calls, and file generation status.
- **CodeMirror Syntax Viewer**: Syntax-highlighted code explorer with line numbers and file tree folding.
- **One-Click Download**: Instant packaged ZIP download of completed projects.

### 2. Project History & Management
- **Sidebar Drawer**: Responsive project history sidebar with real-time search filtering.
- **Triple-Dot (`•••`) Context Menu**:
  - **Rename Project**: Custom modal to update project titles on the fly.
  - **Delete Project**: Confirmation dialog with permanent cleanup.
- **Responsive Layout**: Collapsible sidebar with full mobile support.

### 3. Theme & Color Palette System
- **Light & Dark Mode**: Instant toggle for light and dark color schemes.
- **12 Curated Accent Themes**: Upward-floating color palette picker with live preview swatches:
  - *Veo Onyx*, *Ocean Blue*, *Midnight Azure*, *Graphite Studio*, *Copper Slate*, *Ember Orange*, *Sunlit Yellow*, *Grove Green*, *Studio Rose*, *Signal Red*, *Barbie Pink*, *Teal Horizon*.
- **Persistence**: Remembers your preferred mode and theme across sessions via `localStorage`.

### 4. Admin Console Suite (`/admin`)
- **Route Guard**: Client-side protection with 403 access barriers for non-admin accounts.
- **System Overview & KPI Cards**: Live counters for jobs today, Groq tokens consumed, success rate, and estimated API spend.
- **Interactive Timeseries Charts**: Toggle between smooth SVG Bezier curve line charts and bar charts across 7d/14d/30d/90d horizons.
- **User Management Directory**: Search users, review hourly rate-limit token meters, reset limits, and suspend/unsuspend accounts.
- **Job Oversight & Triage**: Filter jobs by status, user, and date range, with failure stage summary badges and live job cancellation.
- **Audit Trail Inspector**: Queryable log of all administrative actions with formatted JSON metadata viewer.

---

## Production Build

```bash
# Compile TypeScript and bundle with Vite
npm run build

# Preview the production build locally
npm run preview
```

### Docker Deployment
```bash
docker build -t coder-buddy-frontend .
docker run -p 8080:80 coder-buddy-frontend
```

---

## Project Structure

```
frontend/
├── src/
│   ├── api/              # API clients & TypeScript types (jobs, admin, auth)
│   ├── features/
│   │   ├── admin/        # Admin layout, route guard, and dashboard pages
│   │   │   ├── pages/    # Overview, Users, Jobs, Failures, AuditLogs
│   │   │   └── components/# UserDetailDrawer, AdminJobDetailDrawer, SuspendModal
│   │   ├── chat/         # Prompt input, agent timeline, confirmation modals
│   │   ├── download/     # ZIP download button
│   │   ├── file-explorer/# File tree and CodeMirror editor
│   │   └── sidebar/      # Sidebar, UserProfileModal, RenameModal, ThemeSelector
│   ├── hooks/            # useAuth, useTheme, useJobStream
│   ├── store/            # Zustand job and agent state stores
│   ├── styles/           # Tailwind CSS and root theme variables
│   ├── App.tsx           # View switcher, route guard, and app root
│   └── main.tsx          # Application entrypoint
├── tailwind.config.js    # Tailwind color theme tokens
└── vite.config.ts        # Vite configuration & proxy settings
```
