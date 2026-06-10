import React, { useState, useRef } from "react";
import { useMatrixStore } from "../stores/matrixStore";
import { useToolStore } from "../stores/toolStore";

export const AgentValidator: React.FC = () => {
  const { validationResult, validationLoading, validateAgent, resetValidation } = useMatrixStore();
  const { tools } = useToolStore();
  const [agentCode, setAgentCode] = useState(`def my_agent():
    """A simple agent that searches and creates documents."""
    results = search_knowledge_base(query="user question")
    if results:
        doc_id = create_document(title="response", content=str(results), author="agent")
        return doc_id
    return None`);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleValidate = () => {
    if (!agentCode.trim()) {
      alert("Please enter agent code");
      return;
    }

    // Build a policy JSON from the current tools
    const policyJson: Record<string, unknown> = {
      policy_version: "1.0",
      tools: Object.fromEntries(
        tools.map((t) => [
          String(t.id),
          {
            id: t.id,
            name: t.name,
            risk_category: t.risk_category,
            description: t.description || "",
          },
        ])
      ),
      roles: {},
      permissions: {},
    };

    validateAgent(agentCode, policyJson);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setAgentCode(event.target?.result as string);
    };
    reader.readAsText(file);
  };

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
    if (score >= 80) return "text-green-600";
    if (score >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Agent Validator</h2>
        {validationResult && (
          <button
            onClick={resetValidation}
            className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
          >
            Clear Results
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input */}
        <div className="space-y-3">
          <div className="border rounded p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">Agent Code</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
                >
                  Upload File
                </button>
                <button
                  onClick={() => setAgentCode("")}
                  className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
                >
                  Clear
                </button>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".py,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <textarea
              value={agentCode}
              onChange={(e) => setAgentCode(e.target.value)}
              className="w-full h-80 px-3 py-2 border rounded font-mono text-sm"
              placeholder="Paste agent source code here..."
              spellCheck={false}
            />
          </div>

          <button
            onClick={handleValidate}
            disabled={validationLoading}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:bg-gray-300"
          >
            {validationLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Analyzing with Claude...
              </span>
            ) : (
              "Validate Agent"
            )}
          </button>
        </div>

        {/* Results */}
        <div className="border rounded p-4">
          <h3 className="font-semibold mb-3">Analysis Results</h3>

          {!validationResult && !validationLoading && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg mb-2">🔍</p>
              <p>Paste agent code and click Validate</p>
              <p className="text-sm mt-1">Claude will analyze security implications</p>
            </div>
          )}

          {validationLoading && (
            <div className="text-center py-12 text-gray-400">
              <div className="animate-pulse">
                <p className="text-lg mb-2">🤖</p>
                <p>Claude is analyzing your agent...</p>
                <p className="text-sm mt-1">
                  Checking tool calls against permission matrix
                </p>
              </div>
            </div>
          )}

          {validationResult && (
            <div className="space-y-4">
              {/* Security Score */}
              <div className="text-center p-4 bg-gray-50 rounded">
                <div className="text-sm text-gray-500 mb-1">Security Score</div>
                <div className={`text-4xl font-bold ${getScoreColor(validationResult.security_score)}`}>
                  {validationResult.security_score}
                  <span className="text-lg">/100</span>
                </div>
              </div>

              {/* Detected Tool Calls */}
              {validationResult.tool_calls_detected.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Detected Tool Calls</h4>
                  <div className="flex flex-wrap gap-1">
                    {validationResult.tool_calls_detected.map((tool) => (
                      <span
                        key={tool}
                        className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-mono"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Issues */}
              {validationResult.issues.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">
                    Issues ({validationResult.issues.length})
                  </h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {validationResult.issues.map((issue, i) => (
                      <div
                        key={i}
                        className={`p-2 rounded border text-sm ${getSeverityColor(issue.severity)}`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-medium">{issue.tool_name}</span>
                          <span className="text-xs uppercase">{issue.severity}</span>
                        </div>
                        <p className="mt-1 text-xs">{issue.description}</p>
                        <p className="mt-1 text-xs opacity-75">{issue.recommendation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {validationResult.recommendations.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Recommendations</h4>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {validationResult.recommendations.map((rec, i) => (
                      <li key={i} className="text-gray-700">
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Analysis Summary */}
              {validationResult.analysis && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Analysis</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                    {validationResult.analysis}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentValidator;