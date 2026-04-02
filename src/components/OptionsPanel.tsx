import { useState } from "react";
import type { ConversionOptions } from "../types";

interface OptionsPanelProps {
  options: ConversionOptions;
  onChange: (options: ConversionOptions) => void;
  disabled?: boolean;
}

const LANGUAGES = [
  "English", "Spanish", "French", "German", "Italian", "Portuguese",
  "Chinese", "Japanese", "Korean", "Russian", "Arabic", "Hindi",
];

const ENGINES = [
  { value: "mock", label: "Mock (Testing)" },
  { value: "marker", label: "Marker" },
];

export function OptionsPanel({ options, onChange, disabled }: OptionsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const update = (patch: Partial<ConversionOptions>) => {
    onChange({ ...options, ...patch });
  };

  const toggleFormat = (format: string) => {
    const formats = options.output_formats.includes(format)
      ? options.output_formats.filter((f) => f !== format)
      : [...options.output_formats, format];
    if (formats.length > 0) update({ output_formats: formats });
  };

  return (
    <div className="w-full border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-sm font-medium text-text-secondary hover:text-text hover:bg-bg-secondary transition-colors"
      >
        <span>Conversion Options</span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="p-4 pt-0 space-y-4 border-t border-border">
          {/* Output Formats */}
          <div className="pt-3">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Output Formats
            </label>
            <div className="flex gap-3 mt-2">
              {["epub", "markdown"].map((fmt) => (
                <label key={fmt} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.output_formats.includes(fmt)}
                    onChange={() => toggleFormat(fmt)}
                    disabled={disabled}
                    className="accent-accent"
                  />
                  <span className="text-sm capitalize">{fmt}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Force OCR */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options.force_ocr}
                onChange={(e) => update({ force_ocr: e.target.checked })}
                disabled={disabled}
                className="accent-accent"
              />
              <span className="text-sm">Force OCR</span>
              <span className="text-xs text-text-muted">(recommended for scanned PDFs)</span>
            </label>
          </div>

          {/* Extract Images */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options.extract_images}
                onChange={(e) => update({ extract_images: e.target.checked })}
                disabled={disabled}
                className="accent-accent"
              />
              <span className="text-sm">Extract images</span>
            </label>
          </div>

          {/* Page Range */}
          <div>
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Page Range
            </label>
            <input
              type="text"
              value={options.page_range}
              onChange={(e) => update({ page_range: e.target.value })}
              placeholder="e.g. 1-50, 55-100 (leave empty for all)"
              disabled={disabled}
              className="mt-1 w-full px-3 py-2 text-sm rounded-lg bg-bg-tertiary border border-border text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          {/* Language */}
          <div>
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Language
            </label>
            <select
              value={options.language}
              onChange={(e) => update({ language: e.target.value })}
              disabled={disabled}
              className="mt-1 w-full px-3 py-2 text-sm rounded-lg bg-bg-tertiary border border-border text-text focus:outline-none focus:border-accent"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          {/* Engine */}
          <div>
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
              OCR Engine
            </label>
            <select
              value={options.engine}
              onChange={(e) => update({ engine: e.target.value })}
              disabled={disabled}
              className="mt-1 w-full px-3 py-2 text-sm rounded-lg bg-bg-tertiary border border-border text-text focus:outline-none focus:border-accent"
            >
              {ENGINES.map((eng) => (
                <option key={eng.value} value={eng.value}>
                  {eng.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
