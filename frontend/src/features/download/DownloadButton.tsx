import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { downloadJob } from "../../api/jobs";
import type { Job } from "../../api/types";

export function DownloadButton({ job }: { job: Job }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setLoading(true);
    setError(null);
    try {
      await downloadJob(job.id, `${job.plan?.name?.replace(/\s+/g, "-").toLowerCase() ?? "project"}.zip`);
    } catch {
      setError("Download failed. The archive may have expired.");
    } finally {
      setLoading(false);
    }
  }

  if (job.status !== "done") return null;

  return (
    <div>
      <button
        onClick={handleDownload}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg bg-success/90 px-4 py-2 text-sm font-medium text-white hover:bg-success disabled:opacity-50"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        Download project
      </button>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      {job.files_failed && Object.keys(job.files_failed).length > 0 && (
        <p className="mt-1 text-xs text-warning">
          {Object.keys(job.files_failed).length} file(s) failed to generate -- see GENERATION_MANIFEST.json in the download.
        </p>
      )}
    </div>
  );
}
