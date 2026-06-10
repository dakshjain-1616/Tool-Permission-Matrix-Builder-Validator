"""Agent validator service using Claude to analyze agent code against permission matrix."""

import json
import os
import re
from typing import Any

from anthropic import Anthropic


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


CLAUDE_MODEL = _model()


class AgentValidator:
    """Validates agent code against a permission matrix using Claude."""

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or _api_key()
        self.client = Anthropic(**_client_kwargs(self.api_key)) if self.api_key else None

    def _extract_tool_calls(self, agent_code: str) -> list[str]:
        """Extract tool call names from agent code using regex patterns."""
        tool_calls = set()

        # Pattern 1: tool_name(...) or tool_name(param=value)
        patterns = [
            r'(?:^|\.|\s+|,|\()(\w+)\s*\(',  # function_name(
            r'use_tool\s*\(\s*["\'](\w+)["\']',  # use_tool("name")
            r'call_tool\s*\(\s*["\'](\w+)["\']',  # call_tool("name")
            r'tool\s*=\s*["\'](\w+)["\']',  # tool="name"
            r'run_tool\s*\(\s*["\'](\w+)["\']',  # run_tool("name")
            r'execute_tool\s*\(\s*["\'](\w+)["\']',  # execute_tool("name")
        ]

        for pattern in patterns:
            matches = re.findall(pattern, agent_code)
            tool_calls.update(matches)

        # Filter out Python keywords and common non-tool names
        ignore_words = {
            "if", "else", "for", "while", "def", "class", "return", "import",
            "from", "as", "try", "except", "finally", "with", "and", "or",
            "not", "in", "is", "print", "len", "str", "int", "list", "dict",
            "set", "range", "enumerate", "zip", "map", "filter", "type",
            "self", "True", "False", "None", "raise", "pass", "lambda",
            "yield", "assert", "del", "global", "nonlocal", "break",
            "continue", "elif",
        }

        return sorted(t for t in tool_calls if t not in ignore_words and len(t) > 1)

    def validate(self, agent_code: str, policy_json: dict[str, Any]) -> dict[str, Any]:
        """Validate agent code against a permission policy.

        Returns a dict with:
        - security_score: int 0-100
        - issues: list of dicts
        - recommendations: list of strings
        - tool_calls_detected: list of strings
        - analysis: string summary
        """
        tool_calls_detected = self._extract_tool_calls(agent_code)

        # If no Anthropic key, do a basic heuristic analysis
        if not self.client:
            return self._heuristic_analysis(agent_code, policy_json, tool_calls_detected)

        return self._claude_analysis(agent_code, policy_json, tool_calls_detected)

    def _heuristic_analysis(
        self, agent_code: str, policy_json: dict[str, Any], tool_calls_detected: list[str]
    ) -> dict[str, Any]:
        """Basic heuristic analysis when Claude is unavailable."""
        issues = []
        recommendations = []
        total_checks = 0
        failed_checks = 0

        known_tools = policy_json.get("tools", {})
        permissions = policy_json.get("permissions", {})

        # Check each detected tool call against known tools
        for tool_name in tool_calls_detected:
            matched = False
            for tid, tool_info in known_tools.items():
                if tool_info.get("name", "").lower() == tool_name.lower():
                    matched = True
                    total_checks += 1
                    risk_cat = tool_info.get("risk_category", "unknown")

                    # Check if any role has this tool allowed
                    tool_allowed = False
                    for rid, role_perms in permissions.items():
                        if tid in role_perms and role_perms[tid].get("allowed", False):
                            tool_allowed = True
                            break

                    if not tool_allowed:
                        failed_checks += 1
                        issues.append({
                            "tool_name": tool_name,
                            "risk_category": risk_cat,
                            "issue_type": "missing_permission",
                            "severity": "high" if risk_cat in ("destructive", "administrative") else "medium",
                            "description": f"Agent calls '{tool_name}' but no role has it permitted",
                            "recommendation": f"Add permission for '{tool_name}' or remove the call from agent code",
                        })
                    elif risk_cat in ("destructive", "administrative", "financial"):
                        issues.append({
                            "tool_name": tool_name,
                            "risk_category": risk_cat,
                            "issue_type": "high_risk_tool_usage",
                            "severity": "high",
                            "description": f"Agent uses high-risk tool '{tool_name}' ({risk_cat})",
                            "recommendation": f"Review and restrict '{tool_name}' usage, add audit logging",
                        })
                    break

            if not matched:
                total_checks += 1
                failed_checks += 1
                issues.append({
                    "tool_name": tool_name,
                    "risk_category": "unknown",
                    "issue_type": "unknown_tool",
                    "severity": "medium",
                    "description": f"Agent calls '{tool_name}' which is not in the tool registry",
                    "recommendation": f"Register '{tool_name}' as a tool or remove the call",
                })

        security_score = max(0, 100 - int((failed_checks / max(total_checks, 1)) * 100))

        if not issues:
            recommendations.append("No issues detected - agent appears compliant")
        else:
            recommendations.append(f"Found {len(issues)} issues to address")
            if any(i.get("severity") == "critical" for i in issues):
                recommendations.append("Critical issues must be resolved before deployment")
            if any(i.get("severity") == "high" for i in issues):
                recommendations.append("Address high-severity issues before production use")

        sorted_issues = sorted(issues, key=lambda x: {"critical": 0, "high": 1, "medium": 2, "low": 3}.get(x.get("severity", "medium"), 4))

        return {
            "security_score": security_score,
            "issues": sorted_issues,
            "recommendations": sorted(recommendations),
            "tool_calls_detected": tool_calls_detected,
            "analysis": f"Heuristic analysis found {len(issues)} issue(s). Score: {security_score}/100.",
        }

    def _claude_analysis(
        self, agent_code: str, policy_json: dict[str, Any], tool_calls_detected: list[str]
    ) -> dict[str, Any]:
        """Analyze agent code using Claude."""
        system_prompt = """You are a security analysis expert for AI agent tool permission systems.
Your task is to analyze agent source code against a permission policy and identify security issues.

Return a JSON object with the following structure:
{
  "security_score": <int 0-100>,
  "issues": [
    {
      "tool_name": "<string>",
      "risk_category": "<string>",
      "issue_type": "<missing_permission|excessive_access|unknown_tool|high_risk_tool_usage|info>",
      "severity": "<critical|high|medium|low>",
      "description": "<string>",
      "recommendation": "<string>"
    }
  ],
  "recommendations": ["<string>", ...],
  "analysis": "<summary string>"
}"""

        user_message = f"""Analyze this agent code against the permission policy.

Agent Code:
```python
{agent_code[:15000]}
```

Permission Policy (JSON):
```json
{json.dumps(policy_json, indent=2)[:10000]}
```

Tool calls detected via regex: {tool_calls_detected}

Analyze the security implications and return a JSON response."""

        try:
            response = self.client.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=4000,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
            )

            content = next((b.text for b in response.content if b.type == "text"), "") if response.content else ""

            # Extract JSON from response
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
            else:
                result = {}

            result.setdefault("security_score", 50)
            result.setdefault("issues", [])
            result.setdefault("recommendations", [])
            result.setdefault("analysis", content[:1000])
            result["tool_calls_detected"] = tool_calls_detected

            # Sort issues by severity
            severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
            result["issues"].sort(key=lambda x: severity_order.get(x.get("severity", "medium"), 4))

            return result

        except Exception as e:
            return {
                "security_score": 0,
                "issues": [{
                    "tool_name": "analysis_error",
                    "risk_category": "unknown",
                    "issue_type": "info",
                    "severity": "low",
                    "description": f"Claude analysis failed: {e!s}",
                    "recommendation": "Check API key and try again",
                }],
                "recommendations": ["Claude analysis unavailable, using heuristic fallback"],
                "tool_calls_detected": tool_calls_detected,
                "analysis": f"Fallback analysis. Detected {len(tool_calls_detected)} tool calls.",
            }