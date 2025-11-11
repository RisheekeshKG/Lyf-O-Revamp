import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Pencil, Eye } from "lucide-react";

interface DocumentViewProps {
  data: any;
  onChange: (newData: any) => void;
}

export const DocumentView: React.FC<DocumentViewProps> = ({ data, onChange }) => {
  const [content, setContent] = useState(data.content || "");
  const [previewMode, setPreviewMode] = useState(false);

  const handleContentChange = (value: string) => {
    setContent(value);
    onChange({ ...data, content: value });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="border-b border-gray-700 p-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{data.name}</h1>
        <button
          onClick={() => setPreviewMode(!previewMode)}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-md text-sm"
        >
          {previewMode ? <Pencil size={16} /> : <Eye size={16} />}
          {previewMode ? "Edit" : "Preview"}
        </button>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-auto bg-[#1f1f1f] text-gray-200 p-4">
        {previewMode ? (
          <div className="prose prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ inline, children, ...props }) {
                  return inline ? (
                    <code
                      {...props}
                      style={{
                        backgroundColor: "#2a2a2a",
                        color: "#7dd3fc",
                        padding: "2px 5px",
                        borderRadius: "4px",
                      }}
                    >
                      {children}
                    </code>
                  ) : (
                    <pre
                      style={{
                        backgroundColor: "#2a2a2a",
                        padding: "10px",
                        borderRadius: "6px",
                        overflowX: "auto",
                      }}
                    >
                      <code {...props}>{children}</code>
                    </pre>
                  );
                },
                a({ children, ...props }) {
                  return (
                    <a {...props} style={{ color: "#60a5fa", textDecoration: "underline" }}>
                      {children}
                    </a>
                  );
                },
                ul({ children, ...props }) {
                  return <ul style={{ marginLeft: "1.5rem", listStyleType: "disc" }} {...props}>{children}</ul>;
                },
                ol({ children, ...props }) {
                  return <ol style={{ marginLeft: "1.5rem", listStyleType: "decimal" }} {...props}>{children}</ol>;
                },
              }}
            >
              {content || "_Nothing here yet..._"}
            </ReactMarkdown>
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            className="w-full h-full bg-transparent text-gray-200 outline-none resize-none font-mono text-sm"
            placeholder="Write using Markdown syntax..."
          />
        )}
      </div>
    </div>
  );
};
