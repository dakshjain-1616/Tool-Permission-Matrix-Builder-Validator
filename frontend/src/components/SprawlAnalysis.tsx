import React, { useEffect, useState } from "react";
import { useMatrixStore } from "../stores/matrixStore";
import { useToolStore } from "../stores/toolStore";
import { useRoleStore } from "../stores/roleStore";

export const SprawlAnalysis: React.FC = () => {
  const { cells, sprawlResult, sprawlLoading, analyzeSprawl, resetSprawl } = useMatrixStore();
  const { tools } = useToolStore();
  const { roles } = useRoleStore();

  const buildMatrixData = () => {
    const permissions: Record<string, Record<string, string>> = {};
    for (const cell of cells) {
      const roleKey = String(cell.role_id);
      const toolKey = String(cell.tool_id);
      if (!permissions[roleKey]) permissions[roleKey] = {};
      permissions[roleKey][toolKey] = cell.inherited ? "INHERITED" : cell.allowed ? "ALLOWED" : "DENIED";
    }
    return {
      permissions,
      roles: Object.fromEntries(
        roles.map((r) => [String(r.id), { id: r.id, name: r.name }])
      ),
    };
  };

  useEffect(() => {
    if (tools.length > 0 && roles.length > 0 && !sprawlResult) {
      analyzeSprawl(
        buildMatrixData(),
        tools.map((t) => ({
          id: t.id,
          name: t.name,
          risk_category: t.risk_category,
          description: t.description || "",
        })),
        roles.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description || "",
          parent_role_id: r.parent_role_id,
        }))
      );
    }
  }, [tools.length, roles.length, cells.length]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-300";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "low":
        return "bg-blue-100 text-blue-800 border-blue-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getScoreColor = (score: number) => {
    if (score <= 30) return "text-green-600";
    if (score <= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBgColor = (score: number) => {
    if (score <= 30) return "bg-green-500";
    if (score <= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Sprawl Analysis</h2>
        {sprawlResult && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                analyzeSprawl(
                  buildMatrixData(),
                  tools.map((t) => ({
                    id: t.id,
                    name: t.name,
                    risk_category: t.risk_category,
                    description: t.description || "",
                  })),
                  roles.map((r) => ({
                    id: r.id,
                    name: r.name,
                    description: r.description || "",
                    parent_role_id: r.parent_role_id,
                  }))
                );
              }}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Re-analyze
            </button>
            <button
              onClick={resetSprawl}
              className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {sprawlLoading && (
        <div className="text-center py-16 text-gray-400">
          <div className="animate-pulse">
            <p className="text-2xl mb-2">📊</p>
            <p>Claude is analyzing permission sprawl...</p>
            <p className="text-sm mt-1">Evaluating access patterns and risk concentration</p>
          </div>
        </div>
      )}

      {!sprawlResult && !sprawlLoading && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-2xl mb-2">📊</p>
          <p>Loading sprawl analysis...</p>
        </div>
      )}

      {sprawlResult && !sprawlLoading && (
        <div className="space-y-6">
          {/* Score + Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Sprawl Score */}
            <div className="border rounded-lg p-6 text-center">
              <div className="text-sm text-gray-500 mb-2">Sprawl Score</div>
              <div className={`text-5xl font-bold ${getScoreColor(sprawlResult.sprawl_score)}`}>
                {sprawlResult.sprawl_score}
                <span className="text-lg">/100</span>
              </div>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all ${getScoreBgColor(sprawlResult.sprawl_score)}`}
                  style={{ width: `${sprawlResult.sprawl_score}%` }}
                />
              </div>
              <div className="text-xs mt-2 text-gray-400">
                {sprawlResult.sprawl_score <= 30
                  ? "Low sprawl - well structured"
                  : sprawlResult.sprawl_score <= 60
                  ? "Moderate sprawl - some improvements needed"
                  : "High sprawl - immediate attention required"}
              </div>
            </div>

            {/* Stats */}
            {sprawlResult.statistics && (
              <>
                {Object.entries({
                  "Total Tools": sprawlResult.statistics.total_tools,
                  "Total Roles": sprawlResult.statistics.total_roles,
                  "Total Permissions": sprawlResult.statistics.total_permissions,
                  "Allowed": sprawlResult.statistics.total_allowed,
                  "Denied": sprawlResult.statistics.total_denied,
                }).map(([label, value]) => (
                  <div key={label} className="border rounded-lg p-6 text-center">
                    <div className="text-sm text-gray-500 mb-1">{label}</div>
                    <div className="text-3xl font-bold text-gray-800">
                      {value !== undefined ? String(value) : "—"}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Issues */}
          {sprawlResult.issues.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">
                Issues Found ({sprawlResult.issues.length})
              </h3>
              <div className="space-y-2">
                {sprawlResult.issues.map((issue, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded border text-sm ${getSeverityColor(issue.severity)}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-medium">{issue.issue_type}</span>
                        <span className="ml-2 text-xs opacity-75 uppercase">
                          {issue.severity}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1">{issue.description}</p>
                    {issue.affected_tools.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {issue.affected_tools.map((tool) => (
                          <span
                            key={tool}
                            className="px-1.5 py-0.5 bg-white bg-opacity-50 rounded text-xs"
                          >
                            {tool}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="mt-1 text-xs opacity-75">{issue.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sprawlResult.issues.length === 0 && (
            <div className="p-8 text-center bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 font-medium">No sprawl issues detected</p>
              <p className="text-green-600 text-sm mt-1">
                Your permission matrix appears well-structured
              </p>
            </div>
          )}

          {/* Recommendations */}
          {sprawlResult.recommendations.length > 0 && (
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">Recommendations</h3>
              <ul className="list-disc list-inside space-y-1">
                {sprawlResult.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-gray-700">
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Analysis */}
          {sprawlResult.analysis && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-semibold mb-2">Analysis Summary</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {sprawlResult.analysis}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SprawlAnalysis;