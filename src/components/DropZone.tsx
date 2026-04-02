import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";

interface DropZoneProps {
  onFilesAdded: (paths: string[]) => void;
  disabled?: boolean;
}

export function DropZone({ onFilesAdded, disabled }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    const unlisten = getCurrentWindow().onDragDropEvent((event) => {
      if (disabled) return;

      if (event.payload.type === "over") {
        setIsDragOver(true);
      } else if (event.payload.type === "drop") {
        setIsDragOver(false);
        const pdfPaths = event.payload.paths.filter((p: string) =>
          p.toLowerCase().endsWith(".pdf")
        );
        if (pdfPaths.length > 0) onFilesAdded(pdfPaths);
      } else {
        setIsDragOver(false);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [onFilesAdded, disabled]);

  const handleBrowse = async () => {
    if (disabled) return;
    const selected = await open({
      multiple: true,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (selected) {
      const paths = Array.isArray(selected) ? selected : [selected];
      onFilesAdded(paths);
    }
  };

  return (
    <div
      onClick={handleBrowse}
      className={`
        flex flex-col items-center justify-center
        w-full min-h-48 rounded-xl border-2 border-dashed
        cursor-pointer transition-all duration-200
        ${
          isDragOver
            ? "border-accent bg-accent/5 scale-[1.01]"
            : "border-border hover:border-border-hover hover:bg-bg-secondary"
        }
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      <div className="text-4xl mb-3 opacity-40">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="12" y2="12" />
          <line x1="15" y1="15" x2="12" y2="12" />
        </svg>
      </div>
      <p className="text-text-secondary text-sm font-medium">
        Drop PDF files here
      </p>
      <p className="text-text-muted text-xs mt-1">or click to browse</p>
    </div>
  );
}
