"""FastAPI application for Tool Permission Matrix Builder & Validator."""

import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db, init_db
from backend.models import Tool, Role, Permission, RiskCategory
from backend.schemas import (
    ToolCreate, ToolUpdate, ToolResponse,
    RoleCreate, RoleUpdate, RoleResponse,
    PermissionCreate, PermissionUpdate, PermissionResponse,
    BulkPermissionUpdate,
    PolicyRequest, PolicyResponse,
    ValidationRequest, ValidationResponse, ValidationIssue,
    SprawlAnalysisRequest, SprawlAnalysisResponse, SprawlIssue,
    MessageResponse,
)
from backend.services.policy_generator import generate_json, generate_yaml, generate_python_module
from backend.services.agent_validator import AgentValidator
from backend.services.sprawl_analyzer import SprawlAnalyzer


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    await init_db()
    yield


app = FastAPI(
    title="Tool Permission Matrix API",
    description="Backend API for the Tool Permission Matrix Builder & Validator",
    version="1.0.0",
    lifespan=lifespan,
)

_cors_origins = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000",
    ).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health Check ────────────────────────────────────────────────────────────

@app.get("/api/health", response_model=dict[str, Any])
async def health_check():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


# ─── Tool CRUD ───────────────────────────────────────────────────────────────

@app.get("/api/tools", response_model=list[ToolResponse])
async def list_tools(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    risk_category: str | None = Query(None),
    active: bool | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Tool)
    if risk_category:
        stmt = stmt.where(Tool.risk_category == risk_category)
    if active is not None:
        stmt = stmt.where(Tool.active == active)
    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@app.get("/api/tools/{tool_id}", response_model=ToolResponse)
async def get_tool(tool_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tool).where(Tool.id == tool_id))
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tool


@app.post("/api/tools", response_model=ToolResponse, status_code=201)
async def create_tool(tool_data: ToolCreate, db: AsyncSession = Depends(get_db)):
    # Validate risk category
    try:
        rc = RiskCategory(tool_data.risk_category)
    except ValueError:
        valid = [c.value for c in RiskCategory]
        raise HTTPException(status_code=400, detail=f"Invalid risk_category. Must be one of: {valid}")

    tool = Tool(
        name=tool_data.name,
        description=tool_data.description,
        risk_category=rc,
        endpoint=tool_data.endpoint,
        required_permissions=tool_data.required_permissions,
        tags=tool_data.tags,
        active=tool_data.active,
    )
    db.add(tool)
    await db.flush()
    await db.refresh(tool)
    return tool


@app.put("/api/tools/{tool_id}", response_model=ToolResponse)
async def update_tool(tool_id: int, tool_data: ToolUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tool).where(Tool.id == tool_id))
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")

    update_data = tool_data.model_dump(exclude_unset=True)
    if "risk_category" in update_data:
        try:
            update_data["risk_category"] = RiskCategory(update_data["risk_category"])
        except ValueError:
            valid = [c.value for c in RiskCategory]
            raise HTTPException(status_code=400, detail=f"Invalid risk_category. Must be one of: {valid}")

    for key, value in update_data.items():
        setattr(tool, key, value)

    await db.flush()
    await db.refresh(tool)
    return tool


@app.delete("/api/tools/{tool_id}", response_model=MessageResponse)
async def delete_tool(tool_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tool).where(Tool.id == tool_id))
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    await db.delete(tool)
    await db.flush()
    return MessageResponse(message=f"Tool '{tool.name}' deleted")


# ─── Role CRUD ───────────────────────────────────────────────────────────────

@app.get("/api/roles", response_model=list[RoleResponse])
async def list_roles(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Role).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@app.get("/api/roles/{role_id}", response_model=RoleResponse)
async def get_role(role_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role


@app.post("/api/roles", response_model=RoleResponse, status_code=201)
async def create_role(role_data: RoleCreate, db: AsyncSession = Depends(get_db)):
    # Validate parent role if provided
    if role_data.parent_role_id is not None:
        result = await db.execute(select(Role).where(Role.id == role_data.parent_role_id))
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Parent role not found")

    role = Role(
        name=role_data.name,
        description=role_data.description,
        parent_role_id=role_data.parent_role_id,
        allowed_risk_levels=role_data.allowed_risk_levels,
        is_system_role=role_data.is_system_role,
    )
    db.add(role)
    await db.flush()
    await db.refresh(role)
    return role


@app.put("/api/roles/{role_id}", response_model=RoleResponse)
async def update_role(role_id: int, role_data: RoleUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    update_data = role_data.model_dump(exclude_unset=True)

    # Validate parent role if being changed
    if "parent_role_id" in update_data and update_data["parent_role_id"] is not None:
        if update_data["parent_role_id"] == role_id:
            raise HTTPException(status_code=400, detail="A role cannot be its own parent")
        result = await db.execute(select(Role).where(Role.id == update_data["parent_role_id"]))
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Parent role not found")

    for key, value in update_data.items():
        setattr(role, key, value)

    await db.flush()
    await db.refresh(role)
    return role


@app.delete("/api/roles/{role_id}", response_model=MessageResponse)
async def delete_role(role_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    await db.delete(role)
    await db.flush()
    return MessageResponse(message=f"Role '{role.name}' deleted")


# ─── Permission CRUD ─────────────────────────────────────────────────────────

@app.get("/api/permissions", response_model=list[PermissionResponse])
async def list_permissions(
    tool_id: int | None = Query(None),
    role_id: int | None = Query(None),
    allowed: bool | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Permission)
    if tool_id is not None:
        stmt = stmt.where(Permission.tool_id == tool_id)
    if role_id is not None:
        stmt = stmt.where(Permission.role_id == role_id)
    if allowed is not None:
        stmt = stmt.where(Permission.allowed == allowed)
    result = await db.execute(stmt)
    return result.scalars().all()


@app.post("/api/permissions", response_model=PermissionResponse, status_code=201)
async def create_permission(perm_data: PermissionCreate, db: AsyncSession = Depends(get_db)):
    # Validate tool and role exist
    tool_result = await db.execute(select(Tool).where(Tool.id == perm_data.tool_id))
    if not tool_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Tool not found")
    role_result = await db.execute(select(Role).where(Role.id == perm_data.role_id))
    if not role_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Role not found")

    # Check for existing permission
    existing = await db.execute(
        select(Permission).where(
            Permission.tool_id == perm_data.tool_id,
            Permission.role_id == perm_data.role_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Permission already exists for this tool-role pair")

    permission = Permission(**perm_data.model_dump())
    db.add(permission)
    await db.flush()
    await db.refresh(permission)
    return permission


@app.put("/api/permissions/{permission_id}", response_model=PermissionResponse)
async def update_permission(
    permission_id: int, perm_data: PermissionUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Permission).where(Permission.id == permission_id))
    permission = result.scalar_one_or_none()
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")

    update_data = perm_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(permission, key, value)

    await db.flush()
    await db.refresh(permission)
    return permission


@app.post("/api/permissions/bulk", response_model=list[PermissionResponse])
async def bulk_update_permissions(
    bulk_data: BulkPermissionUpdate, db: AsyncSession = Depends(get_db)
):
    results = []
    for perm_data in bulk_data.permissions:
        # Upsert: try to find existing
        existing = await db.execute(
            select(Permission).where(
                Permission.tool_id == perm_data.tool_id,
                Permission.role_id == perm_data.role_id,
            )
        )
        existing_perm = existing.scalar_one_or_none()

        if existing_perm:
            existing_perm.allowed = perm_data.allowed
            existing_perm.inherited = perm_data.inherited
            existing_perm.reason = perm_data.reason
            await db.flush()
            await db.refresh(existing_perm)
            results.append(existing_perm)
        else:
            permission = Permission(**perm_data.model_dump())
            db.add(permission)
            await db.flush()
            await db.refresh(permission)
            results.append(permission)

    return results


@app.delete("/api/permissions/{permission_id}", response_model=MessageResponse)
async def delete_permission(permission_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Permission).where(Permission.id == permission_id))
    permission = result.scalar_one_or_none()
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")
    await db.delete(permission)
    await db.flush()
    return MessageResponse(message=f"Permission {permission_id} deleted")


# ─── Matrix (full permission grid) ───────────────────────────────────────────

@app.get("/api/matrix", response_model=list[dict[str, Any]])
async def get_matrix(db: AsyncSession = Depends(get_db)):
    """Get the full permission matrix with resolved tool and role info."""
    tools_result = await db.execute(select(Tool).where(Tool.active == True))
    tools = tools_result.scalars().all()

    roles_result = await db.execute(select(Role))
    roles = roles_result.scalars().all()

    perms_result = await db.execute(select(Permission))
    permissions = perms_result.scalars().all()

    # Build permission lookup
    perm_map = {}
    for p in permissions:
        perm_map[(p.tool_id, p.role_id)] = p

    matrix = []
    for tool in tools:
        for role in roles:
            perm = perm_map.get((tool.id, role.id))
            matrix.append({
                "tool_id": tool.id,
                "tool_name": tool.name,
                "role_id": role.id,
                "role_name": role.name,
                "risk_category": tool.risk_category.value if isinstance(tool.risk_category, RiskCategory) else tool.risk_category,
                "allowed": perm.allowed if perm else False,
                "inherited": perm.inherited if perm else False,
            })
    return matrix


# ─── Policy Generation ───────────────────────────────────────────────────────

@app.post("/api/policy/generate", response_model=PolicyResponse)
async def generate_policy(
    request: PolicyRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate JSON, YAML, and Python policy from the permission matrix."""
    # Fetch requested tools and roles
    tools_result = await db.execute(
        select(Tool).where(Tool.id.in_(request.tools))
    )
    tools = tools_result.scalars().all()

    roles_result = await db.execute(
        select(Role).where(Role.id.in_(request.roles))
    )
    roles = roles_result.scalars().all()

    if not tools or not roles:
        raise HTTPException(status_code=400, detail="Must include at least one tool and one role")

    # Get permissions for these combos
    perms_result = await db.execute(
        select(Permission).where(
            Permission.tool_id.in_(request.tools),
            Permission.role_id.in_(request.roles),
        )
    )
    permissions = perms_result.scalars().all()

    # Build matrix cells
    perm_lookup = {(p.tool_id, p.role_id): p for p in permissions}
    matrix = []
    for tool in tools:
        for role in roles:
            perm = perm_lookup.get((tool.id, role.id))
            risk_cat = tool.risk_category.value if isinstance(tool.risk_category, RiskCategory) else tool.risk_category
            matrix.append({
                "tool_id": tool.id,
                "tool_name": tool.name,
                "role_id": role.id,
                "role_name": role.name,
                "risk_category": risk_cat,
                "allowed": perm.allowed if perm else False,
                "inherited": perm.inherited if perm else False,
            })

    tool_dicts = [
        {
            "id": t.id, "name": t.name, "risk_category": t.risk_category.value if isinstance(t.risk_category, RiskCategory) else t.risk_category,
            "description": t.description or "", "endpoint": t.endpoint or "",
        }
        for t in tools
    ]
    role_dicts = [
        {
            "id": r.id, "name": r.name, "description": r.description or "",
            "parent_role_id": r.parent_role_id,
        }
        for r in roles
    ]

    json_policy = generate_json(matrix, tool_dicts, role_dicts)
    yaml_policy = generate_yaml(matrix, tool_dicts, role_dicts)
    python_module = generate_python_module(matrix, tool_dicts, role_dicts)

    json_policy["generated_at"] = datetime.now(timezone.utc).isoformat()

    return PolicyResponse(
        json_policy=json_policy,
        yaml_policy=yaml_policy,
        python_module=python_module,
    )


# ─── Agent Validation ────────────────────────────────────────────────────────

@app.post("/api/validate", response_model=ValidationResponse)
async def validate_agent(
    request: ValidationRequest,
    db: AsyncSession = Depends(get_db),
):
    """Validate agent code against a permission policy."""
    validator = AgentValidator()
    result = validator.validate(request.agent_code, request.policy_json)

    issues = [
        ValidationIssue(**issue) for issue in result.get("issues", [])
    ]

    return ValidationResponse(
        security_score=result.get("security_score", 0),
        issues=issues,
        recommendations=result.get("recommendations", []),
        tool_calls_detected=result.get("tool_calls_detected", []),
        analysis=result.get("analysis", ""),
    )


# ─── Sprawl Analysis ─────────────────────────────────────────────────────────

@app.post("/api/sprawl/analysis", response_model=SprawlAnalysisResponse)
async def sprawl_analysis(
    request: SprawlAnalysisRequest,
    db: AsyncSession = Depends(get_db),
):
    """Analyze permission matrix for sprawl."""
    analyzer = SprawlAnalyzer()
    result = analyzer.analyze(
        matrix=request.matrix,
        tools=request.tools,
        roles=request.roles,
    )

    issues = [
        SprawlIssue(**issue) for issue in result.get("issues", [])
    ]

    return SprawlAnalysisResponse(
        sprawl_score=result.get("sprawl_score", 0),
        issues=issues,
        recommendations=result.get("recommendations", []),
        statistics=result.get("statistics", {}),
        analysis=result.get("analysis", ""),
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)