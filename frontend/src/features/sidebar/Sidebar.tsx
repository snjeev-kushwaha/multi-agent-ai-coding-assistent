import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Search,
  FolderGit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Sparkles,
  PanelLeftClose,
  MoreVertical,
  MoreHorizontal,
  Layers,
  ChevronRight,
  Shield,
  Edit3,
} from "lucide-react";
import { deleteJob, listJobs, renameJob } from "../../api/jobs";
import type { Job, JobStatus } from "../../api/types";
import { useAuth } from "../../hooks/useAuth";
import { UserProfileModal } from "./UserProfileModal";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { RenameModal } from "./RenameModal";
import { ThemeSelector } from "./ThemeSelector";

interface SidebarProps {
  currentJobId: string | null;
  onSelectJob: (jobId: string) => void;
  onNewProject: () => void;
  isOpen: boolean;
  onClose: () => void;
  onOpenAdmin?: () => void;
}

export function Sidebar({
  currentJobId,
  onSelectJob,
  onNewProject,
  isOpen,
  onClose,
  onOpenAdmin,
}: SidebarProps) {
  const { user, logout, refreshUser } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Actions state
  const [openMenuJobId, setOpenMenuJobId] = useState<string | null>(null);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [jobToRename, setJobToRename] = useState<Job | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  const fetchJobsList = async () => {
    try {
      setLoading(true);
      const data = await listJobs();
      setJobs(data);
    } catch (err) {
      console.error("Failed to load project history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobsList();
  }, [currentJobId]);

  // Click outside to close active item menu
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuJobId(null);
      }
    };
    if (openMenuJobId) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [openMenuJobId]);

  const handleOpenMenu = (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    setOpenMenuJobId(openMenuJobId === jobId ? null : jobId);
  };

  const handleOpenRename = (e: React.MouseEvent, job: Job) => {
    e.stopPropagation();
    setOpenMenuJobId(null);
    setJobToRename(job);
  };

  const handleOpenDeleteModal = (e: React.MouseEvent, job: Job) => {
    e.stopPropagation();
    setOpenMenuJobId(null);
    setJobToDelete(job);
  };

  const handleConfirmRename = async (newTitle: string) => {
    if (!jobToRename) return;
    try {
      setIsRenaming(true);
      const updatedJob = await renameJob(jobToRename.id, newTitle);
      setJobs((prev) =>
        prev.map((j) => (j.id === jobToRename.id ? { ...j, plan: updatedJob.plan } : j))
      );
      setJobToRename(null);
    } catch (err) {
      console.error("Failed to rename project:", err);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!jobToDelete) return;
    try {
      setIsDeleting(true);
      await deleteJob(jobToDelete.id);
      setJobs((prev) => prev.filter((j) => j.id !== jobToDelete.id));
      if (currentJobId === jobToDelete.id) {
        onNewProject();
      }
      refreshUser();
      setJobToDelete(null);
    } catch (err) {
      console.error("Failed to delete project:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleNewProjectClick = () => {
    onNewProject();
    if (window.innerWidth < 768) {
      onClose();
    }
  };

  const handleSelectJobClick = (jobId: string) => {
    onSelectJob(jobId);
    if (window.innerWidth < 768) {
      onClose();
    }
  };

  const filteredJobs = jobs.filter((job) => {
    const title = job.plan?.name || job.user_prompt;
    const tech = job.plan?.tech_stack?.join(" ") || "";
    const q = searchQuery.toLowerCase();
    return title.toLowerCase().includes(q) || tech.toLowerCase().includes(q);
  });

  const getStatusBadge = (status: JobStatus) => {
    switch (status) {
      case "done":
        return (
          <span className="flex items-center gap-1 text-[11px] font-medium text-success">
            <CheckCircle2 size={12} /> Done
          </span>
        );
      case "failed":
        return (
          <span className="flex items-center gap-1 text-[11px] font-medium text-danger">
            <AlertCircle size={12} /> Failed
          </span>
        );
      case "queued":
      case "clarifying":
      case "planning":
      case "architecting":
      case "coding":
      case "reviewing":
      case "packaging":
        return (
          <span className="flex items-center gap-1 text-[11px] font-medium text-accent animate-pulse">
            <Loader2 size={12} className="animate-spin" /> In Progress
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] font-medium text-warning">
            <Clock size={12} /> {status}
          </span>
        );
    }
  };

  const formatTimestamp = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-72 flex-col border-r border-border bg-surface text-slate-300 select-none shadow-2xl transition-all duration-300 ease-in-out md:static md:z-auto md:shadow-none shrink-0 ${isOpen
            ? "translate-x-0 opacity-100 md:w-72"
            : "-translate-x-full opacity-0 pointer-events-none md:w-0 md:opacity-0 md:border-r-0 md:overflow-hidden"
          }`}
      >
        {/* Header with App Title & Close button on mobile */}
        <div className="flex items-center justify-between border-b border-border/70 p-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white shadow-sm font-bold text-xs">
              <Sparkles size={15} />
            </div>
            <span className="text-xs font-semibold tracking-tight">Codeframe</span> {/*Coder Buddy, CodeCrew */}
          </div>

          <button
            onClick={onClose}
            title="Close sidebar"
            className="flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-surfaceRaised hover:text-slate-200 transition"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>

        {/* New Project Button */}
        <div className="p-3">
          <button
            onClick={handleNewProjectClick}
            className="flex w-full items-center justify-between rounded-xl bg-accent/10 border border-accent/30 px-3.5 py-2.5 text-xs font-medium text-slate-100 hover:bg-accent/20 hover:border-accent/50 transition shadow-sm group"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-accent text-white">
                <Plus size={13} strokeWidth={3} />
              </div>
              <span className="font-semibold">New Project</span>
            </div>
            <span className="text-[11px] text-accent font-medium opacity-80 group-hover:opacity-100">Build</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="px-3 pb-2">
          <div className="relative flex items-center">
            <Search size={13} className="absolute left-3 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search past projects..."
              className="w-full rounded-lg border border-border/70 bg-surfaceRaised/50 py-1.5 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-accent focus:bg-surface"
            />
          </div>
        </div>

        {/* History Header */}
        <div className="flex items-center justify-between px-3.5 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">
          <span>Project History</span>
          <span className="text-[10px] text-slate-500">{filteredJobs.length}</span>
        </div>

        {/* Project List */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
          {loading && jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500 gap-2">
              <Loader2 size={18} className="animate-spin text-accent" />
              <span className="text-xs">Loading history...</span>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="py-8 text-center px-4">
              <FolderGit2 className="mx-auto mb-2 text-slate-600" size={24} />
              <p className="text-xs text-slate-400 font-medium">No projects found</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {searchQuery ? "Try a different keyword" : "Start your first project above"}
              </p>
            </div>
          ) : (
            filteredJobs.map((j) => {
              const isSelected = currentJobId === j.id;
              const isMenuOpen = openMenuJobId === j.id;
              const title = j.plan?.name || j.user_prompt;
              const tech = j.plan?.tech_stack?.slice(0, 2) || [];

              return (
                <div
                  key={j.id}
                  onClick={() => handleSelectJobClick(j.id)}
                  className={`group relative flex flex-col gap-1 rounded-xl p-2.5 text-left text-xs transition cursor-pointer border ${isSelected
                      ? "border-accent/40 bg-accent/10 text-slate-100 shadow-sm"
                      : "border-transparent text-slate-300 hover:border-border/60 hover:bg-surfaceRaised/60"
                    }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="truncate font-medium text-slate-200 group-hover:text-white flex-1 pr-1">
                      {title}
                    </span>

                    {/* Triple Dot Action Button */}
                    <div className="relative" ref={isMenuOpen ? menuRef : null}>
                      <button
                        onClick={(e) => handleOpenMenu(e, j.id)}
                        title="More options"
                        className={`rounded-lg p-1 transition ${isMenuOpen
                            ? "bg-surfaceRaised text-white"
                            : "opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white hover:bg-surfaceRaised"
                          }`}
                      >
                        <MoreHorizontal size={14} />
                      </button>

                      {/* Dropdown Menu */}
                      {isMenuOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-full mt-1 w-32 z-30 rounded-xl border border-border bg-surfaceRaised p-1 shadow-xl backdrop-blur-sm animate-in fade-in zoom-in-95 duration-100"
                        >
                          <button
                            onClick={(e) => handleOpenRename(e, j)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 hover:bg-surface hover:text-white transition"
                          >
                            <Edit3 size={13} className="text-accent" />
                            <span>Rename</span>
                          </button>
                          <button
                            onClick={(e) => handleOpenDeleteModal(e, j)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-danger hover:bg-danger/15 transition"
                          >
                            <Trash2 size={13} />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5">
                    <div className="flex items-center gap-1.5">
                      {getStatusBadge(j.status)}
                      {tech.length > 0 && (
                        <span className="rounded bg-surfaceRaised px-1.5 py-0.2 text-[10px] text-slate-400 border border-border/40">
                          {tech.join(", ")}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {formatTimestamp(j.created_at)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ChatGPT Style Profile Footer */}
        <div className="border-t border-border/70 p-2.5 bg-surface space-y-1.5">
          {user?.is_admin && onOpenAdmin && (
            <button
              onClick={() => {
                onOpenAdmin();
                if (window.innerWidth < 768) onClose();
              }}
              className="flex w-full items-center justify-between rounded-xl bg-accent/15 border border-accent/30 px-3 py-2 text-xs font-semibold text-accent hover:bg-accent/25 hover:border-accent/50 transition group"
            >
              <div className="flex items-center gap-2">
                <Shield size={14} />
                <span>Admin Console</span>
              </div>
              <ChevronRight size={14} className="opacity-70 group-hover:translate-x-0.5 transition" />
            </button>
          )}

          <div
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center justify-between rounded-xl p-2 text-xs font-medium text-slate-200 hover:bg-surfaceRaised/80 cursor-pointer transition border border-transparent hover:border-border/60 group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-accent to-indigo-400 text-xs font-bold text-white shadow">
                {user?.email ? user.email.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-slate-200 group-hover:text-white">
                  {user?.email ? user.email.split("@")[0] : "User Profile"}
                </div>
                <div className="truncate text-[10px] text-slate-400">
                  {user?.is_admin ? "Administrator" : user?.total_projects !== undefined ? `${user.total_projects} projects` : user?.email}
                </div>
              </div>
            </div>
            <MoreVertical size={15} className="text-slate-400 group-hover:text-slate-200 shrink-0" />
          </div>

          {/* Theme & Palette Controls */}
          <div className="pt-1">
            <ThemeSelector />
          </div>
        </div>
      </aside>

      {/* User Profile Modal */}
      <UserProfileModal
        user={user}
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onLogout={logout}
        onOpenAdmin={onOpenAdmin}
      />

      {/* Rename Modal */}
      <RenameModal
        job={jobToRename}
        isOpen={!!jobToRename}
        isRenaming={isRenaming}
        onClose={() => setJobToRename(null)}
        onConfirm={handleConfirmRename}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!jobToDelete}
        projectTitle={jobToDelete?.plan?.name || jobToDelete?.user_prompt || "Project"}
        isDeleting={isDeleting}
        onClose={() => setJobToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
