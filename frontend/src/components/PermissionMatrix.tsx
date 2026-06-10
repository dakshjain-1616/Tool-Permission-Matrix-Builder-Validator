import React, { useEffect, useState, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDraggable,
  useDroppable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useMatrixStore } from "../stores/matrixStore";
import { useToolStore } from "../stores/toolStore";
import { useRoleStore } from "../stores/roleStore";
import { RISK_BG_CLASSES } from "../types";
import type { MatrixCell, RiskCategory } from "../types";

// ─── Draggable Tool ──────────────────────────────────────────────────────────

function DraggableTool({ tool }: { tool: { id: number; name: string; risk_category: string } }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `tool-${tool.id}`,
    data: { type: "tool", tool },
  });

  const style: React.CSSProperties = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 100 : 1,
      }
    : {};

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border cursor-grab active:cursor-grabbing ${
        RISK_BG_CLASSES[tool.risk_category as RiskCategory] || "bg-gray-100"
      } ${isDragging ? "opacity-50 shadow-lg" : ""}`}
    >
      {tool.name}
    </div>
  );
}

// ─── Permission Cell ─────────────────────────────────────────────────────────

function PermissionCell({
  cell,
  onToggle,
}: {
  cell: MatrixCell;
  onToggle: (toolId: number, roleId: number) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `cell-${cell.tool_id}-${cell.role_id}`,
    data: { type: "cell", toolId: cell.tool_id, roleId: cell.role_id },
  });

  const handleClick = () => {
    if (cell.inherited) return; // Cannot toggle inherited permissions directly
    onToggle(cell.tool_id, cell.role_id);
  };

  let icon: string;
  let bgClass: string;

  if (cell.inherited) {
    icon = "●";
    bgClass = "bg-gray-200 text-gray-500";
  } else if (cell.allowed) {
    icon = "✓";
    bgClass = "bg-green-100 text-green-700";
  } else {
    icon = "✕";
    bgClass = "bg-red-50 text-red-500";
  }

  return (
    <div
      ref={setNodeRef}
      onClick={handleClick}
      className={`w-10 h-10 flex items-center justify-center cursor-pointer rounded border text-lg transition-colors ${
        cell.inherited ? "cursor-not-allowed" : "hover:ring-2 hover:ring-blue-300"
      } ${bgClass} ${isOver ? "ring-2 ring-blue-500 bg-blue-50" : ""}`}
      title={`${cell.tool_name} → ${cell.role_name}: ${cell.inherited ? "Inherited" : cell.allowed ? "Allowed" : "Denied"}`}
    >
      {icon}
    </div>
  );
}

// ─── Draggable Tool Badge (for drag overlay) ─────────────────────────────────

function DraggableToolBadge({ tool }: { tool: { id: number; name: string; risk_category: string } }) {
  return (
    <div
      className={`inline-flex items-center gap-1 px-3 py-2 rounded text-sm font-medium border shadow-lg ${
        RISK_BG_CLASSES[tool.risk_category as RiskCategory] || "bg-gray-100"
      }`}
    >
      {tool.name}
    </div>
  );
}

// ─── Main Permission Matrix Component ────────────────────────────────────────

export const PermissionMatrix: React.FC = () => {
  const { cells, loading, error, fetchMatrix, toggleCell } = useMatrixStore();
  const { tools, fetchTools } = useToolStore();
  const { roles, fetchRoles } = useRoleStore();
  const [activeDragTool, setActiveDragTool] = useState<{ id: number; name: string; risk_category: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  useEffect(() => {
    fetchTools();
    fetchRoles();
    fetchMatrix();
  }, [fetchTools, fetchRoles, fetchMatrix]);

  // Group cells by role and tool
  const getCell = useCallback(
    (toolId: number, roleId: number): MatrixCell | undefined => {
      return cells.find((c) => c.tool_id === toolId && c.role_id === roleId);
    },
    [cells]
  );

  const activeTools = tools.filter((t) => t.active);

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === "tool") {
      setActiveDragTool(data.tool);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragTool(null);
    const { active, over } = event;
    if (!over) return;

    const toolData = active.data.current;
    const cellData = over.data.current;

    if (toolData?.type === "tool" && cellData?.type === "cell") {
      // Grant the tool to the role via the cell
      const toolId = cellData.toolId;
      const roleId = cellData.roleId;
      const cell = getCell(toolId, roleId);
      if (cell && !cell.allowed) {
        toggleCell(toolId, roleId);
      }
    }
  };

  if (loading && cells.length === 0) {
    return <div className="p-8 text-center text-gray-400">Loading permission matrix...</div>;
  }

  // Get unique tool and role IDs from cells
  const uniqueTools = activeTools.length > 0
    ? activeTools
    : Array.from(new Map(cells.map((c) => [c.tool_id, { id: c.tool_id, name: c.tool_name, risk_category: c.risk_category }])).values());
  const uniqueRoles = roles.length > 0
    ? roles
    : Array.from(new Map(cells.map((c) => [c.role_id, { id: c.role_id, name: c.role_name }])).values());

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Permission Matrix</h2>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1">
              <span className="text-green-600">✓</span> Allowed
            </span>
            <span className="flex items-center gap-1">
              <span className="text-red-500">✕</span> Denied
            </span>
            <span className="flex items-center gap-1">
              <span className="text-gray-500">●</span> Inherited
            </span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>
        )}

        {/* Instructions */}
        <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded text-sm">
          <strong>Tip:</strong> Drag a tool from the top to a cell in the grid to grant access.
          Click any cell to toggle between allowed/denied. Inherited permissions (grey) cannot be toggled directly.
        </div>

        {/* Draggable Tool Bar */}
        <div className="mb-4 p-3 bg-gray-50 rounded border">
          <div className="text-xs text-gray-500 mb-2">Drag a tool onto a role column to grant access:</div>
          <div className="flex flex-wrap gap-2">
            {uniqueTools.map((tool) => (
              <DraggableTool key={tool.id} tool={{ id: tool.id, name: tool.name, risk_category: tool.risk_category }} />
            ))}
          </div>
        </div>

        {/* Matrix Grid */}
        <div className="overflow-x-auto">
          <table className="border-collapse min-w-full">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[120px]">
                  Tool / Role
                </th>
                {uniqueRoles.map((role) => (
                  <th
                    key={role.id}
                    className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase min-w-[44px]"
                  >
                    <div className="writing-mode-vertical">{role.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {uniqueTools.map((tool) => (
                <tr key={tool.id} className="border-t hover:bg-gray-50">
                  <td className="sticky left-0 bg-white px-2 py-2 text-sm border-r">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate max-w-[120px]">{tool.name}</span>
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                          RISK_BG_CLASSES[tool.risk_category as RiskCategory] || "bg-gray-100"
                        }`}
                      >
                        {tool.risk_category}
                      </span>
                    </div>
                  </td>
                  {uniqueRoles.map((role) => {
                    const cell = getCell(tool.id, role.id) || {
                      tool_id: tool.id,
                      tool_name: tool.name,
                      role_id: role.id,
                      role_name: role.name,
                      allowed: false,
                      inherited: false,
                      risk_category: tool.risk_category,
                    };
                    return (
                      <td key={`${tool.id}-${role.id}`} className="px-1 py-1 text-center">
                        <PermissionCell cell={cell} onToggle={toggleCell} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="mt-4 text-sm text-gray-500">
          {cells.length > 0 && (
            <>
              {cells.filter((c) => c.allowed).length} allowed, {cells.filter((c) => !c.allowed && !c.inherited).length} denied,{" "}
              {cells.filter((c) => c.inherited).length} inherited permissions
            </>
          )}
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeDragTool ? <DraggableToolBadge tool={activeDragTool} /> : null}
      </DragOverlay>
    </DndContext>
  );
};

export default PermissionMatrix;