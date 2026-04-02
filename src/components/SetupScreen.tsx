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
          setMessage("Models are ready.");
          setTimeout(onComplete, 500);
        } else {
          setStatus("downloading");
          setMessage("Downloading OCR models. This only happens once...");
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
        setMessage("Models downloaded successfully.");
        setProgress(100);
        setTimeout(onComplete, 1000);
      }

      if (msg.type === "error" && msg.message?.includes("model")) {
        setError(msg.message ?? "Download failed");
        setStatus("error");
      }
    });

    const timer = setTimeout(() => {
      invoke("check_model_status", { engine: "marker" }).catch(() => {
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg p-6">
      <div className="bevel-raised bg-bg-secondary p-6 max-w-sm w-full space-y-4">
        <h1 className="font-bold text-sm text-center">peedee-eff Setup</h1>
        <div className="etch" />

        <p className="text-xs text-center">{message}</p>

        {status === "downloading" && (
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {status === "error" && (
          <div className="space-y-2">
            <p className="text-xs text-error">{error}</p>
            <button onClick={retry} className="btn btn-primary text-xs w-full">
              Retry
            </button>
          </div>
        )}

        {status === "ready" && (
          <p className="text-xs text-success text-center font-bold">Ready.</p>
        )}

        <div className="etch" />

        {(status === "checking" || status === "downloading") && (
          <button onClick={onComplete} className="btn text-xs w-full">
            Skip
          </button>
        )}

        <p className="text-xs text-text-muted text-center">
          OCR models (~2.5 GB) are stored locally.
        </p>
      </div>
    </div>
  );
}
