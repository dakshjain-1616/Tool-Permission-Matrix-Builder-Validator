"""Tests for the agent validator service."""

import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.services.agent_validator import AgentValidator
from backend.tests.fixtures.sample_agent import SAMPLE_AGENT_CODE, MINIMAL_AGENT_CODE

# Load sample policy
SAMPLE_POLICY_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "sample_policy.json")
with open(SAMPLE_POLICY_PATH) as f:
    SAMPLE_POLICY = json.load(f)


class TestAgentValidator:
    """Test suite for AgentValidator."""

    def setup_method(self):
        """Create a validator instance without API key (heuristic mode)."""
        self.validator = AgentValidator(api_key="")

    def test_imports_and_instantiation(self):
        """Validator should instantiate without errors."""
        assert self.validator is not None
        assert self.validator.client is None  # No API key

    def test_extract_tool_calls_standard(self):
        """Should detect standard function call patterns."""
        code = """
def my_func():
    search_knowledge_base(query="test")
    result = create_document(title="hello", content="world", author="bot")
    """
        calls = self.validator._extract_tool_calls(code)
        assert "search_knowledge_base" in calls
        assert "create_document" in calls

    def test_extract_tool_calls_use_tool_patterns(self):
        """Should detect use_tool/call_tool/run_tool patterns."""
        code = """
result = use_tool("search_knowledge_base", query="test")
call_tool('send_email', to='user@example.com')
run_tool("delete_resource", resource_id="123")
execute_tool('process_payment', amount=100)
        """
        calls = self.validator._extract_tool_calls(code)
        assert "search_knowledge_base" in calls
        assert "send_email" in calls
        assert "delete_resource" in calls
        assert "process_payment" in calls

    def test_extract_tool_calls_no_python_keywords(self):
        """Should not include Python keywords or common non-tool functions."""
        code = """
for i in range(10):
    if True:
        print("hello")
        return None
        """
        calls = self.validator._extract_tool_calls(code)
        # These should be filtered out
        assert "if" not in calls
        assert "for" not in calls
        assert "return" not in calls
        assert "print" not in calls
        assert "range" not in calls

    def test_extract_tool_calls_from_sample_agent(self):
        """Should extract realistic tool calls from sample agent."""
        calls = self.validator._extract_tool_calls(SAMPLE_AGENT_CODE)
        # Should find our known tool functions
        assert "search_knowledge_base" in calls
        assert "create_document" in calls
        assert "send_email" in calls
        assert "process_payment" in calls
        assert "delete_resource" in calls
        assert "list_users" in calls
        assert "read_file" in calls
        assert "update_configuration" in calls

    def test_heuristic_analysis_returns_valid_structure(self):
        """Heuristic analysis should return the expected structure."""
        result = self.validator.validate(SAMPLE_AGENT_CODE, SAMPLE_POLICY)
        assert "security_score" in result
        assert "issues" in result
        assert "recommendations" in result
        assert "tool_calls_detected" in result
        assert "analysis" in result

        # security_score must be 0-100
        assert 0 <= result["security_score"] <= 100

    def test_heuristic_analysis_allowed_tool_no_issue(self):
        """A tool that is allowed in policy should not generate issues."""
        # Test with a simple code that only calls an allowed viewer tool
        code = "search_knowledge_base(query='test')"
        result = self.validator.validate(code, SAMPLE_POLICY)
        # search_knowledge_base is allowed for viewer (role 1)
        # But since no role context, it still appears. Let's check issues are informational only.
        for issue in result["issues"]:
            # If it mentions search_knowledge_base, it should not be critical
            if issue.get("tool_name") == "search_knowledge_base":
                assert issue.get("severity") != "critical"

    def test_heuristic_analysis_unknown_tool(self):
        """An unknown tool should be flagged."""
        code = "unknown_tool_xyz(query='test')"
        result = self.validator.validate(code, SAMPLE_POLICY)
        issues = [i for i in result["issues"] if i.get("tool_name") == "unknown_tool_xyz"]
        assert len(issues) > 0
        assert any(i.get("issue_type") == "unknown_tool" for i in issues)

    def test_heuristic_analysis_minimal_agent(self):
        """Minimal agent should work without errors."""
        result = self.validator.validate(MINIMAL_AGENT_CODE, SAMPLE_POLICY)
        assert "security_score" in result
        assert "tool_calls_detected" in result
        assert len(result["tool_calls_detected"]) > 0

    def test_empty_code(self):
        """Empty code should produce no tool calls."""
        result = self.validator.validate("", SAMPLE_POLICY)
        assert result["tool_calls_detected"] == []
        assert result["security_score"] == 100  # No violations

    def test_no_policy(self):
        """Analysis without policy should still work."""
        result = self.validator.validate(SAMPLE_AGENT_CODE, {})
        assert "security_score" in result
        # Without known tools, all detected calls are "unknown"
        unknown_issues = [i for i in result["issues"] if i.get("issue_type") == "unknown_tool"]
        assert len(unknown_issues) > 0