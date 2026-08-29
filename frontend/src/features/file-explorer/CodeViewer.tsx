import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { python } from "@codemirror/lang-python";
import { json } from "@codemirror/lang-json";
import { getJobFile } from "../../api/jobs";

function extensionFor(path: string) {
  if (path.endsWith(".py")) return [python()];
  if (path.endsWith(".json")) return [json()];
  if (path.endsWith(".css")) return [css()];
  if (path.endsWith(".html")) return [html()];
  if (/\.(jsx?|tsx?)$/.test(path)) return [javascript({ jsx: true, typescript: path.endsWith("x") })];
  return [];
}

export function CodeViewer({ jobId, path }: { jobId: string; path: string | null }) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setContent("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getJobFile(jobId, path)
      .then((res) => {
        if (!cancelled) setContent(res.content);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load file");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, path]);

  if (!path) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-border bg-surface text-sm text-slate-500">
        Select a file to view its content
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-3 py-2 font-mono text-xs text-slate-400">{path}</div>
      <div className="flex-1 overflow-auto">
        {loading && <div className="p-4 text-sm text-slate-500">Loading...</div>}
        {error && <div className="p-4 text-sm text-danger">{error}</div>}
        {!loading && !error && (
          <CodeMirror
            value={content}
            theme="dark"
            extensions={extensionFor(path)}
            editable={false}
            basicSetup={{ lineNumbers: true, foldGutter: true }}
          />
        )}
      </div>
    </div>
  );
}
