"""Sprawl analysis service using Claude to analyze permission matrix for sprawl."""

import json
import logging
import os
import re
from typing import Any

from anthropic import AsyncAnthropic

logger = logging.getLogger(__name__)


def _api_key() -> str:
    return os.environ.get("OPENROUTER_API_KEY") or os.environ.get("ANTHROPIC_API_KEY", "")


def _client_kwargs(key: str) -> dict:
    kw: dict = {"api_key": key}
    if os.environ.get("OPENROUTER_API_KEY"):
        kw["base_url"] = "https://openrouter.ai/api"
        kw["default_headers"] = {"HTTP-Referer": "https://github.com/neo-agent-tools", "X-Title": "NEO Agent Tools"}
    return kw


def _model() -> str:
    if os.environ.get("OPENROUTER_API_KEY"):
        return os.environ.get("MODEL_NAME", "anthropic/claude-sonnet-4-5")
    return os.environ.get("MODEL_NAME", "claude-sonnet-4-20250514")


class SprawlAnalyzer:
    """Analyzes permission matrices for sprawl: excessive access, redundancy, over-exposure."""

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or _api_key()
        self.model = _model()
        self.client = AsyncAnthropic(**_client_kwargs(self.api_key)) if self.api_key else None

    async def analyze(
        self,
        matrix: dict[str, Any],
        tools: list[dict[str, Any]],
        roles: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Analyze the permission matrix for sprawl.

        Returns dict with:
        - sprawl_score: int 0-100
        - issues: list of SprawlIssue dicts
        - recommendations: list of strings
        - statistics: dict of summary stats
        - analysis: string summary
        """
        # Always do heuristic analysis first
        heuristic_result = self._heuristic_analysis(matrix, tools, roles)

        # If Claude is available, enhance with AI analysis
        if self.client:
            try:
                claude_result = await self._claude_analysis(matrix, tools, roles)
                # Merge: use Claude's score and analysis, keep heuristic issues + recommendations
                heuristic_result["sprawl_score"] = claude_result.get("sprawl_score", heuristic_result["sprawl_score"])
                heuristic_result["analysis"] = claude_result.get("analysis") or heuristic_result["analysis"]
                heuristic_result["analysis"] += "\n\n---\n\n" + claude_result.get("claude_notes", "")

                # Add any new issues from Claude not already in heuristic
                existing_types = {i["issue_type"] for i in heuristic_result["issues"]}
                for issue in claude_result.get("issues", []):
                    if issue["issue_type"] not in existing_types:
                        heuristic_result["issues"].append(issue)
                        existing_types.add(issue["issue_type"])

                # Add any new recommendations
                existing_recs = set(heuristic_result["recommendations"])
                for rec in claude_result.get("recommendations", []):
                    if rec not in existing_recs:
                        heuristic_result["recommendations"].append(rec)
                        existing_recs.add(rec)

            except Exception as e:
                heuristic_result["analysis"] += f"\n\nClaude enhancement unavailable: {e!s}"

        # Sort issues by severity
        severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        heuristic_result["issues"].sort(key=lambda x: severity_order.get(x.get("severity", "medium"), 4))

        return heuristic_result

    @staticmethod
    def _is_allowed(perm: Any) -> bool:
        """Accept both dict form {'allowed': True} and string form 'ALLOWED'/'INHERITED'/'DENIED'."""
        if isinstance(perm, dict):
            return bool(perm.get('allowed', False))
        return str(perm).upper() in ('ALLOWED', 'INHERITED')

    @staticmethod
    def _is_inherited(perm: Any) -> bool:
        if isinstance(perm, dict):
            return bool(perm.get('inherited', False))
        return str(perm).upper() == 'INHERITED'

    def _heuristic_analysis(
        self, matrix: dict[str, Any], tools: list[dict[str, Any]], roles: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """Heuristic sprawl analysis based on rules."""
        issues = []
        recommendations = []
        stats = {}

        permissions = matrix.get("permissions", {})
        known_tools = {str(t["id"]): t for t in tools}
        known_roles = {str(r["id"]): r for r in roles}

        # Statistics
        total_permissions = sum(len(role_perms) for role_perms in permissions.values())
        total_allowed = sum(
            1 for role_perms in permissions.values()
            for perm in role_perms.values()
            if self._is_allowed(perm)
        )
        total_denied = total_permissions - total_allowed

        stats = {
            "total_tools": len(tools),
            "total_roles": len(roles),
            "total_permissions": total_permissions,
            "total_allowed": total_allowed,
            "total_denied": total_denied,
        }

        # 1. Check for roles with excessive access (>80% tools allowed)
        for rid, role_perms in permissions.items():
            if not role_perms:
                continue
            allowed_count = sum(1 for p in role_perms.values() if self._is_allowed(p))
            pct_allowed = (allowed_count / len(role_perms)) * 100

            role_name = known_roles.get(rid, {}).get("name", f"role-{rid}")

            if pct_allowed > 80 and len(role_perms) > 3:
                issues.append({
                    "issue_type": "excessive_access",
                    "description": f"Role '{role_name}' has {pct_allowed:.0f}% of tools allowed ({allowed_count}/{len(role_perms)})",
                    "severity": "high",
                    "affected_tools": [],
                    "affected_roles": [role_name],
                    "recommendation": f"Review '{role_name}' permissions and restrict to least-privilege",
                })

            # Check for high-risk tools allowed
            high_risk_allowed = []
            for tid, perm in role_perms.items():
                if self._is_allowed(perm):
                    tool = known_tools.get(tid, {})
                    if tool.get("risk_category") in ("destructive", "administrative"):
                        high_risk_allowed.append(tool.get("name", f"tool-{tid}"))

            if high_risk_allowed:
                issues.append({
                    "issue_type": "over_exposed_role",
                    "description": f"Role '{role_name}' has access to high-risk tools: {', '.join(high_risk_allowed)}",
                    "severity": "critical",
                    "affected_tools": high_risk_allowed,
                    "affected_roles": [role_name],
                    "recommendation": f"Restrict high-risk tool access for '{role_name}' or add approval workflows",
                })

        # 2. Check for tools that are allowed for all roles (over-exposed tools)
        for tool in tools:
            tid = str(tool["id"])
            allowed_roles = []
            for rid, role_perms in permissions.items():
                if tid in role_perms and self._is_allowed(role_perms[tid]):
                    allowed_roles.append(known_roles.get(rid, {}).get("name", f"role-{rid}"))

            if len(allowed_roles) == len(roles) and len(roles) > 2:
                issues.append({
                    "issue_type": "over_exposed_tool",
                    "description": f"Tool '{tool['name']}' is allowed for ALL roles ({len(allowed_roles)} roles)",
                    "severity": "medium",
                    "affected_tools": [tool["name"]],
                    "affected_roles": allowed_roles,
                    "recommendation": f"Review if '{tool['name']}' really needs universal access",
                })

        # 3. Check for redundant permissions (inherited but also explicit)
        for rid, role_perms in permissions.items():
            for tid, perm in role_perms.items():
                if self._is_allowed(perm) and self._is_inherited(perm):
                    # This is fine, but note it
                    pass

        # 4. Check for unused tools (denied for all roles)
        for tool in tools:
            tid = str(tool["id"])
            allowed_any = any(
                tid in rp and self._is_allowed(rp[tid])
                for rp in permissions.values()
            )
            if not allowed_any:
                issues.append({
                    "issue_type": "unused_tool",
                    "description": f"Tool '{tool['name']}' is not allowed for any role",
                    "severity": "low",
                    "affected_tools": [tool["name"]],
                    "affected_roles": [],
                    "recommendation": f"Consider removing '{tool['name']}' or granting access to appropriate roles",
                })

        # Calculate sprawl score
        sprawl_score = self._calculate_sprawl_score(issues, stats)

        recommendations.append(
            f"Reduce sprawl by reviewing {len([i for i in issues if i['issue_type'] == 'excessive_access'])} role(s) with excessive access"
        )
        recommendations.append(
            f"Review {len([i for i in issues if i['issue_type'] == 'over_exposed_tool'])} over-exposed tool(s)"
        )

        if not issues:
            recommendations.append("No sprawl issues detected - matrix appears well-structured")

        return {
            "sprawl_score": sprawl_score,
            "issues": sorted(issues, key=lambda x: {"critical": 0, "high": 1, "medium": 2, "low": 3}.get(x.get("severity", "medium"), 4)),
            "recommendations": recommendations,
            "statistics": stats,
            "analysis": f"Analysis found {len(issues)} sprawl issue(s). Sprawl score: {sprawl_score}/100.",
        }

    def _calculate_sprawl_score(
        self, issues: list[dict[str, Any]], stats: dict[str, Any]
    ) -> int:
        """Calculate sprawl score 0-100 based on issues and stats."""
        score = 0

        # Base score from ratio of allowed to total permissions
        total = stats.get("total_permissions", 1)
        allowed = stats.get("total_allowed", 0)
        if total > 0:
            ratio = allowed / total
            if ratio > 0.8:
                score += 30
            elif ratio > 0.6:
                score += 20
            elif ratio > 0.4:
                score += 10

        # Penalty from critical issues
        for issue in issues:
            if issue.get("severity") == "critical":
                score += 25
            elif issue.get("severity") == "high":
                score += 15
            elif issue.get("severity") == "medium":
                score += 8
            elif issue.get("severity") == "low":
                score += 3

        return min(100, score)

    async def _claude_analysis(
        self, matrix: dict[str, Any], tools: list[dict[str, Any]], roles: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """Use Claude to enhance sprawl analysis."""
        system_prompt = """You are a security architecture expert specializing in AI agent tool permission sprawl analysis.
Analyze the permission matrix and identify:
1. Excessive access patterns (roles with more access than needed)
2. Tool over-exposure (tools available to too many roles)
3. Redundant permissions (unnecessary duplicates)
4. Unused tools (tools no role needs)
5. Risk concentration (high-risk tools with too many accessors)

Return a JSON object with:
{
  "sprawl_score": <int 0-100>,
  "issues": [{"issue_type": "<string>", "description": "<string>", "severity": "<critical|high|medium|low>", "affected_tools": [...], "affected_roles": [...], "recommendation": "<string>"}],
  "recommendations": ["<string>", ...],
  "analysis": "<summary>",
  "claude_notes": "<additional insights>"
}"""

        user_message = f"""Analyze this permission matrix for sprawl issues.

Tools: {json.dumps(tools, indent=2)[:5000]}

Roles: {json.dumps(roles, indent=2)[:5000]}

Matrix: {json.dumps(matrix, indent=2)[:10000]}

Return a JSON analysis."""

        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=4000,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
            )

            content = next((b.text for b in response.content if b.type == "text"), "") if response.content else ""

            # Extract JSON from response using brace-depth scan
            result = {}
            start = content.find('{')
            if start != -1:
                depth = 0
                for i, ch in enumerate(content[start:], start):
                    if ch == '{':
                        depth += 1
                    elif ch == '}':
                        depth -= 1
                        if depth == 0:
                            try:
                                result = json.loads(content[start:i+1])
                            except json.JSONDecodeError as exc:
                                logger.warning("Failed to parse Claude JSON response: %s", exc)
                            break

            result.setdefault("sprawl_score", 50)
            result.setdefault("issues", [])
            result.setdefault("recommendations", [])
            result.setdefault("analysis", content[:1000])
            result.setdefault("claude_notes", "")

            return result

        except Exception as e:
            logger.error("Claude sprawl analysis failed: %s", e, exc_info=True)
            return {
                "sprawl_score": 50,
                "issues": [],
                "recommendations": [f"Claude analysis unavailable: {e!s}"],
                "analysis": "Claude analysis unavailable",
                "claude_notes": str(e),
            }