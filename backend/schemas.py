"""Pydantic v2 schemas for Tool Permission Matrix API."""

from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field


# ─── Risk Category ───────────────────────────────────────────────────────────

class RiskCategoryEnum(str):
    """Risk categories used across tool & permission schemas."""
    READ_ONLY = "read-only"
    INTERNAL_WRITE = "internal-write"
    EXTERNAL_API = "external-api"
    FINANCIAL = "financial"
    DESTRUCTIVE = "destructive"
    ADMINISTRATIVE = "administrative"


# ─── Tool Schemas ────────────────────────────────────────────────────────────

class ToolBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Tool name")
    description: Optional[str] = Field(None, description="Human-readable description")
    risk_category: str = Field(default="read-only", description="Risk category")
    endpoint: Optional[str] = Field(None, max_length=512, description="API endpoint if applicable")
    required_permissions: Optional[str] = Field(None, description="JSON string of required permissions")
    tags: Optional[str] = Field(None, description="JSON string array of tags")
    active: bool = Field(default=True, description="Whether the tool is active")


class ToolCreate(ToolBase):
    pass


class ToolUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    risk_category: Optional[str] = None
    endpoint: Optional[str] = None
    required_permissions: Optional[str] = None
    tags: Optional[str] = None
    active: Optional[bool] = None


class ToolResponse(ToolBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Role Schemas ────────────────────────────────────────────────────────────

class RoleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Role name")
    description: Optional[str] = Field(None, description="Role description")
    parent_role_id: Optional[int] = Field(None, description="Parent role ID for inheritance")
    allowed_risk_levels: Optional[str] = Field(
        None,
        description="JSON array of allowed risk category strings"
    )
    is_system_role: bool = Field(default=False)


class RoleCreate(RoleBase):
    pass


class RoleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    parent_role_id: Optional[int] = None
    allowed_risk_levels: Optional[str] = None
    is_system_role: Optional[bool] = None


class RoleResponse(RoleBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Permission Schemas ──────────────────────────────────────────────────────

class PermissionBase(BaseModel):
    tool_id: int = Field(..., description="Tool ID")
    role_id: int = Field(..., description="Role ID")
    allowed: bool = Field(default=False, description="Whether access is allowed")
    inherited: bool = Field(default=False, description="Whether inherited from parent role")
    reason: Optional[str] = Field(None, description="Reason for the permission")


class PermissionCreate(PermissionBase):
    pass


class PermissionUpdate(BaseModel):
    allowed: Optional[bool] = None
    inherited: Optional[bool] = None
    reason: Optional[str] = None


class PermissionResponse(PermissionBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BulkPermissionUpdate(BaseModel):
    permissions: list[PermissionCreate] = Field(..., description="List of permissions to upsert")


# ─── Policy Schemas ──────────────────────────────────────────────────────────

class MatrixCell(BaseModel):
    tool_id: int
    tool_name: str
    role_id: int
    role_name: str
    allowed: bool
    inherited: bool
    risk_category: str


class PolicyRequest(BaseModel):
    tools: list[int] = Field(..., description="List of tool IDs to include")
    roles: list[int] = Field(..., description="List of role IDs to include")


class PolicyResponse(BaseModel):
    json_policy: dict[str, Any] = Field(..., description="JSON policy document")
    yaml_policy: str = Field(..., description="YAML policy document")
    python_module: str = Field(..., description="Python permissions module source code")


# ─── Validation Schemas ──────────────────────────────────────────────────────

class ValidationRequest(BaseModel):
    agent_code: str = Field(..., description="Agent source code to analyze")
    policy_json: dict[str, Any] = Field(..., description="Policy to validate against")


class ValidationIssue(BaseModel):
    tool_name: str
    risk_category: str
    issue_type: str = Field(..., description="e.g. 'missing_permission', 'excessive_access', 'unknown_tool'")
    severity: str = Field(default="medium", description="low / medium / high / critical")
    description: str
    recommendation: str


class ValidationResponse(BaseModel):
    security_score: int = Field(..., ge=0, le=100, description="Security score 0-100")
    issues: list[ValidationIssue] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    tool_calls_detected: list[str] = Field(default_factory=list)
    analysis: str = Field(default="", description="Claude analysis summary")


# ─── Sprawl Analysis Schemas ─────────────────────────────────────────────────

class SprawlAnalysisRequest(BaseModel):
    matrix: dict[str, Any] = Field(..., description="Full permission matrix to analyze")
    tools: list[dict[str, Any]] = Field(..., description="All tools in the system")
    roles: list[dict[str, Any]] = Field(..., description="All roles in the system")


class SprawlIssue(BaseModel):
    issue_type: str = Field(..., description="e.g. 'excessive_access', 'redundant_tool', 'over_exposed_role'")
    description: str
    severity: str = Field(default="medium")
    affected_tools: list[str] = Field(default_factory=list)
    affected_roles: list[str] = Field(default_factory=list)
    recommendation: str


class SprawlAnalysisResponse(BaseModel):
    sprawl_score: int = Field(..., ge=0, le=100, description="Sprawl score 0-100 (higher = more sprawl)")
    issues: list[SprawlIssue] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    statistics: dict[str, Any] = Field(default_factory=dict, description="Summary statistics")
    analysis: str = Field(default="", description="Claude analysis summary")


# ─── Generic Response ────────────────────────────────────────────────────────

class MessageResponse(BaseModel):
    message: str
    detail: Optional[str] = None