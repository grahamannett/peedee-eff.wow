import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { SidecarEvent } from "../types";

interface SetupScreenProps {
  onComplete: () => void;
}

export function SetupScreen({ onComplete }: SetupScreenProps) {
  const [status, setStatus] = useState<"checking" | "downloading" | "ready" | "error">("checking");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("Checking for OCR models...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unlisten = listen<SidecarEvent>("sidecar-event", (event) => {
      const msg = event.payload;

      if (msg.type === "model_status") {
        if (msg.downloaded) {
          setStatus("ready");
          setMessage("Models are ready!");
          setTimeout(onComplete, 500);
        } else {
          setStatus("downloading");
          setMessage("Downloading OCR models. This only happens once...");
          // Trigger download
          invoke("download_models", { engine: "marker" }).catch((e) => {
            setError(String(e));
            setStatus("error");
          });
        }
      }

      if (msg.type === "download_progress") {
        setProgress(msg.percent ?? 0);
        setMessage(msg.message ?? "Downloading...");
      }

      if (msg.type === "download_complete") {
        setStatus("ready");
        setMessage("Models downloaded successfully!");
        setProgress(100);
        setTimeout(onComplete, 1000);
      }

      if (msg.type === "error" && msg.message?.includes("model")) {
        setError(msg.message ?? "Download failed");
        setStatus("error");
      }
    });

    // Check model status after a brief delay (wait for sidecar to be ready)
    const timer = setTimeout(() => {
      invoke("check_model_status", { engine: "marker" }).catch(() => {
        // Sidecar may not be ready yet, retry
        setTimeout(() => {
          invoke("check_model_status", { engine: "marker" }).catch((e) => {
            setError(String(e));
            setStatus("error");
          });
        }, 2000);
      });
    }, 1500);

    return () => {
      clearTimeout(timer);
      unlisten.then((fn) => fn());
    };
  }, [onComplete]);

  const retry = () => {
    setError(null);
    setStatus("checking");
    setMessage("Retrying...");
    invoke("check_model_status", { engine: "marker" }).catch((e) => {
      setError(String(e));
      setStatus("error");
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">peedee-eff</h1>
          <p className="text-text-secondary mt-2">Setting up for first use</p>
        </div>

        <div className="space-y-4">
          {/* Status icon */}
          <div className="flex justify-center">
            {status === "checking" && (
              <div className="w-12 h-12 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            )}
            {status === "downloading" && (
              <div className="w-12 h-12 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            )}
            {status === "ready" && (
              <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
            {status === "error" && (
              <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-error">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
            )}
          </div>

          <p className="text-sm text-text-secondary">{message}</p>

          {/* Progress bar */}
          {status === "downloading" && (
            <div className="w-full h-2 rounded-full bg-bg-tertiary overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Error state */}
          {status === "error" && (
            <div className="space-y-3">
              <p className="text-xs text-error">{error}</p>
              <button
                onClick={retry}
                className="px-4 py-2 text-sm rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Skip option */}
          {(status === "checking" || status === "downloading") && (
            <button
              onClick={onComplete}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              Skip (you can download models later in Settings)
            </button>
          )}
        </div>

        <p className="text-xs text-text-muted">
          OCR models are ~2.5 GB and stored locally on your machine.
          <br />
          They enable high-quality text extraction from scanned PDFs.
        </p>
      </div>
    </div>
  );
}
