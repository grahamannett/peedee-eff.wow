import { useState, useEffect } from "react";
import Markdown from "react-markdown";
import { readTextFile } from "@tauri-apps/plugin-fs";

interface PreviewProps {
  markdownPath: string;
  onBack: () => void;
}

export function Preview({ markdownPath, onBack }: PreviewProps) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const text = await readTextFile(markdownPath);
        setContent(text);
      } catch (e) {
        setError(`Failed to read file: ${e}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [markdownPath]);

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
        <span className="text-sm text-text-muted truncate">{markdownPath}</span>
      </header>

      <main className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-64">
            <p className="text-text-muted">Loading preview...</p>
          </div>
        )}

        {error && (
          <div className="p-6">
            <p className="text-error">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <article className="max-w-3xl mx-auto px-8 py-6 prose-container">
            <Markdown
              components={{
                h1: ({ children }) => (
                  <h1 className="text-2xl font-bold mt-8 mb-4 text-text">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-xl font-semibold mt-6 mb-3 text-text">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-lg font-medium mt-5 mb-2 text-text">{children}</h3>
                ),
                p: ({ children }) => (
                  <p className="text-text leading-relaxed mb-4">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside mb-4 text-text space-y-1">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside mb-4 text-text space-y-1">{children}</ol>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-3 border-border pl-4 my-4 text-text-secondary italic">
                    {children}
                  </blockquote>
                ),
                code: ({ children, className }) => {
                  const isBlock = className?.includes("language-");
                  if (isBlock) {
                    return (
                      <pre className="bg-bg-tertiary rounded-lg p-4 my-4 overflow-x-auto">
                        <code className="text-sm font-mono text-text">{children}</code>
                      </pre>
                    );
                  }
                  return (
                    <code className="bg-bg-tertiary px-1.5 py-0.5 rounded text-sm font-mono">
                      {children}
                    </code>
                  );
                },
                img: ({ src, alt }) => (
                  <figure className="my-6">
                    <img
                      src={src}
                      alt={alt}
                      className="max-w-full rounded-lg border border-border"
                    />
                    {alt && (
                      <figcaption className="text-center text-xs text-text-muted mt-2">
                        {alt}
                      </figcaption>
                    )}
                  </figure>
                ),
                hr: () => <hr className="border-border my-8" />,
                table: ({ children }) => (
                  <div className="overflow-x-auto my-4">
                    <table className="w-full border-collapse border border-border text-sm">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border border-border bg-bg-tertiary px-3 py-2 text-left font-medium">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-border px-3 py-2">{children}</td>
                ),
              }}
            >
              {content}
            </Markdown>
          </article>
        )}
      </main>
    </div>
  );
}
