// ─── Risk Categories ─────────────────────────────────────────────────────────

export type RiskCategory =
  | "read-only"
  | "internal-write"
  | "external-api"
  | "financial"
  | "destructive"
  | "administrative";

export const RISK_CATEGORIES: RiskCategory[] = [
  "read-only",
  "internal-write",
  "external-api",
  "financial",
  "destructive",
  "administrative",
];

export const RISK_COLORS: Record<RiskCategory, string> = {
  "read-only": "green",
  "internal-write": "green",
  "external-api": "yellow",
  financial: "orange",
  destructive: "red",
  administrative: "red",
};

export const RISK_BG_CLASSES: Record<RiskCategory, string> = {
  "read-only": "bg-green-100 text-green-800 border-green-300",
  "internal-write": "bg-green-100 text-green-800 border-green-300",
  "external-api": "bg-yellow-100 text-yellow-800 border-yellow-300",
  financial: "bg-orange-100 text-orange-800 border-orange-300",
  destructive: "bg-red-100 text-red-800 border-red-300",
  administrative: "bg-red-100 text-red-800 border-red-300",
};

// ─── Tool Types ──────────────────────────────────────────────────────────────

export interface ToolBase {
  name: string;
  description?: string | null;
  risk_category: string;
  endpoint?: string | null;
  required_permissions?: string | null;
  tags?: string | null;
  active: boolean;
}

export interface ToolCreate extends ToolBase {}

export interface ToolUpdate {
  name?: string;
  description?: string | null;
  risk_category?: string;
  endpoint?: string | null;
  required_permissions?: string | null;
  tags?: string | null;
  active?: boolean;
}

export interface ToolResponse extends ToolBase {
  id: number;
  created_at: string;
  updated_at: string;
}

// ─── Role Types ──────────────────────────────────────────────────────────────

export interface RoleBase {
  name: string;
  description?: string | null;
  parent_role_id?: number | null;
  allowed_risk_levels?: string | null;
  is_system_role: boolean;
}

export interface RoleCreate extends RoleBase {}

export interface RoleUpdate {
  name?: string;
  description?: string | null;
  parent_role_id?: number | null;
  allowed_risk_levels?: string | null;
  is_system_role?: boolean;
}

export interface RoleResponse extends RoleBase {
  id: number;
  created_at: string;
  updated_at: string;
}

// ─── Permission Types ────────────────────────────────────────────────────────

export interface PermissionBase {
  tool_id: number;
  role_id: number;
  allowed: boolean;
  inherited: boolean;
  reason?: string | null;
}

export interface PermissionCreate extends PermissionBase {}

export interface PermissionUpdate {
  allowed?: boolean;
  inherited?: boolean;
  reason?: string | null;
}

export interface PermissionResponse extends PermissionBase {
  id: number;
  created_at: string;
  updated_at: string;
}

export interface BulkPermissionUpdate {
  permissions: PermissionCreate[];
}

// ─── Matrix Types ────────────────────────────────────────────────────────────

export interface MatrixCell {
  tool_id: number;
  tool_name: string;
  role_id: number;
  role_name: string;
  allowed: boolean;
  inherited: boolean;
  risk_category: string;
}

export type PermissionStatus = "allowed" | "denied" | "inherited";

// ─── Policy Types ────────────────────────────────────────────────────────────

export interface PolicyRequest {
  tools: number[];
  roles: number[];
}

export interface PolicyResponse {
  json_policy: Record<string, unknown>;
  yaml_policy: string;
  python_module: string;
}

// ─── Validation Types ────────────────────────────────────────────────────────

export interface ValidationRequest {
  agent_code: string;
  policy_json: Record<string, unknown>;
}

export interface ValidationIssue {
  tool_name: string;
  risk_category: string;
  issue_type: string;
  severity: string;
  description: string;
  recommendation: string;
}

export interface ValidationResponse {
  security_score: number;
  issues: ValidationIssue[];
  recommendations: string[];
  tool_calls_detected: string[];
  analysis: string;
}

// ─── Sprawl Analysis Types ───────────────────────────────────────────────────

export interface SprawlAnalysisRequest {
  matrix: Record<string, unknown>;
  tools: Record<string, unknown>[];
  roles: Record<string, unknown>[];
}

export interface SprawlIssue {
  issue_type: string;
  description: string;
  severity: string;
  affected_tools: string[];
  affected_roles: string[];
  recommendation: string;
}

export interface SprawlAnalysisResponse {
  sprawl_score: number;
  issues: SprawlIssue[];
  recommendations: string[];
  statistics: Record<string, unknown>;
  analysis: string;
}

// ─── Generic ─────────────────────────────────────────────────────────────────

export interface MessageResponse {
  message: string;
  detail?: string | null;
}

export interface PaginationParams {
  skip?: number;
  limit?: number;
}

// ─── UI State Types ──────────────────────────────────────────────────────────

export type TabName =
  | "tools"
  | "roles"
  | "matrix"
  | "policy"
  | "validate"
  | "sprawl";

export interface FilterState {
  riskCategory: string | null;
  active: boolean | null;
  search: string;
}