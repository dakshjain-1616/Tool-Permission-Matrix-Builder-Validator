import { create } from "zustand";
import type { RoleCreate, RoleResponse, RoleUpdate } from "../types";
import { apiClient } from "../api/client";

interface RoleStore {
  // State
  roles: RoleResponse[];
  loading: boolean;
  error: string | null;
  selectedRoleId: number | null;

  // Actions
  fetchRoles: () => Promise<void>;
  createRole: (role: RoleCreate) => Promise<RoleResponse | null>;
  updateRole: (id: number, role: RoleUpdate) => Promise<RoleResponse | null>;
  deleteRole: (id: number) => Promise<boolean>;
  selectRole: (id: number | null) => void;
  clearError: () => void;
}

export const useRoleStore = create<RoleStore>((set) => ({
  roles: [],
  loading: false,
  error: null,
  selectedRoleId: null,

  fetchRoles: async () => {
    set({ loading: true, error: null });
    try {
      const roles = await apiClient.listRoles();
      set({ roles, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch roles";
      set({ error: message, loading: false });
    }
  },

  createRole: async (role) => {
    set({ loading: true, error: null });
    try {
      const created = await apiClient.createRole(role);
      set((state) => ({ roles: [...state.roles, created], loading: false }));
      return created;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create role";
      set({ error: message, loading: false });
      return null;
    }
  },

  updateRole: async (id, role) => {
    set({ loading: true, error: null });
    try {
      const updated = await apiClient.updateRole(id, role);
      set((state) => ({
        roles: state.roles.map((r) => (r.id === id ? updated : r)),
        loading: false,
      }));
      return updated;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update role";
      set({ error: message, loading: false });
      return null;
    }
  },

  deleteRole: async (id) => {
    set({ loading: true, error: null });
    try {
      await apiClient.deleteRole(id);
      set((state) => ({
        roles: state.roles.filter((r) => r.id !== id),
        loading: false,
      }));
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete role";
      set({ error: message, loading: false });
      return false;
    }
  },

  selectRole: (id) => {
    set({ selectedRoleId: id });
  },

  clearError: () => {
    set({ error: null });
  },
}));