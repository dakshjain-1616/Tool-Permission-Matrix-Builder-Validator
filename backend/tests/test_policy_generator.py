"""Tests for the policy generator service."""

import json
import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.services.policy_generator import generate_json, generate_yaml, generate_python_module


SAMPLE_MATRIX = [
    {"tool_id": 1, "tool_name": "search_kb", "role_id": 1, "role_name": "viewer", "risk_category": "read-only", "allowed": True, "inherited": False},
    {"tool_id": 2, "tool_name": "create_doc", "role_id": 2, "role_name": "editor", "risk_category": "internal-write", "allowed": True, "inherited": False},
    {"tool_id": 3, "tool_name": "send_email", "role_id": 2, "role_name": "editor", "risk_category": "external-api", "allowed": False, "inherited": False},
    {"tool_id": 4, "tool_name": "process_payment", "role_id": 3, "role_name": "admin", "risk_category": "financial", "allowed": True, "inherited": False},
    {"tool_id": 5, "tool_name": "delete_resource", "role_id": 3, "role_name": "admin", "risk_category": "destructive", "allowed": True, "inherited": False},
    {"tool_id": 6, "tool_name": "list_users", "role_id": 3, "role_name": "admin", "risk_category": "administrative", "allowed": True, "inherited": False},
]

SAMPLE_TOOLS = [
    {"id": 1, "name": "search_kb", "risk_category": "read-only", "description": "Search KB", "endpoint": ""},
    {"id": 2, "name": "create_doc", "risk_category": "internal-write", "description": "Create doc", "endpoint": ""},
    {"id": 3, "name": "send_email", "risk_category": "external-api", "description": "Send email", "endpoint": ""},
    {"id": 4, "name": "process_payment", "risk_category": "financial", "description": "Payment", "endpoint": ""},
    {"id": 5, "name": "delete_resource", "risk_category": "destructive", "description": "Delete", "endpoint": ""},
    {"id": 6, "name": "list_users", "risk_category": "administrative", "description": "List", "endpoint": ""},
]

SAMPLE_ROLES = [
    {"id": 1, "name": "viewer", "description": "View only"},
    {"id": 2, "name": "editor", "description": "Can edit"},
    {"id": 3, "name": "admin", "description": "Full access"},
]


class TestPolicyGenerator:
    """Test suite for policy generator."""

    def test_generate_json_has_all_risk_categories(self):
        """JSON policy must contain all 6 risk categories."""
        result = generate_json(SAMPLE_MATRIX, SAMPLE_TOOLS, SAMPLE_ROLES)
        thresholds = result.get("risk_thresholds", {})
        risk_categories = ["read-only", "internal-write", "external-api", "financial", "destructive", "administrative"]
        for rc in risk_categories:
            assert rc in thresholds, f"Missing risk category: {rc}"

    def test_generate_json_contains_tools_and_roles(self):
        """JSON policy must include all tools and roles from the matrix."""
        result = generate_json(SAMPLE_MATRIX, SAMPLE_TOOLS, SAMPLE_ROLES)
        assert "tools" in result
        assert "roles" in result
        assert len(result["tools"]) == 6
        assert len(result["roles"]) == 3

    def test_generate_json_permissions_structure(self):
        """JSON policy permissions must map role_id -> tool_id -> permission."""
        result = generate_json(SAMPLE_MATRIX, SAMPLE_TOOLS, SAMPLE_ROLES)
        perms = result.get("permissions", {})
        assert "3" in perms  # admin role
        assert "4" in perms["3"]  # process_payment tool
        assert perms["3"]["4"]["allowed"] == True

    def test_generate_json_policy_version(self):
        """JSON policy must have a version field."""
        result = generate_json(SAMPLE_MATRIX, SAMPLE_TOOLS, SAMPLE_ROLES)
        assert "policy_version" in result
        assert result["policy_version"] == "1.0"

    def test_generate_yaml_is_valid_string(self):
        """YAML output must be a non-empty string."""
        result = generate_yaml(SAMPLE_MATRIX, SAMPLE_TOOLS, SAMPLE_ROLES)
        assert isinstance(result, str)
        assert len(result) > 50
        # Should contain key YAML elements
        assert "policy_version: '1.0'" in result or "policy_version: \"1.0\"" in result or "policy_version: 1.0" in result

    def test_generate_yaml_parseable(self):
        """YAML output must be parseable back to a dict."""
        import yaml
        result = generate_yaml(SAMPLE_MATRIX, SAMPLE_TOOLS, SAMPLE_ROLES)
        parsed = yaml.safe_load(result)
        assert isinstance(parsed, dict)
        assert "tools" in parsed
        assert "roles" in parsed

    def test_generate_python_module_is_valid_syntax(self):
        """Python module must be syntactically correct."""
        result = generate_python_module(SAMPLE_MATRIX, SAMPLE_TOOLS, SAMPLE_ROLES)
        assert isinstance(result, str)
        assert len(result) > 100
        # Check key elements
        assert "class RiskCategory(str, Enum)" in result or "class RiskCategory" in result
        assert "READ_ONLY = \"read-only\"" in result
        assert "TOOLS:" in result
        assert "ROLES:" in result
        assert "PERMISSIONS:" in result
        assert "def check_permission" in result

    def test_generate_python_module_compiles(self):
        """Generated Python module must compile without syntax errors."""
        result = generate_python_module(SAMPLE_MATRIX, SAMPLE_TOOLS, SAMPLE_ROLES)
        try:
            compile(result, "generated_permissions.py", "exec")
        except SyntaxError as e:
            pytest.fail(f"Python module has syntax error: {e}")

    def test_generate_python_module_executable(self):
        """Generated Python module must be importable and functions callable."""
        import tempfile
        import importlib.util
        result = generate_python_module(SAMPLE_MATRIX, SAMPLE_TOOLS, SAMPLE_ROLES)
        with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False, dir="/tmp") as f:
            f.write(result)
            temp_path = f.name

        try:
            spec = importlib.util.spec_from_file_location("test_perms", temp_path)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)

            # Test the functions
            assert mod.check_permission(1, 1) == True  # viewer -> search_kb
            assert mod.check_permission(1, 2) == False  # viewer -> create_doc
            assert mod.check_permission(3, 4) == True  # admin -> process_payment

            tools_for_viewer = mod.get_tools_for_role(1)
            assert 1 in tools_for_viewer  # search_kb
            assert 2 not in tools_for_viewer  # not create_doc

            # Check RiskCategory enum
            assert mod.RiskCategory.READ_ONLY.value == "read-only"
            assert mod.RiskCategory.DESTRUCTIVE.value == "destructive"
        finally:
            os.unlink(temp_path)

    def test_generate_json_with_empty_matrix(self):
        """Should handle empty matrix gracefully."""
        result = generate_json([], [], [])
        assert "tools" in result
        assert "roles" in result
        assert "permissions" in result

    def test_generate_python_with_empty_matrix(self):
        """Should produce valid Python even with empty matrix."""
        result = generate_python_module([], [], [])
        try:
            compile(result, "empty_permissions.py", "exec")
        except SyntaxError as e:
            pytest.fail(f"Empty Python module has syntax error: {e}")