import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import { DropZone } from "./components/DropZone";
import { FileList } from "./components/FileList";
import { OptionsPanel } from "./components/OptionsPanel";
import { Preview } from "./components/Preview";
import { Settings } from "./components/Settings";
import { SetupScreen } from "./components/SetupScreen";
import { DEFAULT_SETTINGS, loadSettings } from "./store";
import type { ConversionOptions, QueuedFile, SidecarEvent } from "./types";

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
			} catch {
				/* sidecar not ready yet */
			}
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
								: f,
						),
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
								: f,
						),
					);
					jobToFile.delete(msg.id);
				}
				// Check if all files are done
				setFiles((prev) => {
					const allDone = prev.every(
						(f) => f.status === "complete" || f.status === "error",
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
								: f,
						),
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
		if (files.length === 0) return;

		setConverting(true);

		const queuedFiles = files.filter((f) => f.status === "queued");
		for (const file of queuedFiles) {
			// Use selected output dir, or fall back to the input file's directory
			const fileDir = file.path.substring(0, file.path.lastIndexOf("/"));
			const targetDir = outputDir || fileDir;
			try {
				const result = await invoke<{ id: string }>("start_conversion", {
					pdfPath: file.path,
					outputDir: targetDir,
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
							? {
									...f,
									status: "converting",
									progress: 0,
									progressMessage: "Starting...",
								}
							: f,
					),
				);
			} catch (e) {
				setFiles((prev) =>
					prev.map((f) =>
						f.id === file.id ? { ...f, status: "error", error: String(e) } : f,
					),
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
		return (
			<Preview markdownPath={previewPath} onBack={() => setPreviewPath(null)} />
		);
	}

	const hasQueuedFiles = files.some((f) => f.status === "queued");
	const canConvert = hasQueuedFiles && sidecarReady && !converting;

	const queuedCount = files.filter((f) => f.status === "queued").length;

	return (
		<div className="min-h-screen flex flex-col bg-bg">
			{/* Menu bar */}
			<header className="bevel-raised bg-bg-secondary flex items-center justify-between px-3 py-1">
				<div className="flex items-center gap-2">
					<span className="font-bold text-xs">peedee-eff</span>
					<span className="etch mx-1 h-3 w-0 border-l border-border border-r border-border-light" />
					<span className="text-xs text-text-muted">
						PDF to EPUB & Markdown
					</span>
				</div>
				<div className="flex items-center gap-2">
					{sidecarReady ? (
						<span className="text-xs text-success font-bold">● Ready</span>
					) : (
						<span className="text-xs text-text-muted">○ Starting...</span>
					)}
					<button
						onClick={() => setShowSettings(true)}
						className="btn text-xs px-2"
					>
						Settings
					</button>
				</div>
			</header>

			{/* Main content */}
			<main className="flex-1 p-3 max-w-xl mx-auto w-full space-y-3">
				<DropZone onFilesAdded={addFiles} disabled={converting} />

				<FileList
					files={files}
					onRemove={removeFile}
					onPreview={(path) => setPreviewPath(path)}
				/>

				{files.length > 0 && (
					<div className="space-y-3">
						<OptionsPanel
							options={options}
							onChange={setOptions}
							disabled={converting}
						/>

						{/* Output folder */}
						<fieldset className="group-box">
							<legend>Output Folder</legend>
							<div className="flex items-center gap-2">
								<button
									onClick={pickOutputDir}
									disabled={converting}
									className="btn text-xs"
								>
									Browse...
								</button>
								<span className="text-xs text-text-secondary truncate">
									{outputDir || "(same as input file)"}
								</span>
							</div>
						</fieldset>

						{/* Convert button */}
						<button
							onClick={startConversion}
							disabled={!canConvert}
							className="btn btn-primary w-full text-xs font-bold py-1"
						>
							{converting
								? "Converting..."
								: `Convert ${queuedCount} file${queuedCount !== 1 ? "s" : ""}`}
						</button>
					</div>
				)}
			</main>

			{/* Status bar */}
			<footer className="bevel-raised bg-bg-secondary px-3 py-1 flex items-center">
				<span className="text-xs text-text-muted">
					{files.length === 0
						? "Drop a PDF to begin"
						: `${files.length} file${files.length !== 1 ? "s" : ""} loaded`}
				</span>
			</footer>
		</div>
	);
}

export default App;
