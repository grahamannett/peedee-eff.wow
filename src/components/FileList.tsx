import { open as shellOpen } from "@tauri-apps/plugin-shell";
import type { QueuedFile } from "../types";

interface FileListProps {
  files: QueuedFile[];
  onRemove: (id: string) => void;
  onPreview: (markdownPath: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function StatusBadge({ file }: { file: QueuedFile }) {
  switch (file.status) {
    case "queued":
      return (
        <span className="text-xs text-text-muted px-2 py-0.5 rounded-full bg-bg-tertiary">
          Queued
        </span>
      );
    case "converting":
      return (
        <span className="text-xs text-accent px-2 py-0.5 rounded-full bg-accent/10">
          {Math.round(file.progress)}%
        </span>
      );
    case "complete":
      return (
        <span className="text-xs text-success px-2 py-0.5 rounded-full bg-success/10">
          Done
        </span>
      );
    case "error":
      return (
        <span className="text-xs text-error px-2 py-0.5 rounded-full bg-error/10">
          Failed
        </span>
      );
  }
}

export function FileList({ files, onRemove, onPreview }: FileListProps) {
  if (files.length === 0) return null;

  const showInFinder = (path: string) => {
    // Open the parent directory
    const dir = path.substring(0, path.lastIndexOf("/"));
    shellOpen(dir);
  };

  return (
    <div className="w-full space-y-2">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center gap-3 p-3 rounded-lg bg-bg-secondary border border-border"
        >
          <div className="shrink-0 text-text-muted">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-text-muted">
                {formatBytes(file.size)}
              </span>
              {file.status === "converting" && file.progressMessage && (
                <span className="text-xs text-text-muted truncate">
                  {file.progressMessage}
                </span>
              )}
              {file.status === "error" && file.error && (
                <span className="text-xs text-error truncate">
                  {file.error}
                </span>
              )}
            </div>
            {file.status === "converting" && (
              <div className="mt-2 h-1 rounded-full bg-bg-tertiary overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{ width: `${file.progress}%` }}
                />
              </div>
            )}
            {file.status === "complete" && (
              <div className="flex gap-2 mt-2">
                {file.outputs?.markdown && (
                  <button
                    onClick={() => onPreview(file.outputs!.markdown!)}
                    className="text-xs px-2 py-1 rounded bg-bg-tertiary text-text-secondary hover:text-text transition-colors"
                  >
                    Preview
                  </button>
                )}
                {file.outputs?.markdown && (
                  <button
                    onClick={() => showInFinder(file.outputs!.markdown!)}
                    className="text-xs px-2 py-1 rounded bg-bg-tertiary text-text-secondary hover:text-text transition-colors"
                  >
                    Show in Finder
                  </button>
                )}
              </div>
            )}
          </div>
          <StatusBadge file={file} />
          {file.status === "queued" && (
            <button
              onClick={() => onRemove(file.id)}
              className="shrink-0 p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-text transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
