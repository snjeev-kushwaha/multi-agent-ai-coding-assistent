import { useState } from "react";
import { LogOut } from "lucide-react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { useJobStream } from "./hooks/useJobStream";
import { useJobStore } from "./store/jobStore";
import { AuthScreen } from "./features/chat/AuthScreen";
import { PromptInput } from "./features/chat/PromptInput";
import { AgentTimeline } from "./features/chat/AgentTimeline";
import { ConfirmationModal } from "./features/chat/ConfirmationModal";
import { FileTree } from "./features/file-explorer/FileTree";
import { CodeViewer } from "./features/file-explorer/CodeViewer";
import { DownloadButton } from "./features/download/DownloadButton";

function Workspace() {
  const { logout } = useAuth();
  const [jobId, setJobId] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const job = useJobStore((s) => s.job);
  const pendingInterrupt = useJobStore((s) => s.pendingInterrupt);
  const connectionError = useJobStore((s) => s.connectionError);

  useJobStream(jobId);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-semibold text-slate-200">AI Coding Assistant</span>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
        >
          <LogOut size={14} /> Sign out
        </button>
      </header>

      {connectionError && (
        <div className="border-b border-warning/30 bg-warning/10 px-4 py-1.5 text-xs text-warning">
          {connectionError}
        </div>
      )}

      {!jobId ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <PromptInput
            onJobCreated={(id) => {
              setJobId(id);
              setSelectedPath(null);
            }}
          />
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-[280px_1fr] gap-4 overflow-hidden p-4">
          <div className="flex flex-col gap-4 overflow-y-auto">
            <AgentTimeline job={job} />
            <FileTree job={job} selectedPath={selectedPath} onSelect={setSelectedPath} />
            {job && (
              <div className="flex flex-col gap-2">
                <DownloadButton job={job} />
                <button
                  onClick={() => {
                    setJobId(null);
                    setSelectedPath(null);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  Start a new project
                </button>
              </div>
            )}
          </div>
          <div className="overflow-hidden">
            <CodeViewer jobId={jobId} path={selectedPath} />
          </div>
        </div>
      )}

      {jobId && pendingInterrupt && <ConfirmationModal jobId={jobId} payload={pendingInterrupt} />}
    </div>
  );
}

function AppInner() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Workspace /> : <AuthScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <div className="h-screen bg-canvas">
        <AppInner />
      </div>
    </AuthProvider>
  );
}
