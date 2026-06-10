import React, { useState } from "react";
import { ToolRegistry } from "./components/ToolRegistry";
import { RoleManager } from "./components/RoleManager";
import { PermissionMatrix } from "./components/PermissionMatrix";
import { PolicyExporter } from "./components/PolicyExporter";
import { AgentValidator } from "./components/AgentValidator";
import { SprawlAnalysis } from "./components/SprawlAnalysis";
import type { TabName } from "./types";

const tabs: { id: TabName; label: string; icon: string }[] = [
  { id: "tools", label: "Tool Registry", icon: "🔧" },
  { id: "roles", label: "Role Manager", icon: "👤" },
  { id: "matrix", label: "Permission Matrix", icon: "📋" },
  { id: "policy", label: "Policy Exporter", icon: "📄" },
  { id: "validate", label: "Agent Validator", icon: "🔍" },
  { id: "sprawl", label: "Sprawl Analysis", icon: "📊" },
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabName>("tools");

  const renderContent = () => {
    switch (activeTab) {
      case "tools":
        return <ToolRegistry />;
      case "roles":
        return <RoleManager />;
      case "matrix":
        return <PermissionMatrix />;
      case "policy":
        return <PolicyExporter />;
      case "validate":
        return <AgentValidator />;
      case "sprawl":
        return <SprawlAnalysis />;
      default:
        return <ToolRegistry />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Tool Permission Matrix</h1>
              <p className="text-blue-200 text-sm mt-1">
                Builder &amp; Validator — Visual Policy Management for AI Agents
              </p>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs text-blue-200">
              <span>All 6 risk categories</span>
              <span className="inline-block w-2 h-2 bg-green-400 rounded-full" />
              <span>Claude Sonnet 4</span>
              <span className="inline-block w-2 h-2 bg-blue-400 rounded-full" />
              <span>@dnd-kit/core</span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex overflow-x-auto -mb-px space-x-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {renderContent()}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-8 py-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-gray-400">
          Tool Permission Matrix Builder &amp; Validator v1.0
        </div>
      </footer>
    </div>
  );
};

export default App;