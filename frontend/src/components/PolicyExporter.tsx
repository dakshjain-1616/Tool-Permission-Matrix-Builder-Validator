import React, { useState } from "react";
import { useToolStore } from "../stores/toolStore";
import { useRoleStore } from "../stores/roleStore";
import { useMatrixStore } from "../stores/matrixStore";

export const PolicyExporter: React.FC = () => {
  const { tools } = useToolStore();
  const { roles } = useRoleStore();
  const { policyResult, policyLoading, generatePolicy, resetPolicy } = useMatrixStore();
  const [selectedTools, setSelectedTools] = useState<number[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
  const [format, setFormat] = useState<"json" | "yaml" | "python">("json");

  const handleGenerate = () => {
    if (selectedTools.length === 0 || selectedRoles.length === 0) {
      alert("Please select at least one tool and one role");
      return;
    }
    generatePolicy(selectedTools, selectedRoles);
  };

  const handleDownload = () => {
    if (!policyResult) return;

    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === "json") {
      content = JSON.stringify(policyResult.json_policy, null, 2);
      filename = "policy.json";
      mimeType = "application/json";
    } else if (format === "yaml") {
      content = policyResult.yaml_policy;
      filename = "policy.yaml";
      mimeType = "text/yaml";
    } else {
      content = policyResult.python_module;
      filename = "permissions.py";
      mimeType = "text/x-python";
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSelectAllTools = () => {
    setSelectedTools(tools.map((t) => t.id));
  };

  const handleSelectAllRoles = () => {
    setSelectedRoles(roles.map((r) => r.id));
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Policy Exporter</h2>
        {policyResult && (
          <button
            onClick={resetPolicy}
            className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
          >
            Clear Results
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          {/* Tool Selection */}
          <div className="border rounded p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">Select Tools</h3>
              <button
                onClick={handleSelectAllTools}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Select All
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {tools.length === 0 && (
                <p className="text-sm text-gray-400">No tools available</p>
              )}
              {tools.map((tool) => (
                <label
                  key={tool.id}
                  className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={selectedTools.includes(tool.id)}
                    onChange={() => {
                      setSelectedTools((prev) =>
                        prev.includes(tool.id)
                          ? prev.filter((id) => id !== tool.id)
                          : [...prev, tool.id]
                      );
                    }}
                  />
                  <span>{tool.name}</span>
                  <span className="text-xs text-gray-400">({tool.risk_category})</span>
                </label>
              ))}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {selectedTools.length} tool(s) selected
            </div>
          </div>

          {/* Role Selection */}
          <div className="border rounded p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">Select Roles</h3>
              <button
                onClick={handleSelectAllRoles}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Select All
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {roles.length === 0 && (
                <p className="text-sm text-gray-400">No roles available</p>
              )}
              {roles.map((role) => (
                <label
                  key={role.id}
                  className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role.id)}
                    onChange={() => {
                      setSelectedRoles((prev) =>
                        prev.includes(role.id)
                          ? prev.filter((id) => id !== role.id)
                          : [...prev, role.id]
                      );
                    }}
                  />
                  <span>{role.name}</span>
                </label>
              ))}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {selectedRoles.length} role(s) selected
            </div>
          </div>

          {/* Format + Generate */}
          <div className="border rounded p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Output Format</label>
              <div className="flex gap-2">
                {(["json", "yaml", "python"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`px-4 py-2 rounded text-sm font-medium ${
                      format === f
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleGenerate}
              disabled={policyLoading || selectedTools.length === 0 || selectedRoles.length === 0}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {policyLoading ? "Generating..." : "Generate Policy"}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="border rounded p-4">
          <h3 className="font-semibold mb-3">Generated Policy</h3>
          {!policyResult && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg mb-2">📄</p>
              <p>Select tools and roles, then click Generate</p>
              <p className="text-sm mt-1">Policy will be displayed here</p>
            </div>
          )}
          {policyLoading && (
            <div className="text-center py-12 text-gray-400">
              <p>Generating policy...</p>
            </div>
          )}
          {policyResult && (
            <div className="space-y-3">
              {/* Format Switcher for Preview */}
              <div className="flex gap-2 mb-2">
                {(["json", "yaml", "python"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`px-3 py-1 text-xs rounded ${
                      format === f
                        ? "bg-gray-800 text-white"
                        : "bg-gray-100 hover:bg-gray-200"
                    }`}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Preview */}
              <pre className="bg-gray-50 border rounded p-3 text-xs overflow-auto max-h-96">
                {format === "json"
                  ? JSON.stringify(policyResult.json_policy, null, 2).slice(0, 10000)
                  : format === "yaml"
                  ? policyResult.yaml_policy.slice(0, 10000)
                  : policyResult.python_module.slice(0, 10000)}
                {(format === "json"
                  ? JSON.stringify(policyResult.json_policy, null, 2).length
                  : format === "yaml"
                  ? policyResult.yaml_policy.length
                  : policyResult.python_module.length) > 10000 && (
                  <span className="block text-center text-gray-400 mt-2">... (truncated)</span>
                )}
              </pre>

              {/* Download */}
              <button
                onClick={handleDownload}
                className="w-full px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700"
              >
                Download as {format.toUpperCase()}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PolicyExporter;