import { create } from "zustand";
import type { ToolCreate, ToolResponse, ToolUpdate, FilterState } from "../types";
import { apiClient } from "../api/client";

interface ToolStore {
  // State
  tools: ToolResponse[];
  loading: boolean;
  error: string | null;
  filter: FilterState;

  // Actions
  fetchTools: () => Promise<void>;
  createTool: (tool: ToolCreate) => Promise<ToolResponse | null>;
  updateTool: (id: number, tool: ToolUpdate) => Promise<ToolResponse | null>;
  deleteTool: (id: number) => Promise<boolean>;
  setFilter: (filter: Partial<FilterState>) => void;
  clearFilter: () => void;
  clearError: () => void;
}

export const useToolStore = create<ToolStore>((set, get) => ({
  tools: [],
  loading: false,
  error: null,
  filter: {
    riskCategory: null,
    active: null,
    search: "",
  },

  fetchTools: async () => {
    set({ loading: true, error: null });
    try {
      const { filter } = get();
      const params: Record<string, string | number | boolean | undefined> = {};
      if (filter.riskCategory) params.risk_category = filter.riskCategory;
      if (filter.active !== null) params.active = filter.active;
      if (filter.search) params.search = filter.search;

      const tools = await apiClient.listTools(params);
      set({ tools, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch tools";
      set({ error: message, loading: false });
    }
  },

  createTool: async (tool) => {
    set({ loading: true, error: null });
    try {
      const created = await apiClient.createTool(tool);
      set((state) => ({ tools: [...state.tools, created], loading: false }));
      return created;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create tool";
      set({ error: message, loading: false });
      return null;
    }
  },

  updateTool: async (id, tool) => {
    set({ loading: true, error: null });
    try {
      const updated = await apiClient.updateTool(id, tool);
      set((state) => ({
        tools: state.tools.map((t) => (t.id === id ? updated : t)),
        loading: false,
      }));
      return updated;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update tool";
      set({ error: message, loading: false });
      return null;
    }
  },

  deleteTool: async (id) => {
    set({ loading: true, error: null });
    try {
      await apiClient.deleteTool(id);
      set((state) => ({
        tools: state.tools.filter((t) => t.id !== id),
        loading: false,
      }));
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete tool";
      set({ error: message, loading: false });
      return false;
    }
  },

  setFilter: (filter) => {
    set((state) => ({ filter: { ...state.filter, ...filter } }));
  },

  clearFilter: () => {
    set({ filter: { riskCategory: null, active: null, search: "" } });
  },

  clearError: () => {
    set({ error: null });
  },
}));