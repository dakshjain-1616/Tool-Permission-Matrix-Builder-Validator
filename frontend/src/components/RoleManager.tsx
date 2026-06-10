import React, { useEffect, useState } from "react";
import { useRoleStore } from "../stores/roleStore";
import { RISK_CATEGORIES, RISK_BG_CLASSES } from "../types";
import type { RoleCreate, RoleUpdate, RiskCategory } from "../types";

const defaultRole: RoleCreate = {
  name: "",
  description: "",
  parent_role_id: null,
  allowed_risk_levels: JSON.stringify(["read-only", "internal-write"]),
  is_system_role: false,
};

export const RoleManager: React.FC = () => {
  const {
    roles,
    loading,
    error,
    fetchRoles,
    createRole,
    updateRole,
    deleteRole,
    clearError,
  } = useRoleStore();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<RoleCreate>({ ...defaultRole });

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId !== null) {
      const update: RoleUpdate = {};
      if (form.name !== "") update.name = form.name;
      if (form.description !== "") update.description = form.description;
      update.parent_role_id = form.parent_role_id;
      update.allowed_risk_levels = form.allowed_risk_levels;
      update.is_system_role = form.is_system_role;
      await updateRole(editingId, update);
    } else {
      await createRole(form);
    }
    setShowForm(false);
    setEditingId(null);
    setForm({ ...defaultRole });
  };

  const handleEdit = (role: typeof roles[0]) => {
    setForm({
      name: role.name,
      description: role.description || "",
      parent_role_id: role.parent_role_id,
      allowed_risk_levels: role.allowed_risk_levels || JSON.stringify(["read-only"]),
      is_system_role: role.is_system_role,
    });
    setEditingId(role.id);
    setShowForm(true);
  };

  const getAllowedRiskList = (role: typeof roles[0]): string[] => {
    try {
      return JSON.parse(role.allowed_risk_levels || "[]");
    } catch {
      return [];
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Role Manager</h2>
        <button
          onClick={() => {
            setForm({ ...defaultRole });
            setEditingId(null);
            setShowForm(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Add Role
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded flex justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-bold mb-4">
              {editingId ? "Edit Role" : "Add Role"}
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
                <label className="block text-sm font-medium mb-1">Parent Role (for inheritance)</label>
                <select
                  value={form.parent_role_id ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      parent_role_id: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">None (top-level role)</option>
                  {roles
                    .filter((r) => r.id !== editingId)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Allowed Risk Levels</label>
                <div className="flex flex-wrap gap-2">
                  {RISK_CATEGORIES.map((rc) => {
                    const currentLevels = (() => {
                      try {
                        return JSON.parse(form.allowed_risk_levels || "[]");
                      } catch {
                        return [];
                      }
                    })();
                    const isChecked = currentLevels.includes(rc);
                    return (
                      <label
                        key={rc}
                        className={`flex items-center gap-1 px-2 py-1 rounded border text-xs cursor-pointer ${
                          RISK_BG_CLASSES[rc as RiskCategory] || "bg-gray-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const updated = isChecked
                              ? currentLevels.filter((l: string) => l !== rc)
                              : [...currentLevels, rc];
                            setForm({
                              ...form,
                              allowed_risk_levels: JSON.stringify(updated),
                            });
                          }}
                        />
                        {rc}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_system_role"
                  checked={form.is_system_role}
                  onChange={(e) => setForm({ ...form, is_system_role: e.target.checked })}
                />
                <label htmlFor="is_system_role" className="text-sm">
                  System Role (protected)
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
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {editingId ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && <div className="text-center py-4 text-gray-500">Loading...</div>}

      {/* Role List */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Parent Role</th>
              <th className="text-left px-4 py-2">Allowed Risk Levels</th>
              <th className="text-center px-4 py-2">System</th>
              <th className="text-right px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {roles.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400">
                  No roles found. Create one to get started.
                </td>
              </tr>
            )}
            {roles.map((role) => (
              <tr key={role.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{role.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {role.parent_role_id
                    ? roles.find((r) => r.id === role.parent_role_id)?.name || `#${role.parent_role_id}`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {getAllowedRiskList(role).map((rc) => (
                      <span
                        key={rc}
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${
                          RISK_BG_CLASSES[rc as RiskCategory] || "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {rc}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  {role.is_system_role ? (
                    <span className="text-purple-600 text-sm font-medium">System</span>
                  ) : (
                    <span className="text-gray-400 text-sm">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleEdit(role)}
                    className="text-blue-600 hover:text-blue-800 mr-2 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete role "${role.name}"?`)) {
                        deleteRole(role.id);
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

export default RoleManager;