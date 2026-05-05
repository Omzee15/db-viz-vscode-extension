import { useState, useEffect, useRef, useCallback } from "react";
import DBViewer from "./DBViewer";
import {
  Save,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Database,
} from "lucide-react";

// ── VS Code webview API ────────────────────────────────────────────────────
declare function acquireVsCodeApi(): {
  postMessage: (msg: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

// acquireVsCodeApi() must be called exactly once at module level.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const vscode: ReturnType<typeof acquireVsCodeApi> = (typeof acquireVsCodeApi !== "undefined")
  ? acquireVsCodeApi()
  : ({ postMessage: () => {}, getState: () => ({}), setState: () => {} } as ReturnType<typeof acquireVsCodeApi>);

// ─── Types ──────────────────────────────────────────────────────────────────

interface AppMessage {
  type: "init" | "update" | "saved";
  content?: string;
  fileName?: string;
  layoutData?: string;
}

// ─── App ────────────────────────────────────────────────────────────────────

export default function App() {
  const [fileName, setFileName] = useState("untitled.dbml");
  const [content, setContent] = useState("");
  const [layoutData, setLayoutData] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Editor content-search state (mirrors db-viz dashboard)
  const [showContentSearch, setShowContentSearch] = useState(false);
  const [contentSearch, setContentSearch] = useState("");
  const [lastMatchIndex, setLastMatchIndex] = useState(-1);
  const contentSearchInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Resizable split pane
  const [splitPos, setSplitPos] = useState(50); // percent
  const isResizing = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Receive messages from extension host ──────────────────────────────────
  useEffect(() => {
    const handler = (event: MessageEvent<AppMessage>) => {
      const msg = event.data;
      if (msg.type === "init") {
        setFileName(msg.fileName ?? "untitled.dbml");
        setContent(msg.content ?? "");
        setLayoutData(msg.layoutData ?? "");
        setHasChanges(false);
      } else if (msg.type === "update") {
        setContent(msg.content ?? "");
        setHasChanges(false);
      } else if (msg.type === "saved") {
        setIsSaving(false);
        setHasChanges(false);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1500);
      }
    };
    window.addEventListener("message", handler);
    // Signal the extension that the webview is ready to receive messages.
    // The extension will respond with an "init" message containing the file content.
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", handler);
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setShowContentSearch(true);
        setTimeout(() => contentSearchInputRef.current?.focus(), 50);
      }
      if (e.key === "Escape" && showContentSearch) {
        setShowContentSearch(false);
        setContentSearch("");
        setLastMatchIndex(-1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showContentSearch, content, hasChanges]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!hasChanges) return;
    setIsSaving(true);
    vscode.postMessage({ type: "save", content });
  }, [hasChanges, content]);

  // ── Content search (mirrors db-viz) ──────────────────────────────────────
  const runContentSearch = (forceFromStart = false) => {
    const query = contentSearch.trim();
    if (!query || !editorRef.current) return;
    const haystack = content.toLowerCase();
    const needle = query.toLowerCase();
    const startIndex = forceFromStart || lastMatchIndex < 0 ? 0 : lastMatchIndex + 1;
    let nextIndex = haystack.indexOf(needle, startIndex);
    if (nextIndex === -1 && startIndex > 0) nextIndex = haystack.indexOf(needle, 0);
    if (nextIndex === -1) return;
    setLastMatchIndex(nextIndex);
    editorRef.current.focus();
    editorRef.current.setSelectionRange(nextIndex, nextIndex + needle.length);
    const lineHeightPx = 21;
    const lineIndex = content.slice(0, nextIndex).split("\n").length - 1;
    const targetTop = Math.max(0, lineIndex * lineHeightPx - editorRef.current.clientHeight / 2);
    editorRef.current.scrollTop = targetTop;
  };

  // ── Layout persistence ────────────────────────────────────────────────────
  const handleLayoutChange = useCallback((newLayout: string) => {
    setLayoutData(newLayout);
    vscode.postMessage({ type: "saveLayout", layoutData: newLayout });
  }, []);

  // ── Resizable split ───────────────────────────────────────────────────────
  const onMouseDownDivider = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;

    const onMouseMove = (ev: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newPos = ((ev.clientX - rect.left) / rect.width) * 100;
      setSplitPos(Math.min(Math.max(newPos, 20), 80));
    };
    const onMouseUp = () => {
      isResizing.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // ── Line numbers ──────────────────────────────────────────────────────────
  const lineCount = content.split("\n").length;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1).join("\n");

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        background: "#F5EFE7",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#FFFFFF",
          borderBottom: "1px solid #D9CDBF",
          padding: "0 16px",
          height: "48px",
          flexShrink: 0,
        }}
      >
        {/* Left: logo + filename */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Database style={{ width: "18px", height: "18px", color: "#9B8F5E" }} />
          <span style={{ fontSize: "14px", fontWeight: 600, color: "#3E2723" }}>
            {fileName}
          </span>
          {hasChanges && (
            <span
              style={{
                fontSize: "11px",
                background: "rgba(155,143,94,0.15)",
                color: "#9B8F5E",
                borderRadius: "4px",
                padding: "2px 7px",
                border: "1px solid #D9CDBF",
              }}
            >
              unsaved
            </span>
          )}
          {savedFlash && (
            <span
              style={{
                fontSize: "11px",
                background: "rgba(90,130,170,0.15)",
                color: "#5A82AA",
                borderRadius: "4px",
                padding: "2px 7px",
                border: "1px solid #5A82AA",
              }}
            >
              saved ✓
            </span>
          )}
        </div>

        {/* Right: save button */}
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            background: hasChanges ? "#9B8F5E" : "#EBE3D5",
            color: hasChanges ? "#FFFFFF" : "#8B7355",
            border: "1px solid #D9CDBF",
            borderRadius: "6px",
            padding: "6px 14px",
            cursor: !hasChanges || isSaving ? "not-allowed" : "pointer",
            opacity: isSaving ? 0.7 : 1,
            transition: "background 0.15s",
          }}
        >
          <Save style={{ width: "14px", height: "14px" }} />
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>

      {/* ── Main Split Pane ──────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}
      >
        {/* ── Editor Pane ─────────────────────────────────────────────── */}
        <div
          style={{
            width: `${splitPos}%`,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            borderRight: "1px solid #D9CDBF",
          }}
        >
          {/* Editor toolbar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#FFFFFF",
              borderBottom: "1px solid #D9CDBF",
              padding: "6px 14px",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: "12px", color: "#8B7355", fontWeight: 500 }}>
              EDITOR
            </span>
            <button
              onClick={() => {
                setShowContentSearch(!showContentSearch);
                if (!showContentSearch)
                  setTimeout(() => contentSearchInputRef.current?.focus(), 50);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "12px",
                background: showContentSearch ? "#EBE3D5" : "transparent",
                border: showContentSearch ? "1px solid #D9CDBF" : "1px solid transparent",
                borderRadius: "4px",
                color: "#8B7355",
                padding: "3px 8px",
                cursor: "pointer",
              }}
              title="Search in editor (Ctrl+F)"
            >
              <Search style={{ width: "12px", height: "12px" }} />
              Find
            </button>
          </div>

          {/* Content search bar (mirrors db-viz) */}
          {showContentSearch && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "#F5EEE5",
                borderBottom: "1px solid #D9CDBF",
                padding: "6px 10px",
                flexShrink: 0,
              }}
            >
              <Search style={{ width: "14px", height: "14px", color: "#8B7355", flexShrink: 0 }} />
              <input
                ref={contentSearchInputRef}
                type="text"
                value={contentSearch}
                onChange={(e) => {
                  setContentSearch(e.target.value);
                  setLastMatchIndex(-1);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runContentSearch(false);
                  } else if (e.key === "Escape") {
                    setShowContentSearch(false);
                    setContentSearch("");
                    setLastMatchIndex(-1);
                  }
                }}
                placeholder="Find in editor…"
                style={{
                  flex: 1,
                  fontSize: "13px",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#3E2723",
                }}
              />
              <button
                onClick={() => runContentSearch(false)}
                title="Find next"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#8B7355", padding: "2px" }}
              >
                <ChevronDown style={{ width: "14px", height: "14px" }} />
              </button>
              <button
                onClick={() => {
                  const query = contentSearch.trim();
                  if (!query || !editorRef.current) return;
                  const haystack = content.toLowerCase();
                  const needle = query.toLowerCase();
                  const searchFrom = lastMatchIndex > 0 ? lastMatchIndex - 1 : haystack.length - 1;
                  let idx = haystack.lastIndexOf(needle, searchFrom);
                  if (idx === -1) idx = haystack.lastIndexOf(needle);
                  if (idx === -1) return;
                  setLastMatchIndex(idx);
                  editorRef.current.focus();
                  editorRef.current.setSelectionRange(idx, idx + needle.length);
                }}
                title="Find previous"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#8B7355", padding: "2px" }}
              >
                <ChevronUp style={{ width: "14px", height: "14px" }} />
              </button>
              <button
                onClick={() => { setShowContentSearch(false); setContentSearch(""); setLastMatchIndex(-1); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#8B7355", padding: "2px" }}
              >
                <X style={{ width: "14px", height: "14px" }} />
              </button>
            </div>
          )}

          {/* Editor with line numbers */}
          <div
            style={{
              flex: 1,
              display: "flex",
              overflow: "hidden",
              background: "#FDFAF6",
            }}
          >
            {/* Line numbers */}
            <div
              aria-hidden="true"
              style={{
                padding: "14px 10px 14px 14px",
                background: "#F0E8DC",
                borderRight: "1px solid #D9CDBF",
                color: "#A89878",
                fontSize: "13px",
                lineHeight: "21px",
                fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
                textAlign: "right",
                userSelect: "none",
                overflowY: "hidden",
                minWidth: "42px",
                whiteSpace: "pre",
              }}
            >
              {lineNumbers}
            </div>

            {/* Textarea */}
            <textarea
              ref={editorRef}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setHasChanges(true);
                setLastMatchIndex(-1);
              }}
              spellCheck={false}
              style={{
                flex: 1,
                padding: "14px",
                resize: "none",
                border: "none",
                outline: "none",
                background: "#FDFAF6",
                color: "#3E2723",
                fontSize: "13px",
                lineHeight: "21px",
                fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
                overflowY: "auto",
                overflowX: "auto",
                whiteSpace: "pre",
                tabSize: 2,
              }}
            />
          </div>
        </div>

        {/* ── Divider ─────────────────────────────────────────────────── */}
        <div
          onMouseDown={onMouseDownDivider}
          style={{
            width: "5px",
            background: "#D9CDBF",
            cursor: "col-resize",
            flexShrink: 0,
            transition: "background 0.1s",
          }}
          onMouseEnter={(e) => ((e.target as HTMLElement).style.background = "#9B8F5E")}
          onMouseLeave={(e) => ((e.target as HTMLElement).style.background = "#D9CDBF")}
        />

        {/* ── Diagram Pane ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {/* Diagram toolbar label */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "#FFFFFF",
              borderBottom: "1px solid #D9CDBF",
              padding: "6px 14px",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: "12px", color: "#8B7355", fontWeight: 500 }}>
              ERD DIAGRAM
            </span>
          </div>

          <div style={{ flex: 1, overflow: "hidden" }}>
            <DBViewer
              dbmlContent={content}
              fileName={fileName}
              layoutData={layoutData}
              onLayoutChange={handleLayoutChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
