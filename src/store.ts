import { load } from "@tauri-apps/plugin-store";
import type { ConversionOptions } from "./types";

const STORE_PATH = "settings.json";

export interface AppSettings {
  defaultOptions: ConversionOptions;
  defaultOutputDir: string;
  setupDone: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultOptions: {
    force_ocr: true,
    page_range: "",
    language: "English",
    extract_images: true,
    output_formats: ["epub", "markdown"],
    engine: "marker",
  },
  defaultOutputDir: "",
  setupDone: false,
};

let storeInstance: Awaited<ReturnType<typeof load>> | null = null;

async function getStore() {
  if (!storeInstance) {
    storeInstance = await load(STORE_PATH, { autoSave: true, defaults: {} });
  }
  return storeInstance;
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const store = await getStore();
    const settings = await store.get<AppSettings>("settings");
    return settings ?? DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const store = await getStore();
  await store.set("settings", settings);
}
