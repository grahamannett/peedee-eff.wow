import { open as shellOpen } from "@tauri-apps/plugin-shell";
import type { QueuedFile } from "../types";

interface FileListProps {
  files: QueuedFile[];
  onRemove: (id: string) => void;
  onPreview: (markdownPath: string) => void;
}

function StatusLabel({ file }: { file: QueuedFile }) {
  switch (file.status) {
    case "queued":
      return <span className="text-text-muted">Queued</span>;
    case "converting":
      return <span className="text-accent font-bold">{Math.round(file.progress)}%</span>;
    case "complete":
      return <span className="text-success font-bold">Done</span>;
    case "error":
      return <span className="text-error font-bold">Error</span>;
  }
}

export function FileList({ files, onRemove, onPreview }: FileListProps) {
  if (files.length === 0) return null;

  const showInFinder = (path: string) => {
    const dir = path.substring(0, path.lastIndexOf("/"));
    shellOpen(dir);
  };

  return (
    <div className="bevel-inset bg-bg-inset p-1">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-bg-secondary text-left">
            <th className="p-1 font-bold">File</th>
            <th className="p-1 font-bold w-16">Status</th>
            <th className="p-1 font-bold w-20"></th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.id} className="border-b border-bg-secondary">
              <td className="p-1">
                <div className="font-bold">{file.name}</div>
                {file.status === "converting" && file.progressMessage && (
                  <div className="text-text-muted">{file.progressMessage}</div>
                )}
                {file.status === "converting" && (
                  <div className="progress-track mt-1">
                    <div
                      className="progress-fill"
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                )}
                {file.status === "error" && file.error && (
                  <div className="text-error">{file.error}</div>
                )}
              </td>
              <td className="p-1">
                <StatusLabel file={file} />
              </td>
              <td className="p-1 text-right">
                {file.status === "queued" && (
                  <button
                    onClick={() => onRemove(file.id)}
                    className="btn text-xs px-2"
                  >
                    Remove
                  </button>
                )}
                {file.status === "complete" && (
                  <div className="flex gap-1 justify-end">
                    {file.outputs?.markdown && (
                      <button
                        onClick={() => onPreview(file.outputs!.markdown!)}
                        className="btn text-xs px-2"
                      >
                        Preview
                      </button>
                    )}
                    {file.outputs?.markdown && (
                      <button
                        onClick={() => showInFinder(file.outputs!.markdown!)}
                        className="btn text-xs px-2"
                      >
                        Reveal
                      </button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
