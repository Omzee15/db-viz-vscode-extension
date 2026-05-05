import { useState, useCallback, useEffect, useRef } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Panel,
  Handle,
  Position,
  type NodeProps,
} from "@xyflow/react";
import { Parser, importer } from "@dbml/core";
import { Database, ZoomIn, Eye, EyeOff, Search } from "lucide-react";

interface Column {
  name: string;
  type: string;
  isPrimary: boolean;
  isForeign: boolean;
  isUnique: boolean;
  notNull: boolean;
}

interface TableNodeData extends Record<string, unknown> {
  name: string;
  columns: Column[];
}

type TableNodeType = Node<TableNodeData, "table">;

export interface DBViewerProps {
  dbmlContent: string;
  fileName: string;
  layoutData: string;
  onLayoutChange: (layoutData: string) => void;
  onTableSelect?: (tableName: string) => void;
}

// ─── Custom Table Node ────────────────────────────────────────────────────────

function TableNode({ data }: NodeProps<TableNodeType>) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [eyeHover, setEyeHover] = useState(false);

  return (
    <div
      style={{
        position: "relative",
        borderRadius: "8px",
        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.10), 0 2px 4px -1px rgba(0,0,0,0.06)",
        minWidth: "250px",
        maxWidth: "350px",
        overflow: "hidden",
        background: "#E8DFD0",
        border: "1px solid #D9CDBF",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: "transparent", border: "none", opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ background: "transparent", border: "none", opacity: 0 }} />
      <Handle type="target" position={Position.Top} style={{ background: "transparent", border: "none", opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: "transparent", border: "none", opacity: 0 }} />

      {/* Header */}
      <div
        style={{
          background: "#9B8F5E",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontWeight: 600,
          fontSize: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#FFFFFF" }}>
          <Database style={{ width: "16px", height: "16px", flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.name}</span>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          onMouseEnter={() => setEyeHover(true)}
          onMouseLeave={() => setEyeHover(false)}
          style={{
            padding: "4px",
            background: eyeHover ? "rgba(255,255,255,0.2)" : "transparent",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {isExpanded ? <EyeOff style={{ width: "12px", height: "12px" }} /> : <Eye style={{ width: "12px", height: "12px" }} />}
        </button>
      </div>

      {/* Columns */}
      {isExpanded && (
        <div style={{ padding: "8px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            {data.columns?.map((col, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "12px",
                  borderRadius: "4px",
                  padding: "5px 8px",
                  background: col.isPrimary
                    ? "rgba(196,117,108,0.15)"
                    : col.isForeign
                    ? "rgba(90,130,170,0.15)"
                    : "transparent",
                  borderLeft: col.isPrimary
                    ? "3px solid #C4756C"
                    : col.isForeign
                    ? "3px solid #5A82AA"
                    : "3px solid transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0, gap: "8px" }}>
                  <span
                    style={{
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: col.isPrimary ? "#C4756C" : col.isForeign ? "#5A82AA" : "#3E2723",
                    }}
                  >
                    {col.name}
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      flexShrink: 0,
                      background: col.isPrimary ? "#C4756C" : col.isForeign ? "#5A82AA" : "#D9CDBF",
                      color: col.isPrimary || col.isForeign ? "#FFFFFF" : "#3E2723",
                    }}
                  >
                    {col.type}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "4px", marginLeft: "8px", flexShrink: 0 }}>
                  {col.isPrimary && (
                    <span style={{ background: "#C4756C", color: "#FFFFFF", borderRadius: "4px", fontWeight: 700, fontSize: "9px", padding: "2px 5px" }}>PK</span>
                  )}
                  {col.isForeign && (
                    <span style={{ background: "#5A82AA", color: "#FFFFFF", borderRadius: "4px", fontWeight: 700, fontSize: "9px", padding: "2px 5px" }}>FK</span>
                  )}
                  {col.isUnique && (
                    <span style={{ background: "#D9CDBF", color: "#8B7355", borderRadius: "4px", fontSize: "9px", padding: "2px 5px" }}>U</span>
                  )}
                  {col.notNull && (
                    <span style={{ border: "1px solid #D9CDBF", color: "#8B7355", borderRadius: "4px", fontSize: "9px", padding: "2px 5px" }}>NN</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const nodeTypes = { table: TableNode };

// ─── DBViewerInner ────────────────────────────────────────────────────────────

function DBViewerInner({ dbmlContent, fileName, layoutData, onLayoutChange, onTableSelect }: DBViewerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<TableNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isInteractive, setIsInteractive] = useState(true);
  const [lockWarning, setLockWarning] = useState(false);
  const isRestoring = useRef(false);
  const lockWarningTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevDbmlContent = useRef(dbmlContent);
  const searchRef = useRef<HTMLDivElement>(null);
  const { fitView, getViewport, setCenter } = useReactFlow();

  const handleLockedInteraction = () => {
    if (!isInteractive) {
      setLockWarning(true);
      if (lockWarningTimeout.current) clearTimeout(lockWarningTimeout.current);
      lockWarningTimeout.current = setTimeout(() => setLockWarning(false), 2000);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as HTMLElement)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // React to content changes
  useEffect(() => {
    if (dbmlContent !== prevDbmlContent.current) {
      prevDbmlContent.current = dbmlContent;
      if (dbmlContent.trim()) parseDBML(dbmlContent, layoutData);
      else { setNodes([]); setEdges([]); }
    }
  }, [dbmlContent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial parse
  useEffect(() => {
    if (dbmlContent.trim()) parseDBML(dbmlContent, layoutData);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveCurrentLayout = useCallback(() => {
    if (isRestoring.current || nodes.length === 0) return "";
    const viewport = getViewport();
    return JSON.stringify({
      nodes: nodes.map((n) => ({ id: n.id, position: n.position })),
      viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
    });
  }, [nodes, getViewport]);

  const restoreLayout = useCallback(
    (layoutDataStr: string, newNodes: Node[]) => {
      isRestoring.current = true;
      try {
        const parsed = JSON.parse(layoutDataStr);
        const restored = newNodes.map((node) => {
          const saved = parsed.nodes?.find((n: { id: string }) => n.id === node.id);
          return saved ? { ...node, position: saved.position } : node;
        });
        setNodes(restored as TableNodeType[]);
        if (parsed.viewport) setTimeout(() => fitView({ duration: 0 }), 100);
        return restored;
      } catch {
        return newNodes;
      } finally {
        setTimeout(() => { isRestoring.current = false; }, 500);
      }
    },
    [setNodes, fitView]
  );

  const preprocessDBML = (content: string): string => {
    const lines = content.split("\n");
    const result: string[] = [];
    let insideProjectBlock = false;
    let braceCount = 0;
    let lastLineWasEmpty = false;
    let insideBlock = false;
    let blockBraceCount = 0;

    for (const line of lines) {
      const cleanedLine = line.replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ");
      const trimmedLine = cleanedLine.trim();

      if (!insideProjectBlock && /^Project\s+\w+\s*\{?/i.test(trimmedLine)) {
        insideProjectBlock = true;
        braceCount =
          (cleanedLine.match(/\{/g) || []).length -
          (cleanedLine.match(/\}/g) || []).length;
        if (braceCount <= 0) { insideProjectBlock = false; braceCount = 0; }
        continue;
      }
      if (insideProjectBlock) {
        braceCount += (cleanedLine.match(/\{/g) || []).length;
        braceCount -= (cleanedLine.match(/\}/g) || []).length;
        if (braceCount <= 0) { insideProjectBlock = false; braceCount = 0; }
        continue;
      }

      const openBraces = (cleanedLine.match(/\{/g) || []).length;
      const closeBraces = (cleanedLine.match(/\}/g) || []).length;
      blockBraceCount += openBraces - closeBraces;
      insideBlock = blockBraceCount > 0;

      if (trimmedLine === "" && insideBlock) continue;

      if (trimmedLine === "") {
        if (lastLineWasEmpty) continue;
        lastLineWasEmpty = true;
        result.push("");
      } else {
        lastLineWasEmpty = false;
        result.push(cleanedLine);
      }
    }

    return result.join("\n").trim();
  };

  const preprocessSQLForImport = (content: string): string => {
    const withoutBlockComments = content.replace(/\/\*[\s\S]*?\*\//g, "");
    const withoutLineComments = withoutBlockComments.replace(/--.*$/gm, "");
    const statements = withoutLineComments.split(";");
    const createTableStatements = statements
      .map((s) => s.trim())
      .filter((s) => /^CREATE\s+TABLE\b/i.test(s));
    if (createTableStatements.length === 0) return "";
    return createTableStatements.join(";\n\n") + ";";
  };

  const parseDBML = useCallback(
    async (content: string, layout?: string) => {
      if (!content.trim()) return;
      setIsLoading(true);
      setError(null);

      try {
        let dbml: string;
        const isSql = fileName.toLowerCase().endsWith(".sql");

        if (isSql) {
          try {
            dbml = importer.import(preprocessSQLForImport(content) || content, "postgres");
          } catch {
            try {
              dbml = importer.import(preprocessSQLForImport(content) || content, "mysql");
            } catch {
              dbml = importer.import(preprocessSQLForImport(content) || content, "postgresLegacy");
            }
          }
        } else {
          dbml = preprocessDBML(content);
        }

        const parser = new Parser();
        const database = parser.parse(dbml, "dbml");

        const foreignKeys = new Set<string>();
        database.schemas[0]?.refs?.forEach((ref) => {
          const ep = ref.endpoints[0];
          if (ep?.tableName && ep?.fieldNames) {
            ep.fieldNames.forEach((f: string) => foreignKeys.add(`${ep.tableName}.${f}`));
          }
        });

        const tableNodes: TableNodeType[] =
          database.schemas[0]?.tables.map((table, index) => ({
            id: table.name,
            type: "table" as const,
            position: {
              x: (index % 4) * 400 + 50,
              y: Math.floor(index / 4) * 350 + 50,
            },
            data: {
              name: table.name,
              columns: table.fields.map((field) => ({
                name: field.name,
                type: field.type.type_name,
                isPrimary: field.pk,
                isForeign: foreignKeys.has(`${table.name}.${field.name}`),
                isUnique: field.unique,
                notNull: field.not_null,
              })),
            },
            draggable: true,
          })) ?? [];

        const relationshipEdges: Edge[] = [];
        database.schemas[0]?.refs?.forEach((ref, index) => {
          const src = ref.endpoints[0];
          const tgt = ref.endpoints[1];
          if (src?.tableName && tgt?.tableName) {
            relationshipEdges.push({
              id: `rel-${index}`,
              source: src.tableName,
              target: tgt.tableName,
              type: "smoothstep",
              animated: false,
              style: { stroke: "#9B8F5E", strokeWidth: 2 },
              label:
                src.fieldNames?.[0] && tgt.fieldNames?.[0]
                  ? `${src.fieldNames[0]} → ${tgt.fieldNames[0]}`
                  : "",
              labelStyle: { fontSize: "10px", fontWeight: "500", fill: "#3E2723" },
              labelBgStyle: { fill: "#EBE3D5", stroke: "#D9CDBF" },
              labelBgPadding: [4, 2] as [number, number],
              labelBgBorderRadius: 4,
            });
          }
        });

        if (layout && layout.trim() && layout !== "{}") {
          restoreLayout(layout, tableNodes);
        } else {
          setNodes(tableNodes);
          setTimeout(() => fitView({ padding: 0.1, duration: 500 }), 200);
        }

        setEdges(relationshipEdges);
      } catch (err) {
        let msg = "Failed to parse content";
        if (err instanceof Error) msg = err.message;
        else if (err && typeof err === "object" && "message" in err) msg = String((err as { message: unknown }).message);
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [fitView, restoreLayout, setEdges, setNodes, fileName]
  );

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes);
      if (isRestoring.current) return;
      const hasDragEnd = changes.some(
        (c) => c.type === "position" && "dragging" in c && c.dragging === false
      );
      if (hasDragEnd) {
        setTimeout(() => {
          const ld = saveCurrentLayout();
          if (ld) onLayoutChange(ld);
        }, 100);
      }
    },
    [onNodesChange, saveCurrentLayout, onLayoutChange]
  );

  const filteredTables = nodes.filter((n) =>
    n.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const focusOnTable = (tableId: string) => {
    const node = nodes.find((n) => n.id === tableId);
    if (node) {
      setCenter(node.position.x + 125, node.position.y + 100, { zoom: 1.2, duration: 500 });
      onTableSelect?.(tableId);
      setSearchQuery("");
      setShowSearchDropdown(false);
      setSelectedIndex(0);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!showSearchDropdown || filteredTables.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((p) => (p + 1) % filteredTables.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((p) => (p - 1 + filteredTables.length) % filteredTables.length); }
    else if (e.key === "Enter") { e.preventDefault(); focusOnTable(filteredTables[selectedIndex].id); }
    else if (e.key === "Escape") setShowSearchDropdown(false);
  };

  void isLoading; // suppress unused warning

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#F5EFE7" }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          background: "#FFFFFF",
          borderBottom: "1px solid #D9CDBF",
          padding: "10px 16px",
          gap: "8px",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative" }} ref={searchRef}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#F5EEE5",
              border: "1px solid #D9CDBF",
              borderRadius: "6px",
              padding: "6px 12px",
            }}
          >
            <Search style={{ width: "16px", height: "16px", color: "#8B7355" }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchDropdown(e.target.value.length > 0);
                setSelectedIndex(0);
              }}
              onFocus={() => searchQuery.length > 0 && setShowSearchDropdown(true)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search tables..."
              style={{
                fontSize: "13px",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#3E2723",
                width: "180px",
              }}
            />
          </div>
          {showSearchDropdown && filteredTables.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                marginTop: "4px",
                background: "#FFFFFF",
                border: "1px solid #D9CDBF",
                borderRadius: "6px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                zIndex: 50,
                maxHeight: "192px",
                overflowY: "auto",
                minWidth: "280px",
              }}
            >
              {filteredTables.map((node, idx) => (
                <button
                  key={node.id}
                  onClick={() => focusOnTable(node.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 12px",
                    fontSize: "13px",
                    color: "#3E2723",
                    background: idx === selectedIndex ? "#EBE3D5" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <Database style={{ width: "12px", height: "12px", color: "#9B8F5E", flexShrink: 0 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.id}</span>
                </button>
              ))}
            </div>
          )}
          {showSearchDropdown && searchQuery.length > 0 && filteredTables.length === 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                marginTop: "4px",
                background: "#FFFFFF",
                border: "1px solid #D9CDBF",
                borderRadius: "6px",
                padding: "8px 12px",
                minWidth: "280px",
                fontSize: "13px",
                color: "#8B7355",
              }}
            >
              No tables found
            </div>
          )}
        </div>

        {/* Fit button */}
        <button
          onClick={() => fitView({ padding: 0.1, duration: 500 })}
          disabled={nodes.length === 0}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            background: "#EBE3D5",
            border: "1px solid #D9CDBF",
            borderRadius: "6px",
            color: "#3E2723",
            padding: "7px 14px",
            cursor: nodes.length === 0 ? "not-allowed" : "pointer",
            opacity: nodes.length === 0 ? 0.5 : 1,
          }}
        >
          <ZoomIn style={{ width: "16px", height: "16px" }} />
          Fit
        </button>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: "relative", background: "#F5EFE7" }}>
        {error && (
          <div
            style={{
              position: "absolute",
              top: "16px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 50,
              background: "rgba(196,117,108,0.15)",
              border: "1px solid #C4756C",
              color: "#C4756C",
              borderRadius: "8px",
              padding: "10px 18px",
              fontSize: "13px",
              maxWidth: "80%",
              wordBreak: "break-word",
            }}
          >
            {error}
          </div>
        )}
        {lockWarning && (
          <div
            style={{
              position: "absolute",
              top: "16px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 50,
              background: "rgba(158,142,88,0.15)",
              border: "1px solid #9E8E58",
              color: "#9E8E58",
              borderRadius: "8px",
              padding: "10px 18px",
              fontSize: "13px",
            }}
          >
            Canvas is locked
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          panOnDrag={isInteractive}
          zoomOnScroll={isInteractive}
          zoomOnPinch={isInteractive}
          zoomOnDoubleClick={isInteractive}
          nodesDraggable={isInteractive}
          nodesConnectable={isInteractive}
          elementsSelectable={isInteractive}
          onPaneClick={handleLockedInteraction}
          onPaneMouseMove={!isInteractive ? handleLockedInteraction : undefined}
        >
          <Background color="#D9CDBF" gap={16} size={1} />
          <Panel
            position="bottom-right"
            style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}
          >
            <Controls
              style={{
                background: "#E8DFD0",
                border: "1px solid #D9CDBF",
                borderRadius: "8px",
                position: "static",
              }}
              onInteractiveChange={(interactive) => setIsInteractive(interactive)}
            />
            <div
              style={{
                background: "#E8DFD0",
                border: "1px solid #D9CDBF",
                borderRadius: "8px",
                padding: "8px 14px",
              }}
            >
              <span style={{ fontSize: "11px", fontWeight: 500, color: "#8B7355" }}>
                Tables: {nodes.length} | Relations: {edges.length}
              </span>
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

// ─── Export (wrapped in ReactFlowProvider) ───────────────────────────────────

export default function DBViewer(props: DBViewerProps) {
  return (
    <ReactFlowProvider>
      <DBViewerInner {...props} />
    </ReactFlowProvider>
  );
}
