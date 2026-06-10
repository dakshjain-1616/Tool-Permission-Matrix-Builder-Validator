import React, { useEffect, useState } from "react";
import { useToolStore } from "../stores/toolStore";
import { RISK_CATEGORIES, RISK_BG_CLASSES } from "../types";
import type { ToolCreate, ToolUpdate, RiskCategory } from "../types";

const defaultTool: ToolCreate = {
  name: "",
  description: "",
  risk_category: "read-only",
  endpoint: "",
  required_permissions: "",
  tags: "",
  active: true,
};

export const ToolRegistry: React.FC = () => {
  const {
    tools,
    loading,
    error,
    filter,
    fetchTools,
    createTool,
    updateTool,
    deleteTool,
    setFilter,
    clearFilter,
    clearError,
  } = useToolStore();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ToolCreate>({ ...defaultTool });
  const [jsonImport, setJsonImport] = useState("");

  useEffect(() => {
    fetchTools();
  }, [filter, fetchTools]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId !== null) {
      const update: ToolUpdate = {};
      if (form.name !== "") update.name = form.name;
      if (form.description !== "") update.description = form.description;
      if (form.risk_category !== "read-only") update.risk_category = form.risk_category;
      await updateTool(editingId, form);
    } else {
      await createTool(form);
    }
    setShowForm(false);
    setEditingId(null);
    setForm({ ...defaultTool });
  };

  const handleEdit = (tool: typeof tools[0]) => {
    setForm({
      name: tool.name,
      description: tool.description || "",
      risk_category: tool.risk_category,
      endpoint: tool.endpoint || "",
      required_permissions: tool.required_permissions || "",
      tags: tool.tags || "",
      active: tool.active,
    });
    setEditingId(tool.id);
    setShowForm(true);
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(tools, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tools-export.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(jsonImport);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      arr.forEach(async (item: Record<string, unknown>) => {
        await createTool({
          name: String(item.name || ""),
          description: item.description ? String(item.description) : "",
          risk_category: String(item.risk_category || "read-only"),
          endpoint: item.endpoint ? String(item.endpoint) : "",
          required_permissions: item.required_permissions ? String(item.required_permissions) : "",
          tags: item.tags ? String(item.tags) : "",
          active: item.active !== undefined ? Boolean(item.active) : true,
        });
      });
      setJsonImport("");
    } catch {
      alert("Invalid JSON format");
    }
  };

  const filteredTools = tools.filter((t) => {
    if (filter.search && !t.name.toLowerCase().includes(filter.search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Tool Registry</h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setForm({ ...defaultTool });
              setEditingId(null);
              setShowForm(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Add Tool
          </button>
          <button onClick={handleExportJson} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
            Export JSON
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search tools..."
          value={filter.search}
          onChange={(e) => setFilter({ search: e.target.value })}
          className="px-3 py-2 border rounded"
        />
        <select
          value={filter.riskCategory || ""}
          onChange={(e) => setFilter({ riskCategory: e.target.value || null })}
          className="px-3 py-2 border rounded"
        >
          <option value="">All Categories</option>
          {RISK_CATEGORIES.map((rc) => (
            <option key={rc} value={rc}>
              {rc}
            </option>
          ))}
        </select>
        <select
          value={filter.active === null ? "" : filter.active ? "true" : "false"}
          onChange={(e) =>
            setFilter({
              active: e.target.value === "" ? null : e.target.value === "true",
            })
          }
          className="px-3 py-2 border rounded"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <button onClick={clearFilter} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800">
          Clear Filters
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded flex justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="font-bold">✕</button>
        </div>
      )}

      {/* Import JSON */}
      <details className="mb-4">
        <summary className="cursor-pointer text-sm text-gray-600">Import Tools from JSON</summary>
        <div className="mt-2 flex gap-2">
          <textarea
            value={jsonImport}
            onChange={(e) => setJsonImport(e.target.value)}
            placeholder='[{"name": "...", "risk_category": "read-only"}]'
            className="flex-1 px-3 py-2 border rounded text-sm"
            rows={3}
          />
          <button onClick={handleImportJson} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            Import
          </button>
        </div>
      </details>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-bold mb-4">
              {editingId ? "Edit Tool" : "Add Tool"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={form.description || ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Risk Category</label>
                <select
                  value={form.risk_category}
                  onChange={(e) => setForm({ ...form, risk_category: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                >
                  {RISK_CATEGORIES.map((rc) => (
                    <option key={rc} value={rc}>
                      {rc}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Endpoint</label>
                <input
                  type="text"
                  value={form.endpoint || ""}
                  onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  />
                  Active
                </label>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  {editingId ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && <div className="text-center py-4 text-gray-500">Loading...</div>}

      {/* Tool List */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Risk Category</th>
              <th className="text-left px-4 py-2">Endpoint</th>
              <th className="text-center px-4 py-2">Active</th>
              <th className="text-right px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTools.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400">
                  No tools found. Create one to get started.
                </td>
              </tr>
            )}
            {filteredTools.map((tool) => (
              <tr key={tool.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{tool.name}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium border ${
                      RISK_BG_CLASSES[tool.risk_category as RiskCategory] || "bg-gray-100"
                    }`}
                  >
                    {tool.risk_category}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{tool.endpoint || "—"}</td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-block w-3 h-3 rounded-full ${
                      tool.active ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleEdit(tool)}
                    className="text-blue-600 hover:text-blue-800 mr-2 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete tool "${tool.name}"?`)) {
                        deleteTool(tool.id);
                      }
                    }}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ToolRegistry;