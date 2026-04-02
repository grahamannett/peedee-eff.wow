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
        bevel-inset flex flex-col items-center justify-center
        w-full py-8 cursor-pointer
        ${isDragOver ? "bg-bg-inset" : "bg-bg-tertiary"}
        ${disabled ? "opacity-50 cursor-default" : ""}
      `}
    >
      <p className="text-sm font-bold mb-1">Drop PDF files here</p>
      <p className="text-text-muted text-xs">or click to browse</p>
    </div>
  );
}
