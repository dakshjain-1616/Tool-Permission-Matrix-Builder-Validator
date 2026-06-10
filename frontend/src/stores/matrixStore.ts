import { create } from "zustand";
import type {
  MatrixCell,
  PermissionCreate,
  PermissionStatus,
  PolicyResponse,
  ValidationResponse,
  SprawlAnalysisResponse,
} from "../types";
import { apiClient } from "../api/client";

interface MatrixStore {
  // State
  cells: MatrixCell[];
  loading: boolean;
  error: string | null;

  // Policy
  policyResult: PolicyResponse | null;
  policyLoading: boolean;

  // Validation
  validationResult: ValidationResponse | null;
  validationLoading: boolean;

  // Sprawl
  sprawlResult: SprawlAnalysisResponse | null;
  sprawlLoading: boolean;

  // Actions
  fetchMatrix: () => Promise<void>;
  toggleCell: (toolId: number, roleId: number) => Promise<void>;
  updateCell: (
    toolId: number,
    roleId: number,
    allowed: boolean
  ) => Promise<void>;
  getCellStatus: (toolId: number, roleId: number) => PermissionStatus;

  // Policy generation
  generatePolicy: (
    toolIds: number[],
    roleIds: number[]
  ) => Promise<void>;

  // Validation
  validateAgent: (
    agentCode: string,
    policyJson: Record<string, unknown>
  ) => Promise<void>;

  // Sprawl analysis
  analyzeSprawl: (
    matrix: Record<string, unknown>,
    tools: Record<string, unknown>[],
    roles: Record<string, unknown>[]
  ) => Promise<void>;

  clearError: () => void;
  resetPolicy: () => void;
  resetValidation: () => void;
  resetSprawl: () => void;
}

export const useMatrixStore = create<MatrixStore>((set, get) => ({
  cells: [],
  loading: false,
  error: null,
  policyResult: null,
  policyLoading: false,
  validationResult: null,
  validationLoading: false,
  sprawlResult: null,
  sprawlLoading: false,

  fetchMatrix: async () => {
    set({ loading: true, error: null });
    try {
      const cells = await apiClient.getMatrix();
      set({ cells, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch matrix";
      set({ error: message, loading: false });
    }
  },

  toggleCell: async (toolId, roleId) => {
    const { cells } = get();
    const cell = cells.find(
      (c) => c.tool_id === toolId && c.role_id === roleId
    );
    const newAllowed = !(cell?.allowed ?? false);
    await get().updateCell(toolId, roleId, newAllowed);
  },

  updateCell: async (toolId, roleId, allowed) => {
    set({ loading: true, error: null });
    try {
      const perm: PermissionCreate = {
        tool_id: toolId,
        role_id: roleId,
        allowed,
        inherited: false,
        reason: allowed ? "Granted via matrix UI" : "Revoked via matrix UI",
      };

      await apiClient.bulkUpdatePermissions({ permissions: [perm] });

      set((state) => ({
        cells: state.cells.map((c) =>
          c.tool_id === toolId && c.role_id === roleId
            ? { ...c, allowed, inherited: false }
            : c
        ),
        loading: false,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update permission";
      set({ error: message, loading: false });
    }
  },

  getCellStatus: (toolId, roleId) => {
    const { cells } = get();
    const cell = cells.find(
      (c) => c.tool_id === toolId && c.role_id === roleId
    );
    if (!cell) return "denied";
    if (cell.inherited) return "inherited";
    return cell.allowed ? "allowed" : "denied";
  },

  generatePolicy: async (toolIds, roleIds) => {
    set({ policyLoading: true, error: null, policyResult: null });
    try {
      const result = await apiClient.generatePolicy({
        tools: toolIds,
        roles: roleIds,
      });
      set({ policyResult: result, policyLoading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate policy";
      set({ error: message, policyLoading: false });
    }
  },

  validateAgent: async (agentCode, policyJson) => {
    set({ validationLoading: true, error: null, validationResult: null });
    try {
      const result = await apiClient.validateAgent({
        agent_code: agentCode,
        policy_json: policyJson,
      });
      set({ validationResult: result, validationLoading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to validate agent";
      set({ error: message, validationLoading: false });
    }
  },

  analyzeSprawl: async (matrix, tools, roles) => {
    set({ sprawlLoading: true, error: null, sprawlResult: null });
    try {
      const result = await apiClient.analyzeSprawl({ matrix, tools, roles });
      set({ sprawlResult: result, sprawlLoading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to analyze sprawl";
      set({ error: message, sprawlLoading: false });
    }
  },

  clearError: () => set({ error: null }),
  resetPolicy: () => set({ policyResult: null, policyLoading: false }),
  resetValidation: () => set({ validationResult: null, validationLoading: false }),
  resetSprawl: () => set({ sprawlResult: null, sprawlLoading: false }),
}));