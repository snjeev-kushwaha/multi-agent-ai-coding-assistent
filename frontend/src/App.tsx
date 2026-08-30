import { useEffect, useState } from "react";
import { PanelLeftOpen, Plus, Sparkles, FolderCode } from "lucide-react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider } from "./hooks/useTheme";
import { useJobStream } from "./hooks/useJobStream";
import { useJobStore } from "./store/jobStore";

import { AuthScreen } from "./features/chat/AuthScreen";
import { PromptInput } from "./features/chat/PromptInput";
import { AgentTimeline } from "./features/chat/AgentTimeline";
import { ConfirmationModal } from "./features/chat/ConfirmationModal";
import { FileTree } from "./features/file-explorer/FileTree";
import { CodeViewer } from "./features/file-explorer/CodeViewer";
import { DownloadButton } from "./features/download/DownloadButton";
import { Sidebar } from "./features/sidebar/Sidebar";
import { AdminLayout } from "./features/admin/AdminLayout";
import { AdminRouteGuard } from "./features/admin/AdminRouteGuard";

interface WorkspaceProps {
  onOpenAdmin: () => void;
}

function Workspace({ onOpenAdmin }: WorkspaceProps) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 768;
    }
    return true;
  });
  const job = useJobStore((s) => s.job);
  const reset = useJobStore((s) => s.reset);
  const pendingInterrupt = useJobStore((s) => s.pendingInterrupt);
  const connectionError = useJobStore((s) => s.connectionError);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useJobStream(jobId);

  const handleNewProject = () => {
    setJobId(null);
    setSelectedPath(null);
    reset();
  };

  const handleSelectJob = (id: string) => {
    reset();
    setJobId(id);
    setSelectedPath(null);
  };

  const projectTitle = job?.plan?.name || (job?.user_prompt ? (job.user_prompt.length > 40 ? job.user_prompt.slice(0, 40) + "..." : job.user_prompt) : "New Project");

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas relative">
      {/* ChatGPT-style Responsive Sidebar */}
      <Sidebar
        currentJobId={jobId}
        onSelectJob={handleSelectJob}
        onNewProject={handleNewProject}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpenAdmin={onOpenAdmin}
      />

      {/* Main Workspace */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top Header */}
        <header className="flex items-center justify-between border-b border-border bg-surface px-3 sm:px-4 py-2.5">

          <div className="flex items-center gap-2.5 min-w-0">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                title="Open sidebar"
                className="flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-surface hover:text-slate-200 transition"
              >
                <PanelLeftOpen size={18} />
              </button>
            )}
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/20 text-accent shrink-0">
                <FolderCode size={14} />
              </div>
              <span className="truncate text-xs font-semibold text-slate-200">
                {jobId ? projectTitle : "AI Coding Assistant"}
              </span>
              {job && (
                <span className="hidden sm:inline-flex items-center rounded-full bg-surfaceRaised px-2 py-0.5 text-[10px] font-medium text-slate-400 border border-border/60 uppercase">
                  {job.status.replace("_", " ")}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {jobId && (
              <button
                onClick={handleNewProject}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-surfaceRaised hover:text-white transition"
              >
                <Plus size={13} />
                <span className="hidden sm:inline">New Project</span>
              </button>
            )}
          </div>
        </header>

        {connectionError && (
          <div className="border-b border-warning/30 bg-warning/10 px-4 py-1.5 text-xs text-warning">
            {connectionError}
          </div>
        )}

        {/* Content Area */}
        {!jobId ? (
          <div className="flex flex-1 items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <PromptInput
              onJobCreated={(id) => {
                setJobId(id);
                setSelectedPath(null);
              }}
            />
          </div>
        ) : (
          <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[300px_1fr] gap-4 overflow-y-auto lg:overflow-hidden p-3 sm:p-4 min-h-0">
            <div className="flex flex-col gap-4 overflow-y-auto shrink-0 lg:max-h-full">
              <AgentTimeline job={job} />
              <FileTree job={job} selectedPath={selectedPath} onSelect={setSelectedPath} />
              {job && (
                <div className="flex flex-col gap-2">
                  <DownloadButton job={job} />
                  <button
                    onClick={handleNewProject}
                    className="text-xs text-slate-500 hover:text-slate-300 py-1 transition"
                  >
                    Start a new project
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1 min-h-[360px] lg:min-h-0 overflow-hidden rounded-xl border border-border bg-surface">
              <CodeViewer jobId={jobId} path={selectedPath} />
            </div>
          </div>
        )}

        {jobId && pendingInterrupt && <ConfirmationModal jobId={jobId} payload={pendingInterrupt} />}
      </div>
    </div>
  );
}

function AppInner() {
  const { isAuthenticated } = useAuth();
  const [isAdminRoute, setIsAdminRoute] = useState(() => {
    if (typeof window !== "undefined") {
      return window.location.pathname.startsWith("/admin") || window.location.hash.startsWith("#admin");
    }
    return false;
  });

  useEffect(() => {
    const handlePopState = () => {
      setIsAdminRoute(window.location.pathname.startsWith("/admin") || window.location.hash.startsWith("#admin"));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateToAdmin = () => {
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", "/admin");
    }
    setIsAdminRoute(true);
  };

  const navigateToWorkspace = () => {
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", "/");
    }
    setIsAdminRoute(false);
  };

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  if (isAdminRoute) {
    return (
      <AdminRouteGuard onExitAdmin={navigateToWorkspace}>
        <AdminLayout onExitAdmin={navigateToWorkspace} />
      </AdminRouteGuard>
    );
  }

  return <Workspace onOpenAdmin={navigateToAdmin} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="h-screen bg-canvas text-slate-100">
          <AppInner />
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}


