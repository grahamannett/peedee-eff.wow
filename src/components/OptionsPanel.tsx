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
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="btn w-full text-left text-xs font-bold"
      >
        {expanded ? "▼" : "►"} Options
      </button>

      {expanded && (
        <div className="bevel-inset bg-bg-tertiary p-3 mt-0 space-y-3">
          {/* Output Formats */}
          <fieldset className="group-box">
            <legend>Output Formats</legend>
            <div className="flex gap-4">
              {["epub", "markdown"].map((fmt) => (
                <label key={fmt} className="flex items-center gap-1 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={options.output_formats.includes(fmt)}
                    onChange={() => toggleFormat(fmt)}
                    disabled={disabled}
                  />
                  {fmt.toUpperCase()}
                </label>
              ))}
            </div>
          </fieldset>

          {/* OCR Options */}
          <fieldset className="group-box">
            <legend>OCR Options</legend>
            <div className="space-y-2">
              <label className="flex items-center gap-1 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={options.force_ocr}
                  onChange={(e) => update({ force_ocr: e.target.checked })}
                  disabled={disabled}
                />
                Force OCR (recommended for scans)
              </label>
              <label className="flex items-center gap-1 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={options.extract_images}
                  onChange={(e) => update({ extract_images: e.target.checked })}
                  disabled={disabled}
                />
                Extract images
              </label>
            </div>
          </fieldset>

          {/* Page Range */}
          <fieldset className="group-box">
            <legend>Page Range</legend>
            <input
              type="text"
              value={options.page_range}
              onChange={(e) => update({ page_range: e.target.value })}
              placeholder="e.g. 1-50, 55-100 (all if empty)"
              disabled={disabled}
              className="w-full"
            />
          </fieldset>

          {/* Language & Engine */}
          <div className="flex gap-3">
            <fieldset className="group-box flex-1">
              <legend>Language</legend>
              <select
                value={options.language}
                onChange={(e) => update({ language: e.target.value })}
                disabled={disabled}
                className="w-full"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </fieldset>
            <fieldset className="group-box flex-1">
              <legend>Engine</legend>
              <select
                value={options.engine}
                onChange={(e) => update({ engine: e.target.value })}
                disabled={disabled}
                className="w-full"
              >
                {ENGINES.map((eng) => (
                  <option key={eng.value} value={eng.value}>{eng.label}</option>
                ))}
              </select>
            </fieldset>
          </div>
        </div>
      )}
    </div>
  );
}
