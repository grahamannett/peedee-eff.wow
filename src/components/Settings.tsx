import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { loadSettings, saveSettings, DEFAULT_SETTINGS, type AppSettings } from "../store";
import type { SidecarEvent } from "../types";

interface SettingsProps {
  onBack: () => void;
}

const LANGUAGES = [
  "English", "Spanish", "French", "German", "Italian", "Portuguese",
  "Chinese", "Japanese", "Korean", "Russian", "Arabic", "Hindi",
];

export function Settings({ onBack }: SettingsProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [modelsDownloaded, setModelsDownloaded] = useState<boolean | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadMessage, setDownloadMessage] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings().then(setSettings);
    invoke("check_model_status", { engine: "marker" }).catch(() => {});
  }, []);

  useEffect(() => {
    const unlisten = listen<SidecarEvent>("sidecar-event", (event) => {
      const msg = event.payload;
      if (msg.type === "model_status") {
        setModelsDownloaded(msg.downloaded ?? false);
      }
      if (msg.type === "download_progress") {
        setDownloadProgress(msg.percent ?? 0);
        setDownloadMessage(msg.message ?? "");
      }
      if (msg.type === "download_complete") {
        setModelsDownloaded(true);
        setDownloading(false);
        setDownloadProgress(100);
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const update = async (patch: Partial<AppSettings>) => {
    const updated = { ...settings, ...patch };
    setSettings(updated);
    await saveSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const pickDefaultOutputDir = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      update({ defaultOutputDir: selected as string });
    }
  };

  const redownloadModels = () => {
    setDownloading(true);
    setDownloadProgress(0);
    invoke("download_models", { engine: "marker" }).catch(() => {
      setDownloading(false);
    });
  };

  const opts = settings.defaultOptions;

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* Toolbar */}
      <header className="bevel-raised bg-bg-secondary flex items-center gap-2 px-3 py-1">
        <button onClick={onBack} className="btn text-xs">
          &lt; Back
        </button>
        <span className="text-xs font-bold">Settings</span>
        {saved && <span className="text-xs text-success ml-auto font-bold">Saved</span>}
      </header>

      <main className="flex-1 overflow-y-auto p-3 max-w-md mx-auto w-full space-y-3">
        {/* Default Output Format */}
        <fieldset className="group-box">
          <legend>Default Output Format</legend>
          <div className="flex gap-4">
            {["epub", "markdown"].map((fmt) => (
              <label key={fmt} className="flex items-center gap-1 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={opts.output_formats.includes(fmt)}
                  onChange={() => {
                    const formats = opts.output_formats.includes(fmt)
                      ? opts.output_formats.filter((f) => f !== fmt)
                      : [...opts.output_formats, fmt];
                    if (formats.length > 0) {
                      update({ defaultOptions: { ...opts, output_formats: formats } });
                    }
                  }}
                />
                {fmt.toUpperCase()}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Default OCR Options */}
        <fieldset className="group-box">
          <legend>Default OCR Options</legend>
          <div className="space-y-2">
            <label className="flex items-center gap-1 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={opts.force_ocr}
                onChange={(e) => update({ defaultOptions: { ...opts, force_ocr: e.target.checked } })}
              />
              Force OCR
            </label>
            <label className="flex items-center gap-1 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={opts.extract_images}
                onChange={(e) => update({ defaultOptions: { ...opts, extract_images: e.target.checked } })}
              />
              Extract images
            </label>
            <div>
              <label className="text-xs">Language:</label>
              <select
                value={opts.language}
                onChange={(e) => update({ defaultOptions: { ...opts, language: e.target.value } })}
                className="w-full mt-1"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        {/* Default Output Folder */}
        <fieldset className="group-box">
          <legend>Default Output Folder</legend>
          <div className="flex items-center gap-2">
            <button onClick={pickDefaultOutputDir} className="btn text-xs">
              Browse...
            </button>
            <span className="text-xs text-text-secondary truncate">
              {settings.defaultOutputDir || "(same as input file)"}
            </span>
          </div>
        </fieldset>

        {/* Model Management */}
        <fieldset className="group-box">
          <legend>Model Management</legend>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs">Marker OCR Models (~2.5 GB)</span>
              {modelsDownloaded === true && (
                <span className="text-xs text-success font-bold">Downloaded</span>
              )}
              {modelsDownloaded === false && (
                <span className="text-xs text-text-muted">Not downloaded</span>
              )}
              {modelsDownloaded === null && (
                <span className="text-xs text-text-muted">Checking...</span>
              )}
            </div>

            {downloading && (
              <div className="space-y-1">
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-text-muted">{downloadMessage}</p>
              </div>
            )}

            <button
              onClick={redownloadModels}
              disabled={downloading}
              className="btn text-xs"
            >
              {modelsDownloaded ? "Re-download" : "Download"}
            </button>
          </div>
        </fieldset>

        {/* About */}
        <fieldset className="group-box">
          <legend>About</legend>
          <div className="space-y-1">
            <p className="text-xs font-bold">peedee-eff v0.1.0</p>
            <p className="text-xs text-text-secondary">
              Scanned PDF to EPUB & Markdown. Local OCR, no cloud.
            </p>
            <p className="text-xs text-text-muted">
              Tauri + React + Marker
            </p>
          </div>
        </fieldset>
      </main>
    </div>
  );
}
