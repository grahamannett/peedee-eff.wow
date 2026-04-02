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
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <div className="h-4 w-px bg-border" />
        <span className="text-sm font-medium">Settings</span>
        {saved && (
          <span className="ml-auto text-xs text-success">Saved</span>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-6 max-w-xl mx-auto w-full space-y-8">
        {/* Default Output Format */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
            Default Output Format
          </h2>
          <div className="flex gap-4">
            {["epub", "markdown"].map((fmt) => (
              <label key={fmt} className="flex items-center gap-2 cursor-pointer">
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
                  className="accent-accent"
                />
                <span className="text-sm capitalize">{fmt}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Default OCR Options */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
            Default OCR Options
          </h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={opts.force_ocr}
              onChange={(e) => update({ defaultOptions: { ...opts, force_ocr: e.target.checked } })}
              className="accent-accent"
            />
            <span className="text-sm">Force OCR</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={opts.extract_images}
              onChange={(e) => update({ defaultOptions: { ...opts, extract_images: e.target.checked } })}
              className="accent-accent"
            />
            <span className="text-sm">Extract images</span>
          </label>
          <div>
            <label className="text-xs text-text-muted">Language</label>
            <select
              value={opts.language}
              onChange={(e) => update({ defaultOptions: { ...opts, language: e.target.value } })}
              className="mt-1 w-full px-3 py-2 text-sm rounded-lg bg-bg-tertiary border border-border text-text"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>
        </section>

        {/* Default Output Folder */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
            Default Output Folder
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={pickDefaultOutputDir}
              className="shrink-0 px-4 py-2 text-sm rounded-lg border border-border text-text-secondary hover:text-text hover:border-border-hover transition-colors"
            >
              {settings.defaultOutputDir ? "Change" : "Choose folder"}
            </button>
            {settings.defaultOutputDir ? (
              <span className="text-sm text-text-muted truncate">{settings.defaultOutputDir}</span>
            ) : (
              <span className="text-sm text-text-muted">Not set (will ask each time)</span>
            )}
          </div>
        </section>

        {/* Model Management */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
            Model Management
          </h2>
          <div className="p-4 rounded-lg bg-bg-secondary border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Marker OCR Models</p>
                <p className="text-xs text-text-muted">~2.5 GB &middot; Required for PDF conversion</p>
              </div>
              {modelsDownloaded === true && (
                <span className="text-xs text-success px-2 py-0.5 rounded-full bg-success/10">
                  Downloaded
                </span>
              )}
              {modelsDownloaded === false && (
                <span className="text-xs text-text-muted px-2 py-0.5 rounded-full bg-bg-tertiary">
                  Not downloaded
                </span>
              )}
              {modelsDownloaded === null && (
                <span className="text-xs text-text-muted">Checking...</span>
              )}
            </div>

            {downloading && (
              <div className="space-y-1">
                <div className="w-full h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-300"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-text-muted">{downloadMessage}</p>
              </div>
            )}

            <button
              onClick={redownloadModels}
              disabled={downloading}
              className="text-xs px-3 py-1.5 rounded-lg border border-border text-text-secondary hover:text-text hover:border-border-hover transition-colors disabled:opacity-50"
            >
              {modelsDownloaded ? "Re-download models" : "Download models"}
            </button>
          </div>
        </section>

        {/* About */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
            About
          </h2>
          <div className="p-4 rounded-lg bg-bg-secondary border border-border space-y-2">
            <p className="text-sm font-medium">peedee-eff v0.1.0</p>
            <p className="text-xs text-text-muted">
              Convert scanned PDFs to EPUB and Markdown with local OCR.
              Everything runs on your machine.
            </p>
            <div className="flex gap-4 text-xs text-text-muted">
              <span>Built with Tauri + React + Marker</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
