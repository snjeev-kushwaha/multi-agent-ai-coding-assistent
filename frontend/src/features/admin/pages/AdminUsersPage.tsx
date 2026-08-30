import { useEffect, useState } from "react";
import {
  Users,
  Search,
  Filter,
  Shield,
  RotateCcw,
  Ban,
  CheckCircle,
  Eye,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  X,
  Clock,
} from "lucide-react";
import {
  getAdminUserDetail,
  listAdminUsers,
  resetUserRateLimit,
  suspendUser,
  unsuspendUser,
} from "../../../api/admin";
import type {
  AdminUserDetailResponse,
  AdminUserItem,
  AdminUserListResponse,
} from "../../../api/adminTypes";
import { useAuth } from "../../../hooks/useAuth";
import { SuspendConfirmModal } from "../components/SuspendConfirmModal";
import { UserDetailDrawer } from "../components/UserDetailDrawer";

export function AdminUsersPage() {
  const { user: currentAdmin } = useAuth();
  const [data, setData] = useState<AdminUserListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Selection & Details state
  const [selectedUserDetail, setSelectedUserDetail] = useState<AdminUserDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Suspend modal state
  const [userToSuspend, setUserToSuspend] = useState<AdminUserItem | null>(null);
  const [isSuspending, setIsSuspending] = useState(false);

  // Action status state
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const isSuspended = statusFilter === "suspended" ? true : statusFilter === "active" ? false : undefined;
      const isAdmin = roleFilter === "admin" ? true : roleFilter === "user" ? false : undefined;

      const res = await listAdminUsers({
        page,
        limit: 15,
        search: search.trim() || undefined,
        is_suspended: isSuspended,
        is_admin: isAdmin,
      });
      setData(res);
    } catch (err: any) {
      setBannerMessage({ text: err?.message || "Failed to load user list.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, statusFilter, roleFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleViewUser = async (userId: string) => {
    try {
      setDetailLoading(true);
      const detail = await getAdminUserDetail(userId);
      setSelectedUserDetail(detail);
    } catch (err: any) {
      setBannerMessage({ text: err?.message || "Failed to load user details.", type: "error" });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenSuspendModal = (e: React.MouseEvent, user: AdminUserItem) => {
    e.stopPropagation();
    setUserToSuspend(user);
  };

  const handleConfirmSuspend = async () => {
    if (!userToSuspend) return;
    try {
      setIsSuspending(true);
      if (userToSuspend.is_suspended) {
        await unsuspendUser(userToSuspend.id);
        setBannerMessage({ text: `User '${userToSuspend.email}' unsuspended.`, type: "success" });
      } else {
        await suspendUser(userToSuspend.id);
        setBannerMessage({ text: `User '${userToSuspend.email}' suspended.`, type: "success" });
      }
      setUserToSuspend(null);
      await fetchUsers();
      if (selectedUserDetail?.id === userToSuspend.id) {
        const updated = await getAdminUserDetail(userToSuspend.id);
        setSelectedUserDetail(updated);
      }
    } catch (err: any) {
      setBannerMessage({ text: err?.message || "Failed to update user status.", type: "error" });
    } finally {
      setIsSuspending(false);
    }
  };

  const handleResetRateLimit = async (e: React.MouseEvent, user: AdminUserItem) => {
    e.stopPropagation();
    try {
      setActionLoadingId(user.id);
      const res = await resetUserRateLimit(user.id);
      setBannerMessage({ text: `Rate limit bucket reset for '${user.email}'.`, type: "success" });
      if (selectedUserDetail?.id === user.id && res.rate_limit_state) {
        setSelectedUserDetail({
          ...selectedUserDetail,
          rate_limit_state: res.rate_limit_state,
        });
      }
    } catch (err: any) {
      setBannerMessage({ text: err?.message || "Failed to reset rate limit.", type: "error" });
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatLastActive = (dateStr: string | null) => {
    if (!dateStr) return <span className="text-slate-500 italic">Never</span>;
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 2) return <span className="text-emerald-400 font-medium">Just now</span>;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <Users className="text-accent" size={22} />
            User Management Directory
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse registered accounts, inspect rate limits, review job histories, and manage suspensions.
          </p>
        </div>
        <div className="text-xs text-slate-400 font-mono">
          Total Accounts: <strong className="text-slate-200">{data?.total ?? 0}</strong>
        </div>
      </div>

      {bannerMessage && (
        <div
          className={`flex items-center justify-between rounded-xl p-3 text-xs border ${
            bannerMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-danger/10 border-danger/30 text-danger"
          }`}
        >
          <span>{bannerMessage.text}</span>
          <button onClick={() => setBannerMessage(null)} className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative flex items-center">
          <Search size={14} className="absolute left-3.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by email address..."
            className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-20 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="absolute right-1.5 rounded-lg bg-surfaceRaised px-3 py-1 text-xs font-medium text-slate-300 hover:text-white border border-border"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-xs text-slate-300 outline-none focus:border-accent"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Accounts</option>
            <option value="suspended">Suspended Accounts</option>
          </select>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-xs text-slate-300 outline-none focus:border-accent"
          >
            <option value="all">All Roles</option>
            <option value="user">Regular Users</option>
            <option value="admin">Administrators</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto rounded-2xl border border-border/70 bg-surface/70 shadow-sm">
        <table className="w-full text-left text-xs text-slate-300 border-collapse">
          <thead>
            <tr className="border-b border-border bg-surfaceRaised/60 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4 text-center">Role</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-center">Jobs Created</th>
              <th className="py-3 px-4">Last Active</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {loading && !data ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  <Loader2 size={20} className="mx-auto mb-2 animate-spin text-accent" />
                  <span>Loading user directory...</span>
                </td>
              </tr>
            ) : data?.users.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  <Users size={24} className="mx-auto mb-2 opacity-50" />
                  <span>No matching users found.</span>
                </td>
              </tr>
            ) : (
              data?.users.map((u) => {
                const isSelf = currentAdmin?.id === u.id;
                const isBusy = actionLoadingId === u.id;

                return (
                  <tr
                    key={u.id}
                    onClick={() => handleViewUser(u.id)}
                    className="hover:bg-surface/90 transition cursor-pointer group"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-accent/80 to-indigo-400/80 text-xs font-bold text-white shadow shrink-0">
                          {u.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-200 group-hover:text-white truncate">
                            {u.email}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono truncate">{u.id}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center">
                      {u.is_admin ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent border border-accent/30">
                          <Shield size={10} /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-surfaceRaised px-2 py-0.5 text-[10px] font-medium text-slate-400 border border-border">
                          User
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      {u.is_suspended ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-bold text-danger border border-danger/30">
                          <Ban size={10} /> Suspended
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
                          <CheckCircle size={10} /> Active
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-200">
                      {u.job_count}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {formatLastActive(u.last_active_at)}
                    </td>

                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => handleViewUser(u.id)}
                          title="Inspect user details"
                          className="flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-slate-300 hover:bg-surfaceRaised hover:text-white transition"
                        >
                          <Eye size={12} />
                          <span>Details</span>
                        </button>

                        <button
                          onClick={(e) => handleResetRateLimit(e, u)}
                          disabled={isBusy}
                          title="Clear rate limit bucket"
                          className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-300 hover:bg-amber-500/20 transition disabled:opacity-50"
                        >
                          <RotateCcw size={12} className={isBusy ? "animate-spin" : ""} />
                          <span>Reset Limit</span>
                        </button>

                        {!isSelf && (
                          <button
                            onClick={(e) => handleOpenSuspendModal(e, u)}
                            disabled={isBusy}
                            title={u.is_suspended ? "Unsuspend account" : "Suspend account"}
                            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition disabled:opacity-50 border ${
                              u.is_suspended
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                                : "bg-danger/10 border-danger/30 text-danger hover:bg-danger/20"
                            }`}
                          >
                            <Ban size={12} />
                            <span>{u.is_suspended ? "Unsuspend" : "Suspend"}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>
            Page {data.page} of {data.total_pages} ({data.total} users)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-slate-300 hover:bg-surfaceRaised disabled:opacity-40 transition"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, data.total_pages))}
              disabled={page >= data.total_pages}
              className="flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-slate-300 hover:bg-surfaceRaised disabled:opacity-40 transition"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* User Detail Drawer */}
      <UserDetailDrawer
        user={selectedUserDetail}
        isOpen={!!selectedUserDetail}
        isSelf={currentAdmin?.id === selectedUserDetail?.id}
        onClose={() => setSelectedUserDetail(null)}
        onRequestSuspend={(u) => setUserToSuspend(u)}
        onResetRateLimit={(u) => handleResetRateLimit({ stopPropagation: () => {} } as any, u)}
      />

      {/* Suspend Confirmation Modal */}
      <SuspendConfirmModal
        user={userToSuspend}
        isOpen={!!userToSuspend}
        isLoading={isSuspending}
        onClose={() => setUserToSuspend(null)}
        onConfirm={handleConfirmSuspend}
      />
    </div>
  );
}
