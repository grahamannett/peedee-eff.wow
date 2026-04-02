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
    <div className="min-h-screen flex flex-col bg-bg">
      {/* Toolbar */}
      <header className="bevel-raised bg-bg-secondary flex items-center gap-2 px-3 py-1">
        <button onClick={onBack} className="btn text-xs">
          &lt; Back
        </button>
        <span className="text-xs text-text-muted truncate">{markdownPath}</span>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-32">
            <p className="text-xs text-text-muted">Loading...</p>
          </div>
        )}

        {error && (
          <div className="p-3">
            <p className="text-xs text-error">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <article className="bevel-inset bg-bg-inset m-3 p-6 max-w-2xl mx-auto">
            <Markdown
              components={{
                h1: ({ children }) => (
                  <h1 className="text-lg font-bold mt-6 mb-3">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-base font-bold mt-5 mb-2">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-bold mt-4 mb-2">{children}</h3>
                ),
                p: ({ children }) => (
                  <p className="text-xs leading-relaxed mb-3">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside mb-3 text-xs space-y-1">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside mb-3 text-xs space-y-1">{children}</ol>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-border pl-3 my-3 text-text-secondary italic text-xs">
                    {children}
                  </blockquote>
                ),
                code: ({ children, className }) => {
                  const isBlock = className?.includes("language-");
                  if (isBlock) {
                    return (
                      <pre className="bevel-inset bg-bg-tertiary p-3 my-3 overflow-x-auto">
                        <code className="text-xs font-mono">{children}</code>
                      </pre>
                    );
                  }
                  return (
                    <code className="bg-bg-tertiary px-1 text-xs font-mono">
                      {children}
                    </code>
                  );
                },
                img: ({ src, alt }) => (
                  <figure className="my-4">
                    <img
                      src={src}
                      alt={alt}
                      className="max-w-full bevel-inset"
                    />
                    {alt && (
                      <figcaption className="text-center text-xs text-text-muted mt-1">
                        {alt}
                      </figcaption>
                    )}
                  </figure>
                ),
                hr: () => <div className="etch my-4" />,
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3">
                    <table className="w-full border-collapse text-xs bevel-inset">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border border-border bg-bg-secondary p-1 text-left font-bold text-xs">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-border p-1 text-xs">{children}</td>
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
