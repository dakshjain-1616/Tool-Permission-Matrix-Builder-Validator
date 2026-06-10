"""Policy generation service: JSON, YAML, and Python module."""

import json
from typing import Any

import yaml


def generate_json(matrix: list[dict[str, Any]], tools: list[dict[str, Any]] | None = None, roles: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    """Generate a JSON policy document from the permission matrix."""
    policy = {
        "policy_version": "1.0",
        "generated_at": None,  # Will be set by caller
        "tools": {},
        "roles": {},
        "permissions": {},
        "risk_thresholds": {
            "read-only": {"max_score": 10, "color": "green"},
            "internal-write": {"max_score": 30, "color": "green"},
            "external-api": {"max_score": 50, "color": "yellow"},
            "financial": {"max_score": 70, "color": "orange"},
            "destructive": {"max_score": 90, "color": "red"},
            "administrative": {"max_score": 100, "color": "red"},
        },
    }

    # Build tools map
    for cell in matrix:
        tid = str(cell["tool_id"])
        if tid not in policy["tools"]:
            policy["tools"][tid] = {
                "id": cell["tool_id"],
                "name": cell["tool_name"],
                "risk_category": cell["risk_category"],
            }

    # Build roles and permissions
    for cell in matrix:
        rid = str(cell["role_id"])
        if rid not in policy["roles"]:
            policy["roles"][rid] = {
                "id": cell["role_id"],
                "name": cell["role_name"],
            }

        if rid not in policy["permissions"]:
            policy["permissions"][rid] = {}

        policy["permissions"][rid][str(cell["tool_id"])] = {
            "allowed": cell["allowed"],
            "inherited": cell["inherited"],
        }

    if tools:
        for tool in tools:
            tid = str(tool["id"])
            if tid in policy["tools"]:
                policy["tools"][tid].update({
                    "description": tool.get("description", ""),
                    "endpoint": tool.get("endpoint", ""),
                })

    if roles:
        for role in roles:
            rid = str(role["id"])
            if rid in policy["roles"]:
                policy["roles"][rid].update({
                    "description": role.get("description", ""),
                    "parent_role_id": role.get("parent_role_id"),
                })

    return policy


def generate_yaml(matrix: list[dict[str, Any]], tools: list[dict[str, Any]] | None = None, roles: list[dict[str, Any]] | None = None) -> str:
    """Generate a YAML policy document from the permission matrix."""
    policy = generate_json(matrix, tools, roles)
    return yaml.dump(policy, default_flow_style=False, sort_keys=False, allow_unicode=True)


def generate_python_module(matrix: list[dict[str, Any]], tools: list[dict[str, Any]] | None = None, roles: list[dict[str, Any]] | None = None) -> str:
    """Generate a syntactically correct Python permissions module."""
    json_policy = generate_json(matrix, tools, roles)

    lines = [
        '"""Auto-generated Tool Permission Policy Module.',
        "",
        "This module defines the permission matrix as Python data structures.",
        "Use it to enforce tool access controls in your agent runtime.",
        '"""',
        "",
        "from enum import Enum",
        "from dataclasses import dataclass, field",
        "from typing import Any, Optional",
        "",
        "",
        "class RiskCategory(str, Enum):",
        '    """All 6 risk categories for tool access control."""',
        '    READ_ONLY = "read-only"',
        '    INTERNAL_WRITE = "internal-write"',
        '    EXTERNAL_API = "external-api"',
        '    FINANCIAL = "financial"',
        '    DESTRUCTIVE = "destructive"',
        '    ADMINISTRATIVE = "administrative"',
        "",
        "",
        "POLICY_VERSION = \"1.0\"",
        "",
        "",
        "@dataclass",
        "class ToolDefinition:",
        '    """Definition of a tool in the permission system."""',
        "    id: int",
        "    name: str",
        '    risk_category: str = "read-only"',
        '    description: str = ""',
        '    endpoint: str = ""',
        "",
        '    def is_dangerous(self) -> bool:',
        '        """Check if tool belongs to a high-risk category."""',
        '        return self.risk_category in (RiskCategory.DESTRUCTIVE, RiskCategory.ADMINISTRATIVE)',
        "",
        "",
        "@dataclass",
        "class PermissionEntry:",
        '    """Permission entry for a specific tool-role pair."""',
        "    tool_id: int",
        "    role_id: int",
        "    allowed: bool = False",
        "    inherited: bool = False",
        "",
        "",
        "@dataclass",
        "class RoleDefinition:",
        '    """Definition of a role in the permission system."""',
        "    id: int",
        "    name: str",
        '    description: str = ""',
        "    parent_role_id: Optional[int] = None",
        "",
        "",
        "# ─── Tool Definitions ────────────────────────────────────────────────",
        "TOOLS: dict[int, ToolDefinition] = {",
    ]

    # Add tool definitions
    for tid, tool in json_policy["tools"].items():
        tid_int = int(tid)
        name_escaped = tool["name"].replace("'", "\\'")
        risk_cat = tool.get("risk_category", "read-only")
        desc = tool.get("description", "")
        endpoint = tool.get("endpoint", "")
        lines.append(f"    {tid_int}: ToolDefinition(id={tid_int}, name='{name_escaped}', risk_category='{risk_cat}', description='{desc}', endpoint='{endpoint}'),")

    lines += [
        "}",
        "",
        "# ─── Role Definitions ────────────────────────────────────────────────",
        "ROLES: dict[int, RoleDefinition] = {",
    ]

    for rid, role in json_policy["roles"].items():
        rid_int = int(rid)
        name_escaped = role["name"].replace("'", "\\'")
        desc = role.get("description", "")
        parent = role.get("parent_role_id")
        parent_str = f"parent_role_id={parent}" if parent is not None else ""
        lines.append(f"    {rid_int}: RoleDefinition(id={rid_int}, name='{name_escaped}', description='{desc}'{', ' + parent_str if parent_str else ''}),")

    lines += [
        "}",
        "",
        "# ─── Permission Matrix ───────────────────────────────────────────────",
        "# PERMISSIONS[role_id][tool_id] = PermissionEntry",
        "PERMISSIONS: dict[int, dict[int, PermissionEntry]] = {",
    ]

    for rid, perm_dict in json_policy["permissions"].items():
        rid_int = int(rid)
        lines.append(f"    {rid_int}: {{")
        for tid, perm in perm_dict.items():
            tid_int = int(tid)
            allowed_str = "True" if perm["allowed"] else "False"
            inherited_str = "True" if perm["inherited"] else "False"
            lines.append(f"        {tid_int}: PermissionEntry(tool_id={tid_int}, role_id={rid_int}, allowed={allowed_str}, inherited={inherited_str}),")
        lines.append("    },")

    lines += [
        "}",
        "",
        "",
        "def check_permission(role_id: int, tool_id: int) -> bool:",
        '    """Check if a role has permission to use a specific tool."""',
        "    role_perms = PERMISSIONS.get(role_id)",
        "    if role_perms is None:",
        "        return False",
        "    entry = role_perms.get(tool_id)",
        "    if entry is None:",
        "        return False",
        "    return entry.allowed",
        "",
        "",
        "def get_tools_for_role(role_id: int, only_allowed: bool = True) -> list[int]:",
        '    """Get all tool IDs accessible to a role."""',
        "    role_perms = PERMISSIONS.get(role_id, {})",
        "    if only_allowed:",
        "        return [tid for tid, entry in role_perms.items() if entry.allowed]",
        "    return list(role_perms.keys())",
        "",
        "",
        "def get_roles_for_tool(tool_id: int, only_allowed: bool = True) -> list[int]:",
        '    """Get all role IDs that can access a tool."""',
        "    result = []",
        "    for rid, role_perms in PERMISSIONS.items():",
        "        entry = role_perms.get(tool_id)",
        "        if entry and (not only_allowed or entry.allowed):",
        "            result.append(rid)",
        "    return result",
    ]

    return "\n".join(lines) + "\n"