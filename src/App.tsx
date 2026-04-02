import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { DropZone } from "./components/DropZone";
import { FileList } from "./components/FileList";
import { OptionsPanel } from "./components/OptionsPanel";
import { Preview } from "./components/Preview";
import { SetupScreen } from "./components/SetupScreen";
import { Settings } from "./components/Settings";
import { loadSettings, DEFAULT_SETTINGS } from "./store";
import type { QueuedFile, ConversionOptions, SidecarEvent } from "./types";

const DEFAULT_OPTIONS = DEFAULT_SETTINGS.defaultOptions;

// Maps job IDs to file IDs so we can route sidecar events to the right file
const jobToFile = new Map<string, string>();

function App() {
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [options, setOptions] = useState<ConversionOptions>(DEFAULT_OPTIONS);
  const [outputDir, setOutputDir] = useState<string>("");
  const [sidecarReady, setSidecarReady] = useState(false);
  const [converting, setConverting] = useState(false);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [setupDone, setSetupDone] = useState(() => {
    return localStorage.getItem("peedee-eff-setup-done") === "true";
  });

  const completeSetup = useCallback(() => {
    localStorage.setItem("peedee-eff-setup-done", "true");
    setSetupDone(true);
  }, []);

  // Load saved settings on mount
  useEffect(() => {
    loadSettings().then((s) => {
      setOptions(s.defaultOptions);
      if (s.defaultOutputDir) setOutputDir(s.defaultOutputDir);
      if (s.setupDone) setSetupDone(true);
    });
  }, []);

  // Poll for sidecar readiness (handles race condition where Ready event
  // fires before the frontend listener is registered)
  useEffect(() => {
    const checkReady = async () => {
      try {
        const ready = await invoke<boolean>("is_sidecar_ready");
        if (ready) setSidecarReady(true);
      } catch { /* sidecar not ready yet */ }
    };
    checkReady();
    const interval = setInterval(checkReady, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unlisten = listen<SidecarEvent>("sidecar-event", (event) => {
      const msg = event.payload;

      if (msg.type === "ready") {
        setSidecarReady(true);
        return;
      }

      if (msg.type === "progress" && msg.id) {
        const fileId = jobToFile.get(msg.id);
        if (fileId) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? {
                    ...f,
                    status: "converting",
                    progress: msg.percent ?? f.progress,
                    progressMessage: msg.message ?? f.progressMessage,
                  }
                : f
            )
          );
        }
      }

      if (msg.type === "complete" && msg.id) {
        const fileId = jobToFile.get(msg.id);
        if (fileId) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? {
                    ...f,
                    status: "complete",
                    progress: 100,
                    progressMessage: "Done",
                    outputs: msg.outputs as QueuedFile["outputs"],
                  }
                : f
            )
          );
          jobToFile.delete(msg.id);
        }
        // Check if all files are done
        setFiles((prev) => {
          const allDone = prev.every(
            (f) => f.status === "complete" || f.status === "error"
          );
          if (allDone) setConverting(false);
          return prev;
        });
      }

      if (msg.type === "error" && msg.id) {
        const fileId = jobToFile.get(msg.id);
        if (fileId) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? {
                    ...f,
                    status: "error",
                    error: msg.message,
                  }
                : f
            )
          );
          jobToFile.delete(msg.id);
        }
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const addFiles = useCallback((paths: string[]) => {
    const queued: QueuedFile[] = paths.map((p) => ({
      id: crypto.randomUUID(),
      path: p,
      name: p.split("/").pop() ?? p,
      size: 0,
      status: "queued",
      progress: 0,
      progressMessage: "",
    }));
    setFiles((prev) => [...prev, ...queued]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const pickOutputDir = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) setOutputDir(selected as string);
  };

  const startConversion = async () => {
    if (!outputDir || files.length === 0) return;

    setConverting(true);

    const queuedFiles = files.filter((f) => f.status === "queued");
    for (const file of queuedFiles) {
      try {
        const result = await invoke<{ id: string }>("start_conversion", {
          pdfPath: file.path,
          outputDir,
          options: {
            force_ocr: options.force_ocr,
            page_range: options.page_range || null,
            language: options.language,
            extract_images: options.extract_images,
            output_formats: options.output_formats,
            engine: options.engine,
          },
        });

        jobToFile.set(result.id, file.id);

        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? { ...f, status: "converting", progress: 0, progressMessage: "Starting..." }
              : f
          )
        );
      } catch (e) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? { ...f, status: "error", error: String(e) }
              : f
          )
        );
      }
    }
  };

  // Setup screen on first launch
  if (!setupDone) {
    return <SetupScreen onComplete={completeSetup} />;
  }

  // Settings view
  if (showSettings) {
    return <Settings onBack={() => setShowSettings(false)} />;
  }

  // Preview view
  if (previewPath) {
    return <Preview markdownPath={previewPath} onBack={() => setPreviewPath(null)} />;
  }

  const hasQueuedFiles = files.some((f) => f.status === "queued");
  const canConvert = hasQueuedFiles && outputDir && sidecarReady && !converting;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight">peedee-eff</h1>
          <span className="text-xs text-text-muted">PDF to EPUB & Markdown</span>
        </div>
        <div className="flex items-center gap-3">
          {sidecarReady ? (
            <span className="flex items-center gap-1.5 text-xs text-success">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              Ready
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-pulse" />
              Starting...
            </span>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-bg-secondary transition-colors"
            title="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-6 max-w-2xl mx-auto w-full space-y-4">
        <DropZone onFilesAdded={addFiles} disabled={converting} />

        <FileList
          files={files}
          onRemove={removeFile}
          onPreview={(path) => setPreviewPath(path)}
        />

        {files.length > 0 && (
          <>
            <OptionsPanel
              options={options}
              onChange={setOptions}
              disabled={converting}
            />

            {/* Output folder */}
            <div className="flex items-center gap-3">
              <button
                onClick={pickOutputDir}
                disabled={converting}
                className="shrink-0 px-4 py-2 text-sm rounded-lg border border-border text-text-secondary hover:text-text hover:border-border-hover hover:bg-bg-secondary transition-colors disabled:opacity-50"
              >
                {outputDir ? "Change folder" : "Choose output folder"}
              </button>
              {outputDir && (
                <span className="text-sm text-text-muted truncate">
                  {outputDir}
                </span>
              )}
            </div>

            {/* Convert button */}
            <button
              onClick={startConversion}
              disabled={!canConvert}
              className="w-full py-3 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {converting
                ? "Converting..."
                : `Convert ${files.filter((f) => f.status === "queued").length} file${files.filter((f) => f.status === "queued").length !== 1 ? "s" : ""}`}
            </button>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
