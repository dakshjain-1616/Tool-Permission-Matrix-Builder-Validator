// API Client for the Tool Permission Matrix backend

import axios, { AxiosInstance } from "axios";
import type {
  ToolCreate,
  ToolUpdate,
  ToolResponse,
  RoleCreate,
  RoleUpdate,
  RoleResponse,
  PermissionCreate,
  PermissionUpdate,
  PermissionResponse,
  BulkPermissionUpdate,
  MatrixCell,
  PolicyRequest,
  PolicyResponse,
  ValidationRequest,
  ValidationResponse,
  SprawlAnalysisRequest,
  SprawlAnalysisResponse,
  MessageResponse,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

class ApiClient {
  private client: AxiosInstance;

  constructor(baseURL: string = API_BASE_URL) {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  // ─── Health ────────────────────────────────────────────────────────────────

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const { data } = await this.client.get("/api/health");
    return data;
  }

  // ─── Tools CRUD ────────────────────────────────────────────────────────────

  async listTools(params?: {
    skip?: number;
    limit?: number;
    risk_category?: string;
    active?: boolean;
  }): Promise<ToolResponse[]> {
    const { data } = await this.client.get("/api/tools", { params });
    return data;
  }

  async getTool(id: number): Promise<ToolResponse> {
    const { data } = await this.client.get(`/api/tools/${id}`);
    return data;
  }

  async createTool(tool: ToolCreate): Promise<ToolResponse> {
    const { data } = await this.client.post("/api/tools", tool);
    return data;
  }

  async updateTool(id: number, tool: ToolUpdate): Promise<ToolResponse> {
    const { data } = await this.client.put(`/api/tools/${id}`, tool);
    return data;
  }

  async deleteTool(id: number): Promise<MessageResponse> {
    const { data } = await this.client.delete(`/api/tools/${id}`);
    return data;
  }

  // ─── Roles CRUD ────────────────────────────────────────────────────────────

  async listRoles(params?: {
    skip?: number;
    limit?: number;
  }): Promise<RoleResponse[]> {
    const { data } = await this.client.get("/api/roles", { params });
    return data;
  }

  async getRole(id: number): Promise<RoleResponse> {
    const { data } = await this.client.get(`/api/roles/${id}`);
    return data;
  }

  async createRole(role: RoleCreate): Promise<RoleResponse> {
    const { data } = await this.client.post("/api/roles", role);
    return data;
  }

  async updateRole(id: number, role: RoleUpdate): Promise<RoleResponse> {
    const { data } = await this.client.put(`/api/roles/${id}`, role);
    return data;
  }

  async deleteRole(id: number): Promise<MessageResponse> {
    const { data } = await this.client.delete(`/api/roles/${id}`);
    return data;
  }

  // ─── Permissions CRUD ──────────────────────────────────────────────────────

  async listPermissions(params?: {
    tool_id?: number;
    role_id?: number;
    allowed?: boolean;
  }): Promise<PermissionResponse[]> {
    const { data } = await this.client.get("/api/permissions", { params });
    return data;
  }

  async createPermission(
    perm: PermissionCreate
  ): Promise<PermissionResponse> {
    const { data } = await this.client.post("/api/permissions", perm);
    return data;
  }

  async updatePermission(
    id: number,
    perm: PermissionUpdate
  ): Promise<PermissionResponse> {
    const { data } = await this.client.put(`/api/permissions/${id}`, perm);
    return data;
  }

  async bulkUpdatePermissions(
    bulk: BulkPermissionUpdate
  ): Promise<PermissionResponse[]> {
    const { data } = await this.client.post("/api/permissions/bulk", bulk);
    return data;
  }

  async deletePermission(id: number): Promise<MessageResponse> {
    const { data } = await this.client.delete(`/api/permissions/${id}`);
    return data;
  }

  // ─── Matrix ────────────────────────────────────────────────────────────────

  async getMatrix(): Promise<MatrixCell[]> {
    const { data } = await this.client.get("/api/matrix");
    return data;
  }

  // ─── Policy Generation ─────────────────────────────────────────────────────

  async generatePolicy(request: PolicyRequest): Promise<PolicyResponse> {
    const { data } = await this.client.post("/api/policy/generate", request);
    return data;
  }

  // ─── Agent Validation ──────────────────────────────────────────────────────

  async validateAgent(request: ValidationRequest): Promise<ValidationResponse> {
    const { data } = await this.client.post("/api/validate", request);
    return data;
  }

  // ─── Sprawl Analysis ───────────────────────────────────────────────────────

  async analyzeSprawl(
    request: SprawlAnalysisRequest
  ): Promise<SprawlAnalysisResponse> {
    const { data } = await this.client.post("/api/sprawl/analysis", request);
    return data;
  }
}

export const apiClient = new ApiClient();
export default ApiClient;